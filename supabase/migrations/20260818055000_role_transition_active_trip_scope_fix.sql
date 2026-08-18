-- RAAHI MINI — ROLE TRANSITION GUARD SCOPE CORRECTION
-- CONFIRMED requests remain CONFIRMED historically after a trip completes, so
-- role transition must be blocked only while the passenger journey itself is live.

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
      join public.trips t on t.id = sr.trip_id
      where sr.passenger_id = old.id
        and sr.status in ('HELD','CONFIRMED')
        and t.status in ('ACTIVE_COLLECTING','IN_PROGRESS')
    ) then
      raise exception 'Cannot change passenger role while an active seat request exists';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_role_transition_with_active_request()
from public, anon, authenticated;
