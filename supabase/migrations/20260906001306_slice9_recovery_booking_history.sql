-- Slice 9G: reopened Outstation demand may create a new booking while preserving cancelled history.

alter table public.ride_bookings
  drop constraint if exists ride_bookings_outstation_request_id_key;

create unique index ride_bookings_one_active_outstation_request
  on public.ride_bookings(outstation_request_id)
  where outstation_request_id is not null
    and status in ('ASSIGNED','BOARDED');
