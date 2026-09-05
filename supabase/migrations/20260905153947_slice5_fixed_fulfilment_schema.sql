-- Slice 5A: Fixed fulfilment lifecycle state and Product arrival configuration.

insert into public.service_product_rule_versions(product_id, version_no, rules)
select p.id, 4,
       r.rules || jsonb_build_object(
         'arrival_zone_code', 'GOMOH_CORE',
         'arrival_radius_meters', 1000,
         'arrival_max_accuracy_meters', 200,
         'arrival_max_location_age_seconds', 60
       )
from public.service_products p
join public.service_product_rule_versions r
  on r.product_id = p.id and r.version_no = 3
where p.code = 'GOMOH_DHANBAD_FIXED_OW'
on conflict (product_id, version_no) do nothing;

update public.service_products
set current_rules_version = 4
where code = 'GOMOH_DHANBAD_FIXED_OW';

alter table public.rides
  add column driver_acknowledged_at timestamptz,
  add column en_route_at timestamptz,
  add column arrived_at timestamptz,
  add column arrival_zone_id uuid references public.market_presence_zones(id),
  add column arrival_accuracy_meters double precision,
  add column boarding_started_at timestamptz;
alter table public.rides
  add column boarding_deadline timestamptz,
  add column refill_deadline timestamptz,
  add column ready_to_depart_at timestamptz;

create index idx_rides_arrival_zone
on public.rides(arrival_zone_id)
where arrival_zone_id is not null;
