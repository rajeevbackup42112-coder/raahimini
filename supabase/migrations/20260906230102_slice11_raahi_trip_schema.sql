insert into public.service_products(code,market_id,corridor_id,service_type,display_name,status,public_summary,current_rules_version)
select 'GOMOH_RAAHI_TRIPS',m.id,null,'RAAHI_TRIP','Raahi Trips from Gomoh','PILOT','Driver-created shared day journeys from Gomoh. Bookings may be filling until the confirmation threshold is reached.',1
from public.markets m where m.code='GOMOH'
on conflict(code) do nothing;

insert into public.service_product_rule_versions(product_id,version_no,rules)
select p.id,1,jsonb_build_object(
 'max_seats_per_booking',4,
 'min_departure_lead_minutes',180,
 'max_publish_horizon_days',60,
 'min_confirmation_lead_minutes',60,
 'commitment_pre_departure_buffer_minutes',60,
 'commitment_post_return_buffer_minutes',30,
 'arrival_radius_meters',1000,
 'arrival_max_accuracy_meters',200,
 'arrival_max_location_age_seconds',60,
 'boarding_wait_minutes',10,
 'destination_radius_meters',1500,
 'destination_max_accuracy_meters',200,
 'destination_max_location_age_seconds',60,
 'return_boarding_wait_minutes',10,
 'return_completion_radius_meters',1000,
 'return_completion_max_accuracy_meters',200,
 'return_completion_max_location_age_seconds',60
)
from public.service_products p where p.code='GOMOH_RAAHI_TRIPS'
on conflict(product_id,version_no) do nothing;

create table public.trip_offerings(
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.service_products(id),
 product_rules_version integer not null,
 driver_id uuid not null references public.drivers(id),
 vehicle_id uuid not null references public.vehicles(id),
 origin_market_id uuid not null references public.markets(id),
 origin_location_id uuid not null references public.locations(id),
 destination_location_id uuid not null references public.locations(id),
 departure_at timestamptz not null,
 return_departure_at timestamptz not null,
 offered_seats integer not null check(offered_seats between 1 and 12),
 active_booked_seats integer not null default 0 check(active_booked_seats between 0 and 12),
 price_per_seat_inr integer not null check(price_per_seat_inr>0),
 min_confirmation_seats integer not null check(min_confirmation_seats between 1 and 12),
 confirmation_deadline timestamptz not null,
 itinerary_context text,
 status text not null default 'DRAFT' check(status in ('DRAFT','FILLING','CONFIRMED','UPCOMING','IN_FULFILMENT','COMPLETED','NOT_CONFIRMED','DRIVER_CANCELLED','EXPIRED')),
 commitment_id uuid unique references public.mobility_commitments(id),
 ride_id uuid unique references public.rides(id),
 published_at timestamptz,
 confirmed_at timestamptz,
 not_confirmed_at timestamptz,
 cancelled_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint trip_offerings_product_rules_fk foreign key(product_id,product_rules_version) references public.service_product_rule_versions(product_id,version_no),
 constraint trip_offerings_capacity_check check(active_booked_seats<=offered_seats),
 constraint trip_offerings_threshold_check check(min_confirmation_seats<=offered_seats),
 constraint trip_offerings_times_check check(return_departure_at>departure_at and confirmation_deadline<departure_at),
 constraint trip_offerings_itinerary_check check(itinerary_context is null or char_length(itinerary_context)<=1000)
);

create table public.trip_bookings(
 id uuid primary key default gen_random_uuid(),
 offering_id uuid not null references public.trip_offerings(id),
 passenger_profile_id uuid not null references public.profiles(id),
 seat_count integer not null check(seat_count between 1 and 12),
 price_per_seat_inr integer not null check(price_per_seat_inr>0),
 status text not null default 'FILLING' check(status in ('FILLING','CONFIRMED','CANCELLED','NOT_CONFIRMED','DRIVER_CANCELLED','NO_SHOW','COMPLETED')),
 ride_booking_id uuid unique references public.ride_bookings(id),
 booked_at timestamptz not null default now(),
 cancelled_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create unique index uq_trip_booking_active_passenger on public.trip_bookings(offering_id,passenger_profile_id) where status in ('FILLING','CONFIRMED');
create index idx_trip_offerings_product_rules on public.trip_offerings(product_id,product_rules_version);
create index idx_trip_offerings_driver on public.trip_offerings(driver_id);
create index idx_trip_offerings_vehicle on public.trip_offerings(vehicle_id);
create index idx_trip_offerings_origin_market on public.trip_offerings(origin_market_id);
create index idx_trip_offerings_origin on public.trip_offerings(origin_location_id);
create index idx_trip_offerings_destination on public.trip_offerings(destination_location_id);
create index idx_trip_offerings_status_departure on public.trip_offerings(status,departure_at);
create index idx_trip_bookings_offering on public.trip_bookings(offering_id);
create index idx_trip_bookings_passenger on public.trip_bookings(passenger_profile_id);

alter table public.rides add column trip_offering_id uuid references public.trip_offerings(id);
create unique index uq_rides_trip_offering on public.rides(trip_offering_id) where trip_offering_id is not null;
create index idx_rides_trip_offering on public.rides(trip_offering_id);

alter table public.ride_bookings add column trip_booking_id uuid references public.trip_bookings(id);
create unique index uq_ride_bookings_trip_booking on public.ride_bookings(trip_booking_id) where trip_booking_id is not null;
create index idx_ride_bookings_trip_booking on public.ride_bookings(trip_booking_id);

alter table public.ride_bookings drop constraint ride_booking_source_check;
alter table public.ride_bookings add constraint ride_booking_source_check check(
 ((passenger_request_id is not null)::integer + (outstation_request_id is not null)::integer + (carpool_booking_id is not null)::integer + (trip_booking_id is not null)::integer)=1
);

alter table public.trip_offerings enable row level security;
alter table public.trip_bookings enable row level security;
create policy trip_offerings_no_direct_client_access on public.trip_offerings for all to anon,authenticated using(false) with check(false);
create policy trip_bookings_no_direct_client_access on public.trip_bookings for all to anon,authenticated using(false) with check(false);
revoke all on public.trip_offerings from anon,authenticated;
revoke all on public.trip_bookings from anon,authenticated;