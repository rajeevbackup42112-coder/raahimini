-- Slice 10A: Carpool marketplace objects and bridge to shared Ride/Booking authority.

insert into public.service_products(code,market_id,corridor_id,service_type,display_name,status,public_summary)
select 'GOMOH_CARPOOL',m.id,c.id,'CARPOOL','Gomoh to Dhanbad — Carpool','PILOT',
       'A Driver already making this journey can publish spare seats for instant eligible booking.'
from public.markets m join public.corridors c on c.code='GOMOH_DHANBAD'
where m.code='GOMOH'
on conflict(code) do nothing;

insert into public.service_product_rule_versions(product_id,version_no,rules)
select p.id,1,jsonb_build_object(
  'max_seats_per_booking',4,
  'min_departure_lead_minutes',30,
  'max_publish_horizon_days',30,
  'pre_departure_buffer_minutes',30,
  'journey_commitment_minutes',240,
  'post_arrival_buffer_minutes',30,
  'arrival_zone_code','GOMOH_CORE',
  'arrival_radius_meters',1000,
  'arrival_max_accuracy_meters',200,
  'arrival_max_location_age_seconds',60,
  'boarding_wait_minutes',10,
  'refill_window_minutes',0,
  'completion_zone_code','DHANBAD_CORE',
  'completion_radius_meters',1500,
  'completion_max_accuracy_meters',200,
  'completion_max_location_age_seconds',60
)
from public.service_products p where p.code='GOMOH_CARPOOL'
on conflict(product_id,version_no) do nothing;
update public.service_products set current_rules_version=1 where code='GOMOH_CARPOOL';

create table public.carpool_journeys (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.service_products(id),
  product_rules_version integer not null,
  driver_id uuid not null references public.drivers(id),
  vehicle_id uuid not null references public.vehicles(id),
  origin_market_id uuid not null references public.markets(id),
  origin_location_id uuid not null references public.locations(id),
  destination_location_id uuid not null references public.locations(id),
  departure_at timestamptz not null,
  offered_seats integer not null check(offered_seats between 1 and 12),
  active_booked_seats integer not null default 0 check(active_booked_seats between 0 and 12),
  contribution_per_seat_inr integer not null check(contribution_per_seat_inr>0),
  status text not null default 'PUBLISHED' check(status in ('PUBLISHED','FULL','CHANGE_PENDING','IN_FULFILMENT','COMPLETED','DRIVER_CANCELLED','EXPIRED')),
  commitment_id uuid unique references public.mobility_commitments(id),
  ride_id uuid unique,
  current_change_version integer not null default 0 check(current_change_version>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  completed_at timestamptz,
  check(active_booked_seats<=offered_seats),
  foreign key(product_id,product_rules_version) references public.service_product_rule_versions(product_id,version_no)
);
create index idx_carpool_journeys_driver on public.carpool_journeys(driver_id,status,departure_at);
create index idx_carpool_journeys_product on public.carpool_journeys(product_id,status,departure_at);
create index idx_carpool_journeys_vehicle on public.carpool_journeys(vehicle_id,status,departure_at);
create index idx_carpool_journeys_origin on public.carpool_journeys(origin_location_id,status,departure_at);
create index idx_carpool_journeys_destination on public.carpool_journeys(destination_location_id,status,departure_at);

create table public.carpool_bookings (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.carpool_journeys(id) on delete restrict,
  passenger_profile_id uuid not null references public.profiles(id),
  seat_count integer not null check(seat_count between 1 and 12),
  contribution_per_seat_inr integer not null check(contribution_per_seat_inr>0),
  status text not null default 'ACTIVE' check(status in ('ACTIVE','CANCELLED','DRIVER_CANCELLED','NO_SHOW','COMPLETED')),
  ride_booking_id uuid unique,
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz,
  completed_at timestamptz
);
create unique index carpool_one_active_booking_per_passenger on public.carpool_bookings(journey_id,passenger_profile_id) where status='ACTIVE';
create index idx_carpool_bookings_passenger on public.carpool_bookings(passenger_profile_id,status,booked_at desc);
create index idx_carpool_bookings_journey on public.carpool_bookings(journey_id,status,booked_at);

create table public.carpool_change_proposals (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.carpool_journeys(id) on delete restrict,
  version_no integer not null check(version_no>0),
  proposed_destination_location_id uuid not null references public.locations(id),
  proposed_departure_at timestamptz not null,
  status text not null default 'PENDING' check(status in ('PENDING','APPLIED','CANCELLED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(journey_id,version_no)
);
create unique index carpool_one_pending_change_per_journey on public.carpool_change_proposals(journey_id) where status='PENDING';

create table public.carpool_booking_change_consents (
  proposal_id uuid not null references public.carpool_change_proposals(id) on delete cascade,
  carpool_booking_id uuid not null references public.carpool_bookings(id) on delete restrict,
  status text not null default 'PENDING' check(status in ('PENDING','ACCEPTED','REJECTED')),
  responded_at timestamptz,
  primary key(proposal_id,carpool_booking_id)
);
create index idx_carpool_change_consents_booking on public.carpool_booking_change_consents(carpool_booking_id,status);

alter table public.rides add column carpool_journey_id uuid unique references public.carpool_journeys(id);
alter table public.carpool_journeys add constraint carpool_journeys_ride_fk foreign key(ride_id) references public.rides(id) deferrable initially deferred;
create index idx_rides_carpool_journey on public.rides(carpool_journey_id) where carpool_journey_id is not null;

alter table public.ride_bookings add column carpool_booking_id uuid unique references public.carpool_bookings(id);
alter table public.carpool_bookings add constraint carpool_bookings_ride_booking_fk foreign key(ride_booking_id) references public.ride_bookings(id) deferrable initially deferred;
alter table public.ride_bookings drop constraint ride_booking_source_check;
alter table public.ride_bookings add constraint ride_booking_source_check check (
  ((passenger_request_id is not null)::int + (outstation_request_id is not null)::int + (carpool_booking_id is not null)::int)=1
);
create index idx_ride_bookings_carpool_booking on public.ride_bookings(carpool_booking_id) where carpool_booking_id is not null;

create trigger set_carpool_journeys_updated_at before update on public.carpool_journeys for each row execute function private.set_updated_at();

alter table public.carpool_journeys enable row level security;
alter table public.carpool_bookings enable row level security;
alter table public.carpool_change_proposals enable row level security;
alter table public.carpool_booking_change_consents enable row level security;
revoke all on public.carpool_journeys from public,anon,authenticated;
revoke all on public.carpool_bookings from public,anon,authenticated;
revoke all on public.carpool_change_proposals from public,anon,authenticated;
revoke all on public.carpool_booking_change_consents from public,anon,authenticated;
create policy carpool_journeys_no_direct_client_access on public.carpool_journeys for all to anon,authenticated using(false) with check(false);
create policy carpool_bookings_no_direct_client_access on public.carpool_bookings for all to anon,authenticated using(false) with check(false);
create policy carpool_change_proposals_no_direct_client_access on public.carpool_change_proposals for all to anon,authenticated using(false) with check(false);
create policy carpool_change_consents_no_direct_client_access on public.carpool_booking_change_consents for all to anon,authenticated using(false) with check(false);