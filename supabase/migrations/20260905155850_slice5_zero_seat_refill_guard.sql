-- Slice 5F: a matched Ride may temporarily have zero booked seats during
-- no-show recovery/refill. Capacity remains positive; booked seats may be zero.

alter table public.rides
  drop constraint if exists rides_booked_seat_count_check;

alter table public.rides
  add constraint rides_booked_seat_count_check
  check (booked_seat_count between 0 and 12);
