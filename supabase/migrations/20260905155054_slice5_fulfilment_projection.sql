-- Slice 5E: Driver fulfilment projection includes actionable booking state.

create or replace function private.get_my_fixed_assignments()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'ride_id', ride.id,
    'status', ride.status,
    'matched_at', ride.matched_at,
    'driver_ack_deadline', ride.driver_ack_deadline,
    'boarding_deadline', ride.boarding_deadline,
    'refill_deadline', ride.refill_deadline,
    'origin_name', o.name,
    'destination_name', dest.name,
    'vehicle_model', v.vehicle_model,
    'vehicle_registration', v.registration_number,
    'booked_seat_count', ride.booked_seat_count,
    'capacity', ride.capacity,
    'passenger_groups', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'booking_id', b.id,
        'display_name', p.display_name,
        'seat_count', b.seat_count,
        'status', b.status
      ) order by b.assigned_at, b.id), '[]'::jsonb)
      from public.ride_bookings b
      join public.profiles p on p.id = b.passenger_profile_id
      where b.ride_id = ride.id
    )
  ) order by ride.matched_at desc), '[]'::jsonb)
  from public.rides ride
  join public.drivers d on d.id = ride.driver_id and d.profile_id = auth.uid()
  join public.locations o on o.id = ride.origin_location_id
  join public.locations dest on dest.id = ride.destination_location_id
  join public.vehicles v on v.id = ride.vehicle_id
  where ride.status not in ('COMPLETED','DRIVER_FAILED','CANCELLED');
$$;

revoke all on function private.get_my_fixed_assignments()
from public, anon, authenticated;
grant execute on function private.get_my_fixed_assignments() to authenticated;
