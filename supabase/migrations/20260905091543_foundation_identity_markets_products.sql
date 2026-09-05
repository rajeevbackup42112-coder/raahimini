-- Raahi Next Foundation 1A: identity, markets, locations, corridors, products.
-- Clean schema: no legacy role, trip, active-car or route assumptions.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_capabilities (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  capability text not null check (capability in ('PASSENGER','DRIVER','ADMIN')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (profile_id, capability)
);

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]{2,32}$'),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name text not null check (char_length(name) between 2 and 100),
  state_code text not null default 'JH',
  country_code text not null default 'IN',
  status text not null default 'DISCOVERED'
    check (status in ('DISCOVERED','PREPARING','PILOT','ACTIVE','SCALING','PAUSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]{2,48}$'),
  name text not null check (char_length(name) between 2 and 120),
  kind text not null default 'PLACE'
    check (kind in ('TOWN','CITY','AIRPORT','STATION','LANDMARK','PLACE')),
  market_id uuid references public.markets(id),
  state_code text,
  country_code text not null default 'IN',
  latitude double precision,
  longitude double precision,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or
         (latitude between -90 and 90 and longitude between -180 and 180))
);

create table public.corridors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]{2,64}$'),
  origin_location_id uuid not null references public.locations(id),
  destination_location_id uuid not null references public.locations(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (origin_location_id, destination_location_id),
  check (origin_location_id <> destination_location_id)
);

create table public.service_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]{2,80}$'),
  market_id uuid not null references public.markets(id),
  corridor_id uuid references public.corridors(id),
  service_type text not null check (service_type in
    ('FIXED_ONE_WAY','FIXED_ROUND_TRIP','OUTSTATION','CARPOOL','RAAHI_TRIP')),
  display_name text not null check (char_length(display_name) between 2 and 120),
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PILOT','ACTIVE','PAUSED','RETIRED')),
  public_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (service_type in ('OUTSTATION','CARPOOL','RAAHI_TRIP') or corridor_id is not null)
);

create table public.service_product_rules (
  product_id uuid primary key references public.service_products(id) on delete cascade,
  rules jsonb not null default '{}'::jsonb,
  rules_version integer not null default 1 check (rules_version > 0),
  updated_at timestamptz not null default now()
);

create index idx_locations_market on public.locations(market_id) where is_active;
create index idx_corridors_origin on public.corridors(origin_location_id) where is_active;
create index idx_corridors_destination on public.corridors(destination_location_id) where is_active;
create index idx_service_products_market on public.service_products(market_id, service_type, status);
create index idx_service_products_corridor on public.service_products(corridor_id) where corridor_id is not null;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger markets_set_updated_at before update on public.markets
for each row execute function private.set_updated_at();
create trigger locations_set_updated_at before update on public.locations
for each row execute function private.set_updated_at();
create trigger corridors_set_updated_at before update on public.corridors
for each row execute function private.set_updated_at();
create trigger service_products_set_updated_at before update on public.service_products
for each row execute function private.set_updated_at();

create or replace function private.has_capability(required_capability text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_capabilities c
    where c.profile_id = (select auth.uid())
      and c.capability = required_capability
      and c.revoked_at is null
  );
$$;
revoke all on function private.has_capability(text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.has_capability(text) to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, display_name, phone)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 100),
    new.phone
  )
  on conflict (id) do nothing;

  insert into public.account_capabilities(profile_id, capability)
  values (new.id, 'PASSENGER')
  on conflict (profile_id, capability) do update
    set revoked_at = null;

  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.account_capabilities enable row level security;
alter table public.markets enable row level security;
alter table public.locations enable row level security;
alter table public.corridors enable row level security;
alter table public.service_products enable row level security;
alter table public.service_product_rules enable row level security;

revoke all on public.profiles from public, anon, authenticated;
revoke all on public.account_capabilities from public, anon, authenticated;
revoke all on public.markets from public, anon, authenticated;
revoke all on public.locations from public, anon, authenticated;
revoke all on public.corridors from public, anon, authenticated;
revoke all on public.service_products from public, anon, authenticated;
revoke all on public.service_product_rules from public, anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.account_capabilities to authenticated;
grant select on public.markets to anon, authenticated;
grant select on public.locations to anon, authenticated;
grant select on public.corridors to anon, authenticated;
grant select on public.service_products to anon, authenticated;

create policy profiles_read_self on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

create policy capabilities_read_self on public.account_capabilities
for select to authenticated
using ((select auth.uid()) = profile_id);

create policy markets_read_live_catalog on public.markets
for select to anon, authenticated
using (status in ('PILOT','ACTIVE','SCALING'));

create policy locations_read_active_catalog on public.locations
for select to anon, authenticated
using (is_active);

create policy corridors_read_active_catalog on public.corridors
for select to anon, authenticated
using (is_active);

create policy products_read_live_catalog on public.service_products
for select to anon, authenticated
using (status in ('PILOT','ACTIVE'));
