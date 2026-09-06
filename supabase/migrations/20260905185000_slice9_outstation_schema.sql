-- Slice 9A: clean Outstation request / quote / agreement model.

insert into public.service_products(code,market_id,corridor_id,service_type,display_name,status,public_summary)
select 'GOMOH_OUTSTATION',m.id,null,'OUTSTATION','Gomoh Outstation','PILOT',
       'Request a verified private car for an outstation journey from Gomoh.'
from public.markets m where m.code='GOMOH'
on conflict (code) do nothing;

insert into public.service_product_rule_versions(product_id,version_no,rules)
select p.id,1,jsonb_build_object(
  'max_passengers_per_request',8,
  'quote_validity_minutes',60,
  'min_departure_lead_minutes',30,
  'max_request_horizon_days',60,
  'pre_departure_buffer_minutes',30,
  'post_return_buffer_minutes',30,
  'one_way_commitment_minutes',720,
  'boarding_wait_minutes',10
)
from public.service_products p where p.code='GOMOH_OUTSTATION'
on conflict (product_id,version_no) do nothing;

update public.service_products set current_rules_version=1
where code='GOMOH_OUTSTATION';

create table public.driver_planned_market_availability (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id),
  market_id uuid not null references public.markets(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CANCELLED','EXPIRED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at>starts_at)
);
create index idx_planned_market_availability_driver on public.driver_planned_market_availability(driver_id,status,starts_at);
create index idx_planned_market_availability_market on public.driver_planned_market_availability(market_id,status,starts_at);

create table public.outstation_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.service_products(id),
  product_rules_version integer not null,
  passenger_profile_id uuid not null references public.profiles(id),
  origin_market_id uuid not null references public.markets(id),
  origin_location_id uuid references public.locations(id),
  destination_location_id uuid references public.locations(id),
  destination_text text not null,
  travel_type text not null check (travel_type in ('ONE_WAY','ROUND_TRIP')),
  departure_at timestamptz not null,
  return_at timestamptz,
  passenger_count integer not null check (passenger_count between 1 and 12),
  passenger_note text,
  status text not null default 'OPEN' check (status in ('OPEN','REOPENED','CONFIRMED','CANCELLED','EXPIRED','COMPLETED')),
  accepted_agreement_id uuid,
  recovery_count integer not null default 0 check (recovery_count>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  completed_at timestamptz,
  check ((travel_type='ONE_WAY' and return_at is null) or (travel_type='ROUND_TRIP' and return_at>departure_at))
);alter table public.outstation_requests
  add constraint outstation_requests_product_rule_version_fk
  foreign key (product_id,product_rules_version)
  references public.service_product_rule_versions(product_id,version_no);
create index idx_outstation_requests_passenger on public.outstation_requests(passenger_profile_id,created_at desc);
create index idx_outstation_requests_origin_status on public.outstation_requests(origin_market_id,status,departure_at);

create table public.outstation_driver_ignores (
  request_id uuid not null references public.outstation_requests(id) on delete cascade,
  driver_id uuid not null references public.drivers(id),
  ignored_at timestamptz not null default now(),
  primary key (request_id,driver_id)
);

create table public.outstation_quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.outstation_requests(id) on delete cascade,
  driver_id uuid not null references public.drivers(id),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ACCEPTED','NOT_SELECTED','WITHDRAWN','CLOSED')),
  current_revision_no integer not null default 0 check (current_revision_no>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(request_id,driver_id)
);
create index idx_outstation_quotes_driver on public.outstation_quotes(driver_id,status,updated_at desc);
create index idx_outstation_quotes_request on public.outstation_quotes(request_id,status,updated_at desc);create table public.outstation_quote_revisions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.outstation_quotes(id) on delete cascade,
  revision_no integer not null check (revision_no>0),
  vehicle_id uuid not null references public.vehicles(id),
  total_price_inr integer not null check (total_price_inr>0),
  includes_tolls boolean not null default false,
  includes_parking boolean not null default false,
  commercial_note text,
  valid_until timestamptz not null,
  submitted_at timestamptz not null default now(),
  unique(quote_id,revision_no)
);
create index idx_outstation_quote_revisions_vehicle on public.outstation_quote_revisions(vehicle_id);

