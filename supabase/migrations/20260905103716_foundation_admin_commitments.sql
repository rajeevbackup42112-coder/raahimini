-- Raahi Next Foundation 1C: scoped administration, feature flags, commitments, audit.

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

create table public.admin_scope_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  permission text not null check (permission in (
    'MARKET_OPERATIONS','STATE_OPERATIONS','TRUST_SAFETY','VERIFICATION',
    'SUPPORT','LOCAL_COMMERCE','PLATFORM_ADMIN'
  )),
  scope_type text not null check (scope_type in ('MARKET','STATE','PLATFORM')),
  market_id uuid references public.markets(id),
  state_code text,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (
    (scope_type = 'MARKET' and market_id is not null and state_code is null)
    or (scope_type = 'STATE' and market_id is null and state_code is not null)
    or (scope_type = 'PLATFORM' and market_id is null and state_code is null)
  )
);

create unique index ux_admin_active_market_scope
on public.admin_scope_assignments(profile_id, permission, market_id)
where revoked_at is null and scope_type = 'MARKET';

create unique index ux_admin_active_state_scope
on public.admin_scope_assignments(profile_id, permission, state_code)
where revoked_at is null and scope_type = 'STATE';

create unique index ux_admin_active_platform_scope
on public.admin_scope_assignments(profile_id, permission)
where revoked_at is null and scope_type = 'PLATFORM';

create table public.market_feature_flags (
  market_id uuid not null references public.markets(id) on delete cascade,
  flag_key text not null check (flag_key ~ '^[a-z0-9_]{2,80}$'),
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (market_id, flag_key)
);

create table public.mobility_commitments (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id),
  vehicle_id uuid not null references public.vehicles(id),
  product_id uuid references public.service_products(id),
  origin_market_id uuid not null references public.markets(id),
  source_type text not null check (source_type in
    ('FIXED_RIDE','OUTSTATION','CARPOOL','RAAHI_TRIP','SYSTEM_RESERVATION')),
  source_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'RESERVED'
    check (status in ('RESERVED','ACTIVE','COMPLETED','CANCELLED','RELEASED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (source_type, source_id)
);

alter table public.mobility_commitments
add constraint mobility_commitments_no_driver_overlap
exclude using gist (
  driver_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
)
where (status in ('RESERVED','ACTIVE'));

alter table public.mobility_commitments
add constraint mobility_commitments_no_vehicle_overlap
exclude using gist (
  vehicle_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
)
where (status in ('RESERVED','ACTIVE'));

create index idx_commitments_market_time
on public.mobility_commitments(origin_market_id, starts_at, ends_at)
where status in ('RESERVED','ACTIVE');

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id),
  market_id uuid references public.markets(id),
  action text not null check (char_length(action) between 2 and 120),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index idx_audit_events_entity
on public.audit_events(entity_type, entity_id, occurred_at desc);
create index idx_audit_events_market
on public.audit_events(market_id, occurred_at desc) where market_id is not null;

create trigger mobility_commitments_set_updated_at
before update on public.mobility_commitments
for each row execute function private.set_updated_at();

create or replace function private.has_admin_permission(
  required_permission text,
  target_market_id uuid default null
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_capabilities c
    join public.admin_scope_assignments a on a.profile_id = c.profile_id
    where c.profile_id = (select auth.uid())
      and c.capability = 'ADMIN'
      and c.revoked_at is null
      and a.revoked_at is null
      and (a.permission = required_permission or a.permission = 'PLATFORM_ADMIN')
      and (
        a.scope_type = 'PLATFORM'
        or (target_market_id is not null and a.scope_type = 'MARKET' and a.market_id = target_market_id)
        or (target_market_id is not null and a.scope_type = 'STATE' and exists (
          select 1 from public.markets m
          where m.id = target_market_id and m.state_code = a.state_code
        ))
      )
  );
$$;
revoke all on function private.has_admin_permission(text, uuid) from public, anon, authenticated;
grant execute on function private.has_admin_permission(text, uuid) to authenticated;

alter table public.admin_scope_assignments enable row level security;
alter table public.market_feature_flags enable row level security;
alter table public.mobility_commitments enable row level security;
alter table public.audit_events enable row level security;

revoke all on public.admin_scope_assignments from public, anon, authenticated;
revoke all on public.market_feature_flags from public, anon, authenticated;
revoke all on public.mobility_commitments from public, anon, authenticated;
revoke all on public.audit_events from public, anon, authenticated;

grant select on public.admin_scope_assignments to authenticated;
grant select on public.mobility_commitments to authenticated;

create policy admin_scopes_read_self on public.admin_scope_assignments
for select to authenticated
using (profile_id = (select auth.uid()));

create policy commitments_read_own_driver on public.mobility_commitments
for select to authenticated
using (driver_id = (select private.current_driver_id()));
