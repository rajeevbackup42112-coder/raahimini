-- Demo Ready: repair Admin Access read projection after user_role became an enum.
-- No delegation safeguards or mutation semantics are changed.
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
  select p.id, p.display_name, u.email::text, p.role::text, p.is_restricted
  from public.profiles p
  join auth.users u on u.id=p.id
  where p.role in ('passenger','admin')
  order by p.role, p.display_name nulls last, u.email;
end;
$function$;

revoke all on function public.admin_list_role_accounts() from public, anon;
grant execute on function public.admin_list_role_accounts() to authenticated;
