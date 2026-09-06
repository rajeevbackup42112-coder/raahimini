create index if not exists idx_outstation_agreements_quote on public.outstation_agreements(quote_id);
create index if not exists idx_outstation_driver_ignores_driver on public.outstation_driver_ignores(driver_id);
create index if not exists idx_outstation_requests_accepted_agreement on public.outstation_requests(accepted_agreement_id) where accepted_agreement_id is not null;
create index if not exists idx_outstation_requests_destination_location on public.outstation_requests(destination_location_id) where destination_location_id is not null;
create index if not exists idx_outstation_requests_origin_location on public.outstation_requests(origin_location_id) where origin_location_id is not null;
create index if not exists idx_outstation_requests_product_rules on public.outstation_requests(product_id,product_rules_version);
