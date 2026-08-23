-- RC1 additive performance hardening only.
-- These indexes do not change RLS, RPC behavior, booking, FIFO, fare or trip semantics.

create index if not exists idx_admin_config_updated_by
  on public.admin_config(updated_by);

create index if not exists idx_behaviour_events_request_id
  on public.behaviour_events(request_id);

create index if not exists idx_drivers_vehicle_id
  on public.drivers(vehicle_id);

create index if not exists idx_seat_requests_pickup_stop_id
  on public.seat_requests(pickup_stop_id);

create index if not exists idx_trip_progress_stop_id
  on public.trip_progress(stop_id);

create index if not exists idx_trips_queue_entry_id
  on public.trips(queue_entry_id);

create index if not exists idx_trips_vehicle_id
  on public.trips(vehicle_id);
