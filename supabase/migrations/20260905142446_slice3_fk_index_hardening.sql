-- Slice 3 advisor hardening: cover newly introduced foreign keys.

create index if not exists idx_driver_availability_operating_market
on public.driver_availability(operating_market_id);

create index if not exists idx_fixed_requests_product_rule_version
on public.fixed_passenger_requests(product_id, product_rules_version);
