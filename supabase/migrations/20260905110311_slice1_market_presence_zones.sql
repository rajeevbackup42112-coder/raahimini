-- Slice 1A: configurable Market presence verification without retaining exact GPS.

create table public.market_presence_zones (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9_]{2,64}$'),
  label text not null check (char_length(label) between 2 and 120),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_meters integer not null check (radius_meters between 500 and 50000),
  max_accuracy_meters integer not null default 1000
    check (max_accuracy_meters between 10 and 5000),
  max_location_age_seconds integer not null default 180
    check (max_location_age_seconds between 30 and 900),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_market_presence_zones_market
on public.market_presence_zones(market_id) where is_active;

create trigger market_presence_zones_set_updated_at
before update on public.market_presence_zones
for each row execute function private.set_updated_at();

alter table public.market_presence_zones enable row level security;
revoke all on public.market_presence_zones from public, anon, authenticated;
create policy market_presence_zones_internal_locked
on public.market_presence_zones for all to anon, authenticated
using (false) with check (false);

alter table public.driver_operating_markets
  add column verification_zone_id uuid references public.market_presence_zones(id);

alter table public.driver_operating_market_events
  add column verification_zone_id uuid references public.market_presence_zones(id);

create index idx_operating_markets_zone
on public.driver_operating_markets(verification_zone_id)
where verification_zone_id is not null;
create index idx_operating_market_events_zone
on public.driver_operating_market_events(verification_zone_id)
where verification_zone_id is not null;

-- Pilot presence anchors are configuration, not hard-coded business branches.
-- Gomoh anchor: GeoNames populated-place coordinate.
insert into public.market_presence_zones(
  market_id, code, label, latitude, longitude,
  radius_meters, max_accuracy_meters, max_location_age_seconds
)
select id, 'GOMOH_CORE', 'Gomoh operating area',
  23.873549, 86.151601, 6000, 1000, 180
from public.markets where code = 'GOMOH'
on conflict (code) do nothing;

-- Dhanbad anchor: Dhanbad district administration published location coordinate.
insert into public.market_presence_zones(
  market_id, code, label, latitude, longitude,
  radius_meters, max_accuracy_meters, max_location_age_seconds
)
select id, 'DHANBAD_CORE', 'Dhanbad operating area',
  23.795399, 86.427040, 15000, 1000, 180
from public.markets where code = 'DHANBAD'
on conflict (code) do nothing;
