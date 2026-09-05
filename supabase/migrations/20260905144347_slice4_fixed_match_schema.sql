-- Slice 4: atomic Fixed matching, Ride/Booking creation and post-match trust reveal.

alter table public.fixed_passenger_requests
  add column match_skip_count integer not null default 0 check (match_skip_count between 0 and 1000),
  add column last_skipped_at timestamptz;

insert into public.service_product_rule_versions(product_id, version_no, rules)
select p.id, 3,
       r.rules || jsonb_build_object(
         'matcher_candidate_window', 12,
         'commitment_horizon_minutes', 180
       )
from public.service_products p
join public.service_product_rule_versions r
  on r.product_id = p.id and r.version_no = 2
where p.code = 'GOMOH_DHANBAD_FIXED_OW'
on conflict (product_id, version_no) do nothing;

update public.service_products
set current_rules_version = 3
where code = 'GOMOH_DHANBAD_FIXED_OW';

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.service_products(id),
  product_rules_version integer not null,
  driver_id uuid not null references public.drivers(id),
  vehicle_id uuid not null references public.vehicles(id),
  origin_market_id uuid not null references public.markets(id),
  origin_location_id uuid not null references public.locations(id),
  destination_location_id uuid not null references public.locations(id),
  commitment_id uuid unique references public.mobility_commitments(id),
  capacity integer not null check (capacity between 1 and 12),
  booked_seat_count integer not null check (booked_seat_count between 1 and 12),
  fare_per_seat_inr integer not null check (fare_per_seat_inr > 0),
  status text not null default 'MATCHED' check (status in (
    'MATCHED','DRIVER_ACKNOWLEDGED','DRIVER_EN_ROUTE','DRIVER_ARRIVED',
    'BOARDING','READY_TO_DEPART','IN_PROGRESS','COMPLETED',
    'DRIVER_FAILED','CANCELLED','SYSTEM_EXCEPTION'
  )),
  matched_at timestamptz not null default now(),
  driver_ack_deadline timestamptz not null,
  commitment_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, product_rules_version)
    references public.service_product_rule_versions(product_id, version_no),
  check (booked_seat_count <= capacity)
);

create index idx_rides_driver_status on public.rides(driver_id, status, matched_at desc);
create index idx_rides_product_status on public.rides(product_id, status, matched_at desc);

create table public.ride_bookings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  passenger_request_id uuid not null unique references public.fixed_passenger_requests(id),
  passenger_profile_id uuid not null references public.profiles(id),
  seat_count integer not null check (seat_count between 1 and 12),
  fare_per_seat_inr integer not null check (fare_per_seat_inr > 0),
  total_fare_inr integer generated always as (seat_count * fare_per_seat_inr) stored,
  boarding_context jsonb not null default '{}'::jsonb,
  status text not null default 'ASSIGNED' check (status in (
    'ASSIGNED','BOARDED','NO_SHOW','CANCELLED','COMPLETED'
  )),
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_ride_bookings_ride on public.ride_bookings(ride_id);
create index idx_ride_bookings_passenger on public.ride_bookings(passenger_profile_id, assigned_at desc);

create table public.ride_events (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 2 and 80),
  actor_kind text not null check (actor_kind in ('SYSTEM','PASSENGER','DRIVER','ADMIN')),
  actor_profile_id uuid references public.profiles(id),
  previous_state text,
  next_state text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index idx_ride_events_ride on public.ride_events(ride_id, occurred_at, id);

create trigger rides_set_updated_at
before update on public.rides
for each row execute function private.set_updated_at();

alter table public.rides enable row level security;
alter table public.ride_bookings enable row level security;
alter table public.ride_events enable row level security;

revoke all on public.rides from public, anon, authenticated;
revoke all on public.ride_bookings from public, anon, authenticated;
revoke all on public.ride_events from public, anon, authenticated;

create policy rides_no_direct_client_access on public.rides
for all to anon, authenticated using (false) with check (false);
create policy ride_bookings_no_direct_client_access on public.ride_bookings
for all to anon, authenticated using (false) with check (false);
create policy ride_events_no_direct_client_access on public.ride_events
for all to anon, authenticated using (false) with check (false);
