-- Slice 6A: Fixed execution/completion state and destination proof configuration.

insert into public.service_product_rule_versions(product_id, version_no, rules)
select p.id, 5,
       r.rules || jsonb_build_object(
         'completion_zone_code', 'DHANBAD_CORE',
         'completion_radius_meters', 5000,
         'completion_max_accuracy_meters', 200,
         'completion_max_location_age_seconds', 60
       )
from public.service_products p
join public.service_product_rule_versions r
  on r.product_id=p.id and r.version_no=4
where p.code='GOMOH_DHANBAD_FIXED_OW'
on conflict (product_id, version_no) do nothing;

update public.service_products
set current_rules_version=5
where code='GOMOH_DHANBAD_FIXED_OW';

alter table public.rides
  add column departed_at timestamptz,
  add column completed_at timestamptz,
  add column completion_zone_id uuid references public.market_presence_zones(id),
  add column completion_accuracy_meters double precision;

create index idx_rides_completion_zone
on public.rides(completion_zone_id)
where completion_zone_id is not null;