create table public.outstation_agreements (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.outstation_requests(id),
  quote_id uuid not null references public.outstation_quotes(id),
  quote_revision_id uuid not null unique references public.outstation_quote_revisions(id),
  driver_id uuid not null references public.drivers(id),
  vehicle_id uuid not null references public.vehicles(id),
  commitment_id uuid unique references public.mobility_commitments(id),
  total_price_inr integer not null check (total_price_inr>0),
  terms_snapshot jsonb not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','DRIVER_CANCELLED','PASSENGER_CANCELLED','COMPLETED')),
  accepted_at timestamptz not null default now(),
  cancelled_at timestamptz,
  completed_at timestamptz
);
create unique index outstation_one_active_agreement_per_request
  on public.outstation_agreements(request_id) where status='ACTIVE';alter table public.outstation_requests
  add constraint outstation_requests_accepted_agreement_fk
  foreign key (accepted_agreement_id) references public.outstation_agreements(id)
  deferrable initially deferred;
create index idx_outstation_agreements_request on public.outstation_agreements(request_id,accepted_at desc);
create index idx_outstation_agreements_driver on public.outstation_agreements(driver_id,status,accepted_at desc);
create index idx_outstation_agreements_vehicle on public.outstation_agreements(vehicle_id,status);

create or replace function private.protect_outstation_quote_revision()
returns trigger language plpgsql set search_path=''
as $$ begin raise exception 'OUTSTATION_QUOTE_REVISION_IMMUTABLE'; end; $$;
revoke all on function private.protect_outstation_quote_revision() from public,anon,authenticated;
create trigger protect_outstation_quote_revision
before update or delete on public.outstation_quote_revisions
for each row execute function private.protect_outstation_quote_revision();

create trigger set_planned_market_availability_updated_at
before update on public.driver_planned_market_availability
for each row execute function private.set_updated_at();
create trigger set_outstation_requests_updated_at
before update on public.outstation_requests
for each row execute function private.set_updated_at();
create trigger set_outstation_quotes_updated_at
before update on public.outstation_quotes
for each row execute function private.set_updated_at();alter table public.driver_planned_market_availability enable row level security;
alter table public.outstation_requests enable row level security;
alter table public.outstation_driver_ignores enable row level security;
alter table public.outstation_quotes enable row level security;
alter table public.outstation_quote_revisions enable row level security;
alter table public.outstation_agreements enable row level security;

revoke all on public.driver_planned_market_availability from public,anon,authenticated;
revoke all on public.outstation_requests from public,anon,authenticated;
revoke all on public.outstation_driver_ignores from public,anon,authenticated;
revoke all on public.outstation_quotes from public,anon,authenticated;
revoke all on public.outstation_quote_revisions from public,anon,authenticated;
revoke all on public.outstation_agreements from public,anon,authenticated;

create policy planned_market_availability_no_direct_client_access
on public.driver_planned_market_availability for all to anon,authenticated using(false) with check(false);
create policy outstation_requests_no_direct_client_access
on public.outstation_requests for all to anon,authenticated using(false) with check(false);
create policy outstation_ignores_no_direct_client_access
on public.outstation_driver_ignores for all to anon,authenticated using(false) with check(false);
create policy outstation_quotes_no_direct_client_access
on public.outstation_quotes for all to anon,authenticated using(false) with check(false);
create policy outstation_quote_revisions_no_direct_client_access
on public.outstation_quote_revisions for all to anon,authenticated using(false) with check(false);
create policy outstation_agreements_no_direct_client_access
on public.outstation_agreements for all to anon,authenticated using(false) with check(false);