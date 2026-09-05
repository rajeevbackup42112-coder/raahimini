-- Slice 6C: completed Fixed journey history projection for the owning Driver.

create or replace function private.get_my_fixed_history()
returns jsonb
language sql
security definer
stable
set search_path=''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'ride_id', r.id,
    'status', r.status,
    'origin_name', o.name,
    'destination_name', d.name,
    'vehicle_model', v.vehicle_model,
    'vehicle_registration', v.registration_number,
    'completed_at', r.completed_at,
    'departed_at', r.departed_at,
    'booked_seat_count', r.booked_seat_count,
    'capacity', r.capacity,
    'completion_zone', z.label
  ) order by r.completed_at desc), '[]'::jsonb)
  from public.rides r
  join public.drivers dr on dr.id=r.driver_id and dr.profile_id=auth.uid()
  join public.locations o on o.id=r.origin_location_id
  join public.locations d on d.id=r.destination_location_id
  join public.vehicles v on v.id=r.vehicle_id
  left join public.market_presence_zones z on z.id=r.completion_zone_id
  where r.status='COMPLETED';
$$;

revoke all on function private.get_my_fixed_history() from public, anon, authenticated;
grant execute on function private.get_my_fixed_history() to authenticated;
create or replace function public.get_my_fixed_history()
returns jsonb
language sql
security invoker
stable
set search_path=''
as $$ select private.get_my_fixed_history(); $$;

revoke all on function public.get_my_fixed_history() from public, anon, authenticated;
grant execute on function public.get_my_fixed_history() to authenticated;
