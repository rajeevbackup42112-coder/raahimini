-- Slice 8B: Round Trip state on the existing Ride/Booking kernel.

alter table public.rides drop constraint rides_status_check;
alter table public.rides add constraint rides_status_check check (status in (
  'MATCHED','DRIVER_ACKNOWLEDGED','DRIVER_EN_ROUTE','DRIVER_ARRIVED','BOARDING',
  'READY_TO_DEPART','IN_PROGRESS','OUTBOUND_IN_PROGRESS','WAITING_FOR_RETURN',
  'RETURN_BOARDING','RETURN_IN_PROGRESS','COMPLETED','DRIVER_FAILED','CANCELLED','SYSTEM_EXCEPTION'
));

alter table public.rides
  add column outbound_completed_at timestamptz,
  add column outbound_completion_zone_id uuid references public.market_presence_zones(id),
  add column outbound_completion_accuracy_meters double precision,
  add column return_not_before timestamptz,
  add column return_boarding_started_at timestamptz,
  add column return_boarding_deadline timestamptz,
  add column return_departed_at timestamptz,
  add column return_completed_at timestamptz,
  add column return_completion_zone_id uuid references public.market_presence_zones(id),
  add column return_completion_accuracy_meters double precision;

alter table public.ride_bookings
  add column return_status text not null default 'NOT_APPLICABLE'
    check (return_status in ('NOT_APPLICABLE','PENDING','BOARDED','NO_SHOW')),
  add column return_boarded_at timestamptz,
  add column return_no_show_at timestamptz;

create index idx_rides_outbound_completion_zone on public.rides(outbound_completion_zone_id)
where outbound_completion_zone_id is not null;
create index idx_rides_return_completion_zone on public.rides(return_completion_zone_id)
where return_completion_zone_id is not null;
create or replace function private.initialize_round_trip_booking_return_status()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists (
    select 1 from public.rides r
    join public.service_products p on p.id=r.product_id
    where r.id=new.ride_id and p.service_type='FIXED_ROUND_TRIP'
  ) then
    new.return_status := 'PENDING';
  else
    new.return_status := 'NOT_APPLICABLE';
  end if;
  return new;
end;
$$;
revoke all on function private.initialize_round_trip_booking_return_status()
from public,anon,authenticated;

drop trigger if exists initialize_round_trip_booking_return_status on public.ride_bookings;
create trigger initialize_round_trip_booking_return_status
before insert on public.ride_bookings
for each row execute function private.initialize_round_trip_booking_return_status();