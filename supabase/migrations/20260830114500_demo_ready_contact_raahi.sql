-- Contact Raahi is separate from ride-specific support_cases.
-- It accepts general suggestions, promotion enquiries, partner/Driver enquiries and other contact.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete set null,
  category text not null check (category in ('SUGGESTION','PROMOTION','DRIVER_PARTNER','GENERAL_HELP','OTHER')),
  sender_name text not null,
  contact_value text not null,
  message text not null,
  status text not null default 'NEW' check (status in ('NEW','RESOLVED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  resolved_by uuid null references public.profiles(id) on delete set null
);

alter table public.contact_messages enable row level security;
revoke all on table public.contact_messages from public, anon, authenticated, service_role;

create index if not exists idx_contact_messages_open_created
  on public.contact_messages(status, created_at desc);
create index if not exists idx_contact_messages_contact_recent
  on public.contact_messages(lower(contact_value), created_at desc);

create or replace function public.submit_contact_message(
  p_category text,
  p_sender_name text,
  p_contact text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_category text := upper(trim(coalesce(p_category,'')));
  v_name text := trim(coalesce(p_sender_name,''));
  v_contact text := trim(coalesce(p_contact,''));
  v_message text := trim(coalesce(p_message,''));
  v_id uuid;
begin
  if v_category not in ('SUGGESTION','PROMOTION','DRIVER_PARTNER','GENERAL_HELP','OTHER') then
    return jsonb_build_object('success',false,'error','Choose a valid contact reason');
  end if;
  if length(v_name) < 2 or length(v_name) > 80 then
    return jsonb_build_object('success',false,'error','Name must be between 2 and 80 characters');
  end if;
  if length(v_contact) < 5 or length(v_contact) > 120 then
    return jsonb_build_object('success',false,'error','Add a valid phone, WhatsApp number or email');
  end if;
  if length(v_message) < 5 or length(v_message) > 1000 then
    return jsonb_build_object('success',false,'error','Message must be between 5 and 1000 characters');
  end if;

  if exists(
    select 1 from public.contact_messages c
    where lower(c.contact_value)=lower(v_contact)
      and c.created_at > now() - interval '10 minutes'
  ) then
    return jsonb_build_object('success',false,'error','We already received a recent message from this contact. Please wait a few minutes before sending another.');
  end if;

  insert into public.contact_messages(user_id,category,sender_name,contact_value,message)
  values(auth.uid(),v_category,v_name,v_contact,v_message)
  returning id into v_id;

  return jsonb_build_object('success',true,'message_id',v_id);
end;
$function$;

create or replace function public.admin_list_open_contact_messages()
returns table(
  message_id uuid,
  category text,
  sender_name text,
  contact_value text,
  message text,
  user_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then return; end if;
  return query
  select c.id,c.category,c.sender_name,c.contact_value,c.message,c.user_id,c.created_at
  from public.contact_messages c
  where c.status='NEW'
  order by c.created_at asc;
end;
$function$;

create or replace function public.admin_resolve_contact_message(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_before public.contact_messages;
begin
  if not public.is_admin() then
    return jsonb_build_object('success',false,'error','Admin access required');
  end if;
  select * into v_before from public.contact_messages where id=p_message_id for update;
  if v_before.id is null then
    return jsonb_build_object('success',false,'error','Contact message not found');
  end if;
  if v_before.status='RESOLVED' then
    return jsonb_build_object('success',true,'already_resolved',true);
  end if;
  update public.contact_messages
  set status='RESOLVED',resolved_at=now(),resolved_by=auth.uid()
  where id=p_message_id;
  perform public.record_audit('admin_resolve_contact_message','contact_messages',p_message_id,to_jsonb(v_before),
    jsonb_build_object('status','RESOLVED','resolved_by',auth.uid()),null);
  return jsonb_build_object('success',true);
end;
$function$;

revoke all on function public.submit_contact_message(text,text,text,text) from public;
revoke all on function public.admin_list_open_contact_messages() from public, anon, service_role;
revoke all on function public.admin_resolve_contact_message(uuid) from public, anon, service_role;
grant execute on function public.submit_contact_message(text,text,text,text) to anon, authenticated;
grant execute on function public.admin_list_open_contact_messages() to authenticated;
grant execute on function public.admin_resolve_contact_message(uuid) to authenticated;
