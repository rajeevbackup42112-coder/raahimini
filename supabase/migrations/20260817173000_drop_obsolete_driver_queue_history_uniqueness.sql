-- Historical terminal states may repeat across journeys. The canonical live-state
-- partial indexes continue to enforce one live entry per driver, one active car per
-- route, and unique live queue positions.
alter table public.driver_queue
  drop constraint if exists driver_queue_driver_id_route_id_status_key;

comment on table public.driver_queue is
  'FIFO driver queue. Live-state uniqueness is enforced by partial indexes; terminal history may repeat across journeys.';
