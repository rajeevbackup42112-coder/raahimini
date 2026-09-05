-- Raahi Next deterministic local/dev catalog seed.
-- No user accounts or production credentials belong here.

insert into public.markets(code, slug, name, state_code, country_code, status)
values
  ('GOMOH', 'gomoh', 'Gomoh', 'JH', 'IN', 'PILOT'),
  ('DHANBAD', 'dhanbad', 'Dhanbad', 'JH', 'IN', 'PREPARING')
on conflict (code) do update set
  slug = excluded.slug,
  name = excluded.name,
  state_code = excluded.state_code,
  country_code = excluded.country_code,
  status = excluded.status;

insert into public.locations(code, name, kind, market_id, state_code, country_code, is_active)
select 'GOMOH', 'Gomoh', 'TOWN', m.id, 'JH', 'IN', true
from public.markets m where m.code = 'GOMOH'
on conflict (code) do update set market_id = excluded.market_id, is_active = true;

insert into public.locations(code, name, kind, market_id, state_code, country_code, is_active)
select 'DHANBAD', 'Dhanbad', 'CITY', m.id, 'JH', 'IN', true
from public.markets m where m.code = 'DHANBAD'
on conflict (code) do update set market_id = excluded.market_id, is_active = true;

insert into public.locations(code, name, kind, state_code, country_code, is_active)
values
  ('RANCHI', 'Ranchi', 'CITY', 'JH', 'IN', true),
  ('RANCHI_AIRPORT', 'Birsa Munda Airport, Ranchi', 'AIRPORT', 'JH', 'IN', true)
on conflict (code) do update set name = excluded.name, kind = excluded.kind, is_active = true;

insert into public.corridors(code, origin_location_id, destination_location_id, is_active)
select 'GOMOH_DHANBAD', o.id, d.id, true
from public.locations o, public.locations d
where o.code = 'GOMOH' and d.code = 'DHANBAD'
on conflict (code) do update set is_active = true;

insert into public.corridors(code, origin_location_id, destination_location_id, is_active)
select 'DHANBAD_GOMOH', o.id, d.id, true
from public.locations o, public.locations d
where o.code = 'DHANBAD' and d.code = 'GOMOH'
on conflict (code) do update set is_active = true;

insert into public.corridors(code, origin_location_id, destination_location_id, is_active)
select 'GOMOH_RANCHI_AIRPORT', o.id, d.id, true
from public.locations o, public.locations d
where o.code = 'GOMOH' and d.code = 'RANCHI_AIRPORT'
on conflict (code) do update set is_active = true;

insert into public.corridors(code, origin_location_id, destination_location_id, is_active)
select 'DHANBAD_RANCHI', o.id, d.id, true
from public.locations o, public.locations d
where o.code = 'DHANBAD' and d.code = 'RANCHI'
on conflict (code) do update set is_active = true;

insert into public.service_products(code, market_id, corridor_id, service_type, display_name, status, public_summary)
select 'GOMOH_DHANBAD_FIXED_OW', m.id, c.id, 'FIXED_ONE_WAY',
       'Gomoh to Dhanbad — Shared One Way', 'PILOT', 'Per-seat shared ride forming from verified demand and supply.'
from public.markets m, public.corridors c
where m.code = 'GOMOH' and c.code = 'GOMOH_DHANBAD'
on conflict (code) do update set status = excluded.status, display_name = excluded.display_name;

insert into public.service_products(code, market_id, corridor_id, service_type, display_name, status, public_summary)
select 'DHANBAD_GOMOH_FIXED_OW', m.id, c.id, 'FIXED_ONE_WAY',
       'Dhanbad to Gomoh — Shared One Way', 'DRAFT', 'Prepared reverse-origin product; not launched yet.'
from public.markets m, public.corridors c
where m.code = 'DHANBAD' and c.code = 'DHANBAD_GOMOH'
on conflict (code) do update set status = excluded.status, display_name = excluded.display_name;

insert into public.service_product_rules(product_id, rules, rules_version)
select p.id,
  jsonb_build_object(
    'capacity_policy', 'FULL_CAPACITY',
    'fare_per_seat_inr', 150,
    'driver_ack_seconds', 120,
    'boarding_wait_minutes', 10,
    'refill_window_minutes', 5
  ),
  1
from public.service_products p
where p.code = 'GOMOH_DHANBAD_FIXED_OW'
on conflict (product_id) do update set
  rules = excluded.rules,
  rules_version = excluded.rules_version,
  updated_at = now();
