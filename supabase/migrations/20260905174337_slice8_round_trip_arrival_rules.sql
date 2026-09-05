-- Slice 8E: add standard Fixed origin-arrival proof to Round Trip rules.
-- Rule v1 remains immutable; v2 becomes current for future Round Trip rides.

insert into public.service_product_rule_versions(product_id,version_no,rules)
select p.id,2,rv.rules || jsonb_build_object(
  'arrival_zone_code','GOMOH_CORE',
  'arrival_radius_meters',5000,
  'arrival_max_accuracy_meters',200,
  'arrival_max_location_age_seconds',60
)
from public.service_products p
join public.service_product_rule_versions rv on rv.product_id=p.id and rv.version_no=1
where p.code='GOMOH_DHANBAD_FIXED_RT'
on conflict (product_id,version_no) do nothing;

update public.service_products
set current_rules_version=2
where code='GOMOH_DHANBAD_FIXED_RT';