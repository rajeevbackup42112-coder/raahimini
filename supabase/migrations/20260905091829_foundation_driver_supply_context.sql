-- Raahi Next Foundation 1B: Driver identity, vehicles, trust and Operating Market.

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  home_market_id uuid not null references public.markets(id),
  standing text not null default 'ACTIVE'
    check (standing in ('ACTIVE','TEMPORARILY_RESTRICTED','UNDER_REVIEW','SUSPENDED','DISABLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_number text not null unique,
  vehicle_type text not null check (char_length(vehicle_type) between 2 and 40),
  vehicle_model text not null check (char_length(vehicle_model) between 2 and 80),
  bookable_passenger_capacity integer not null check (bookable_passenger_capacity between 1 and 12),
  status text not null default 'PENDING_VERIFICATION'
    check (status in ('REGISTERED','PENDING_VERIFICATION','ELIGIBLE','UNAVAILABLE','EXPIRED','SUSPENDED','RETIRED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.driver_vehicle_access (
  driver_id uuid not null references public.drivers(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  relationship text not null default 'PRIMARY' check (relationship in ('PRIMARY','AUTHORIZED')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (driver_id, vehicle_id)
);

create table public.driver_active_vehicles (
  driver_id uuid primary key references public.drivers(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id),
  selected_at timestamptz not null default now()
);

create table public.verification_records (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references public.drivers(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  verification_type text not null check (verification_type in
    ('PHONE','DRIVING_LICENCE','DRIVER_PHOTO','VEHICLE_RC','VEHICLE_PHOTOS','PERMIT','FITNESS','INSURANCE','PUC')),
  status text not null default 'NOT_SUBMITTED' check (status in
    ('NOT_SUBMITTED','SUBMITTED','UNDER_REVIEW','VERIFIED','REJECTED','NEEDS_RESUBMISSION','EXPIRED')),
  expires_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((driver_id is not null)::integer + (vehicle_id is not null)::integer = 1)
);

create unique index ux_verification_driver_type
on public.verification_records(driver_id, verification_type)
where driver_id is not null;

create unique index ux_verification_vehicle_type
on public.verification_records(vehicle_id, verification_type)
where vehicle_id is not null;

create table public.driver_operating_markets (
  driver_id uuid primary key references public.drivers(id) on delete cascade,
  market_id uuid not null references public.markets(id),
  verified_at timestamptz not null,
  verification_method text not null check (verification_method in ('GPS','SYSTEM_ARRIVAL','ADMIN_EXCEPTION')),
  verification_accuracy_meters double precision,
  updated_at timestamptz not null default now()
);

create table public.driver_operating_market_events (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  previous_market_id uuid references public.markets(id),
  new_market_id uuid not null references public.markets(id),
  verification_method text not null check (verification_method in ('GPS','SYSTEM_ARRIVAL','ADMIN_EXCEPTION')),
  verification_accuracy_meters double precision,
  occurred_at timestamptz not null default now()
);

create table public.driver_product_preferences (
  driver_id uuid not null references public.drivers(id) on delete cascade,
  product_id uuid not null references public.service_products(id) on delete cascade,
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (driver_id, product_id)
);

create index idx_drivers_home_market on public.drivers(home_market_id, standing);
create index idx_operating_markets_market on public.driver_operating_markets(market_id, verified_at desc);
create index idx_operating_market_events_driver on public.driver_operating_market_events(driver_id, occurred_at desc);
create index idx_driver_product_preferences_product on public.driver_product_preferences(product_id) where is_enabled;

create trigger drivers_set_updated_at before update on public.drivers
for each row execute function private.set_updated_at();
create trigger vehicles_set_updated_at before update on public.vehicles
for each row execute function private.set_updated_at();
create trigger verification_records_set_updated_at before update on public.verification_records
for each row execute function private.set_updated_at();
create trigger operating_markets_set_updated_at before update on public.driver_operating_markets
for each row execute function private.set_updated_at();

create or replace function private.current_driver_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select d.id
  from public.drivers d
  where d.profile_id = (select auth.uid())
  limit 1;
$$;
revoke all on function private.current_driver_id() from public, anon, authenticated;
grant execute on function private.current_driver_id() to authenticated;

alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.driver_vehicle_access enable row level security;
alter table public.driver_active_vehicles enable row level security;
alter table public.verification_records enable row level security;
alter table public.driver_operating_markets enable row level security;
alter table public.driver_operating_market_events enable row level security;
alter table public.driver_product_preferences enable row level security;

revoke all on public.drivers from public, anon, authenticated;
revoke all on public.vehicles from public, anon, authenticated;
revoke all on public.driver_vehicle_access from public, anon, authenticated;
revoke all on public.driver_active_vehicles from public, anon, authenticated;
revoke all on public.verification_records from public, anon, authenticated;
revoke all on public.driver_operating_markets from public, anon, authenticated;
revoke all on public.driver_operating_market_events from public, anon, authenticated;
revoke all on public.driver_product_preferences from public, anon, authenticated;

grant select on public.drivers to authenticated;
grant select on public.vehicles to authenticated;
grant select on public.driver_vehicle_access to authenticated;
grant select on public.driver_active_vehicles to authenticated;
grant select on public.verification_records to authenticated;
grant select on public.driver_operating_markets to authenticated;
grant select on public.driver_operating_market_events to authenticated;
grant select on public.driver_product_preferences to authenticated;

create policy drivers_read_self on public.drivers
for select to authenticated
using (profile_id = (select auth.uid()));

create policy vehicle_access_read_self on public.driver_vehicle_access
for select to authenticated
using (driver_id = (select private.current_driver_id()));

create policy active_vehicle_read_self on public.driver_active_vehicles
for select to authenticated
using (driver_id = (select private.current_driver_id()));

create policy vehicles_read_own_access on public.vehicles
for select to authenticated
using (exists (
  select 1 from public.driver_vehicle_access a
  where a.vehicle_id = vehicles.id
    and a.driver_id = (select private.current_driver_id())
    and a.revoked_at is null
));

create policy verification_records_read_self on public.verification_records
for select to authenticated
using (
  driver_id = (select private.current_driver_id())
  or exists (
    select 1 from public.driver_vehicle_access a
    where a.vehicle_id = verification_records.vehicle_id
      and a.driver_id = (select private.current_driver_id())
      and a.revoked_at is null
  )
);

create policy operating_market_read_self on public.driver_operating_markets
for select to authenticated
using (driver_id = (select private.current_driver_id()));

create policy operating_market_events_read_self on public.driver_operating_market_events
for select to authenticated
using (driver_id = (select private.current_driver_id()));

create policy product_preferences_read_self on public.driver_product_preferences
for select to authenticated
using (driver_id = (select private.current_driver_id()));
