-- RAAHI MINI — STRICT ROLE TRANSITION SAFETY
-- A passenger with a live HELD/CONFIRMED seat request must finish or exit that
-- passenger journey before becoming a driver or admin. This is enforced as a
-- database invariant so every trusted role-change path shares the same rule.

create or replace function public.guard_profile_role_transition_with_active_request()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.role = 'passenger' and new.role <> 'passenger' then
    if exists (
      select 1
      from public.seat_requests sr
      where sr.passenger_id = old.id
        and sr.status in ('HELD','CONFIRMED')
    ) then
      raise exception 'Cannot change passenger role while an active seat request exists';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_role_transition_with_active_request()
from public, anon, authenticated;

drop trigger if exists trg_profiles_guard_role_transition on public.profiles;
create trigger trg_profiles_guard_role_transition
before update of role on public.profiles
for each row
when (old.role is distinct from new.role)
execute function public.guard_profile_role_transition_with_active_request();
