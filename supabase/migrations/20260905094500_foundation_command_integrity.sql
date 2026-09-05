-- Raahi Next Foundation 1D: command idempotency, product-rule history,
-- and active Vehicle relationship integrity.

create table public.command_idempotency (
  id uuid primary key default gen_random_uuid(),
  actor_kind text not null check (actor_kind in ('USER','SYSTEM')),
  actor_profile_id uuid references public.profiles(id),
  actor_scope text not null check (char_length(actor_scope) between 2 and 160),
  command_name text not null check (char_length(command_name) between 2 and 120),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  request_hash text not null check (char_length(request_hash) between 16 and 128),
  status text not null default 'IN_PROGRESS'
    check (status in ('IN_PROGRESS','SUCCEEDED','FAILED')),
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((actor_kind = 'USER' and actor_profile_id is not null)
      or (actor_kind = 'SYSTEM' and actor_profile_id is null)),
  unique (actor_scope, command_name, idempotency_key)
);

create index idx_command_idempotency_created
on public.command_idempotency(created_at desc);

alter table public.command_idempotency enable row level security;
revoke all on public.command_idempotency from public, anon, authenticated;
-- Replace the mutable one-row product rules store with immutable rule versions.
create table public.service_product_rule_versions (
  product_id uuid not null references public.service_products(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  rules jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (product_id, version_no)
);

insert into public.service_product_rule_versions(product_id, version_no, rules)
select product_id, rules_version, rules
from public.service_product_rules
on conflict (product_id, version_no) do nothing;

alter table public.service_products
  add column current_rules_version integer;

update public.service_products p
set current_rules_version = r.rules_version
from public.service_product_rules r
where r.product_id = p.id;

alter table public.service_products
  add constraint service_products_current_rules_fk
  foreign key (id, current_rules_version)
  references public.service_product_rule_versions(product_id, version_no)
  deferrable initially deferred;
create or replace function private.protect_product_rule_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'SERVICE_PRODUCT_RULE_VERSION_IMMUTABLE';
end;
$$;
revoke all on function private.protect_product_rule_version() from public, anon, authenticated;

create trigger protect_product_rule_version
before update or delete on public.service_product_rule_versions
for each row execute function private.protect_product_rule_version();

alter table public.service_product_rule_versions enable row level security;
revoke all on public.service_product_rule_versions from public, anon, authenticated;

drop table public.service_product_rules;

-- An active Vehicle selection must refer to a Driver/Vehicle relationship.
alter table public.driver_active_vehicles
  add constraint driver_active_vehicle_access_fk
  foreign key (driver_id, vehicle_id)
  references public.driver_vehicle_access(driver_id, vehicle_id);
create or replace function private.enforce_selected_vehicle_access()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_revoked_at timestamptz;
begin
  select a.revoked_at into v_revoked_at
  from public.driver_vehicle_access a
  where a.driver_id = new.driver_id and a.vehicle_id = new.vehicle_id;

  if not found or v_revoked_at is not null then
    raise exception 'ACTIVE_VEHICLE_REQUIRES_CURRENT_ACCESS';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_selected_vehicle_access() from public, anon, authenticated;

create trigger enforce_selected_vehicle_access
before insert or update on public.driver_active_vehicles
for each row execute function private.enforce_selected_vehicle_access();
create or replace function private.prevent_selected_vehicle_access_revocation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.revoked_at is null and new.revoked_at is not null
     and exists (
       select 1 from public.driver_active_vehicles av
       where av.driver_id = new.driver_id and av.vehicle_id = new.vehicle_id
     ) then
    raise exception 'CLEAR_ACTIVE_VEHICLE_BEFORE_REVOKING_ACCESS';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_selected_vehicle_access_revocation() from public, anon, authenticated;

create trigger prevent_selected_vehicle_access_revocation
before update of revoked_at on public.driver_vehicle_access
for each row execute function private.prevent_selected_vehicle_access_revocation();

comment on column public.profiles.phone is
  'Convenience contact copy only. Verified phone authority comes from trusted Auth/verification state.';
