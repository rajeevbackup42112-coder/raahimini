-- Slice 4 advisor hardening: cover all new foreign-key access paths.

create index idx_ride_events_actor
on public.ride_events(actor_profile_id)
where actor_profile_id is not null;

create index idx_rides_origin_market
on public.rides(origin_market_id);

create index idx_rides_origin_location
on public.rides(origin_location_id);

create index idx_rides_destination_location
on public.rides(destination_location_id);

create index idx_rides_vehicle
on public.rides(vehicle_id);

create index idx_rides_product_rules
on public.rides(product_id, product_rules_version);
