create index if not exists idx_support_cases_reporter on public.support_cases(reporter_id);
create index if not exists idx_support_cases_trip on public.support_cases(trip_id) where trip_id is not null;
create index if not exists idx_support_cases_request on public.support_cases(request_id) where request_id is not null;
create index if not exists idx_trip_live_locations_driver on public.trip_live_locations(driver_id);
create index if not exists idx_trip_share_links_passenger on public.trip_share_links(passenger_id);
