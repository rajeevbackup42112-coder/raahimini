-- Trusted admin delegation. Admins can promote an existing passenger account to admin
-- and revoke another admin, while preventing mixed driver/admin roles and loss of the final admin.

create or replace function public.admin_list_role_accounts()
returns table(id uuid, display_name text, email text, role text, is_restricted boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.role='admin' and not p.is_restricted
  ) then
    raise exception 'Admin access required';
  end if;

  return query
  select p.id, p.display_name, u.email::text, p.role, p.is_restricted
  from public.profiles p
  join auth.users u on u.id=p.id
  where p.role in ('passenger','admin')
  order by p.role, p.display_name nulls last, u.email;
end;
$function$;

create or replace function public.admin_grant_admin(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_target public.profiles;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.role='admin' and not p.is_restricted
  ) then
    return jsonb_build_object('success',false,'error','Admin access required');
  end if;

  select * into v_target from public.profiles where id=p_user_id for update;
  if v_target.id is null then return jsonb_build_object('success',false,'error','User not found'); end if;
  if v_target.is_restricted then return jsonb_build_object('success',false,'error','Restricted users cannot become admins'); end if;
  if v_target.role='driver' or exists(select 1 from public.drivers d where d.profile_id=p_user_id and d.is_active) then
    return jsonb_build_object('success',false,'error','Driver accounts cannot also be admins');
  end if;
  if v_target.role='admin' then return jsonb_build_object('success',true,'already_admin',true); end if;
  if v_target.role<>'passenger' then return jsonb_build_object('success',false,'error','Only passenger accounts can be promoted to admin'); end if;

  update public.profiles set role='admin', updated_at=now() where id=p_user_id;
  perform public.record_audit('admin_grant_admin','profiles',p_user_id,jsonb_build_object('role',v_target.role),jsonb_build_object('role','admin'),null);
  return jsonb_build_object('success',true);
end;
$function$;

create or replace function public.admin_revoke_admin(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_target public.profiles; v_admin_count integer;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.role='admin' and not p.is_restricted
  ) then
    return jsonb_build_object('success',false,'error','Admin access required');
  end if;
  if p_user_id=auth.uid() then return jsonb_build_object('success',false,'error','You cannot remove your own admin access'); end if;

  select * into v_target from public.profiles where id=p_user_id for update;
  if v_target.id is null or v_target.role<>'admin' then return jsonb_build_object('success',false,'error','Target is not an admin'); end if;
  select count(*) into v_admin_count from public.profiles where role='admin' and not is_restricted;
  if v_admin_count<=1 then return jsonb_build_object('success',false,'error','The final active admin cannot be removed'); end if;

  update public.profiles set role='passenger', updated_at=now() where id=p_user_id;
  perform public.record_audit('admin_revoke_admin','profiles',p_user_id,jsonb_build_object('role','admin'),jsonb_build_object('role','passenger'),null);
  return jsonb_build_object('success',true);
end;
$function$;

revoke all on function public.admin_list_role_accounts() from public, anon;
revoke all on function public.admin_grant_admin(uuid) from public, anon;
revoke all on function public.admin_revoke_admin(uuid) from public, anon;
grant execute on function public.admin_list_role_accounts() to authenticated;
grant execute on function public.admin_grant_admin(uuid) to authenticated;
grant execute on function public.admin_revoke_admin(uuid) to authenticated;
