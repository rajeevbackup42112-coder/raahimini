create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  user_role text not null check (user_role in ('passenger','driver','admin')),
  subject text not null check (char_length(subject) between 3 and 120),
  body text not null check (char_length(body) between 3 and 2000),
  allow_contact boolean not null default false,
  contact_email text,
  contact_phone text,
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','RESOLVED')),
  notification_status text not null default 'PENDING' check (notification_status in ('PENDING','SENT','FAILED','NOT_CONFIGURED')),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_requests enable row level security;
revoke all on public.support_requests from anon, authenticated;

create or replace function public.submit_support_request(p_subject text, p_body text, p_allow_contact boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $function$
declare v_profile public.profiles; v_email text; v_phone text; v_id uuid;
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Not authenticated'); end if;
  select * into v_profile from public.profiles where id=auth.uid();
  if v_profile.id is null then return jsonb_build_object('success',false,'error','Profile not found'); end if;
  if char_length(btrim(coalesce(p_subject,''))) < 3 or char_length(btrim(p_subject)) > 120 then return jsonb_build_object('success',false,'error','Subject must be 3-120 characters'); end if;
  if char_length(btrim(coalesce(p_body,''))) < 3 or char_length(btrim(p_body)) > 2000 then return jsonb_build_object('success',false,'error','Message must be 3-2000 characters'); end if;
  if coalesce(p_allow_contact,false) then select email, phone into v_email, v_phone from auth.users where id=auth.uid(); end if;
  insert into public.support_requests(user_id,user_role,subject,body,allow_contact,contact_email,contact_phone)
  values(auth.uid(),v_profile.role::text,btrim(p_subject),btrim(p_body),coalesce(p_allow_contact,false),v_email,v_phone)
  returning id into v_id;
  perform public.record_audit('submit_support_request','support_requests',v_id,null,jsonb_build_object('allow_contact',coalesce(p_allow_contact,false)),null);
  return jsonb_build_object('success',true,'request_id',v_id);
end;$function$;
grant execute on function public.submit_support_request(text,text,boolean) to authenticated;

create or replace function public.admin_get_support_requests(p_limit integer default 100)
returns table(request_id uuid,user_id uuid,display_name text,user_role text,subject text,body text,allow_contact boolean,contact_email text,contact_phone text,status text,notification_status text,created_at timestamptz)
language plpgsql security definer set search_path = public as $function$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin' and not is_restricted) then raise exception 'Admin access required'; end if;
  return query
  select s.id,s.user_id,p.display_name,s.user_role,s.subject,s.body,s.allow_contact,
         case when s.allow_contact then s.contact_email else null end,
         case when s.allow_contact then s.contact_phone else null end,
         s.status,s.notification_status,s.created_at
  from public.support_requests s join public.profiles p on p.id=s.user_id
  order by case s.status when 'OPEN' then 0 when 'IN_PROGRESS' then 1 else 2 end, s.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),500));
end;$function$;
grant execute on function public.admin_get_support_requests(integer) to authenticated;

create or replace function public.admin_update_support_status(p_request_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $function$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin' and not is_restricted) then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  if p_status not in ('OPEN','IN_PROGRESS','RESOLVED') then return jsonb_build_object('success',false,'error','Invalid status'); end if;
  update public.support_requests set status=p_status,updated_at=now() where id=p_request_id;
  if not found then return jsonb_build_object('success',false,'error','Support request not found'); end if;
  perform public.record_audit('admin_update_support_status','support_requests',p_request_id,null,jsonb_build_object('status',p_status),null);
  return jsonb_build_object('success',true);
end;$function$;
grant execute on function public.admin_update_support_status(uuid,text) to authenticated;

create or replace function public.mark_support_request_notified(p_request_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $function$
begin
  if p_status not in ('SENT','FAILED','NOT_CONFIGURED') then raise exception 'Invalid notification status'; end if;
  update public.support_requests set notification_status=p_status,notified_at=case when p_status='SENT' then now() else notified_at end,updated_at=now() where id=p_request_id;
end;$function$;
revoke all on function public.mark_support_request_notified(uuid,text) from public, anon, authenticated;
grant execute on function public.mark_support_request_notified(uuid,text) to service_role;
