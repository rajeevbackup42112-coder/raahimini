-- Slice 3: explicit Driver preference + Fixed FIFO availability.
-- Driver availability is independent of Passenger identity and is always Product-scoped.

create table public.driver_availability (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id),
  vehicle_id uuid not null references public.vehicles(id),
  product_id uuid not null references public.service_products(id),
  operating_market_id uuid not null references public.markets(id),
  status text not null default 'QUEUED' check (status in (
    'QUEUED','RESERVED','ASSIGNED','WITHDRAWN','INELIGIBLE'
  )),
  queued_at timestamptz not null default now(),
  reserved_at timestamptz,
  assigned_at timestamptz,
  exited_at timestamptz,
  exit_reason text,
  created_at timestamptz not null default now()
);

create unique index ux_driver_availability_active_product
on public.driver_availability(driver_id, product_id)
where status in ('QUEUED','RESERVED');

create unique index ux_vehicle_availability_active_product
on public.driver_availability(vehicle_id, product_id)
where status in ('QUEUED','RESERVED');
create index idx_driver_availability_product_queue
on public.driver_availability(product_id, status, queued_at, id)
where status in ('QUEUED','RESERVED');

alter table public.driver_availability enable row level security;
revoke all on public.driver_availability from public, anon, authenticated;

create policy driver_availability_no_direct_client_access
on public.driver_availability
for all to anon, authenticated
using (false)
with check (false);

create or replace function private.withdraw_incompatible_driver_availability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.market_id is distinct from new.market_id then
    update public.driver_availability a
    set status = 'WITHDRAWN', exited_at = now(),
        exit_reason = 'OPERATING_MARKET_CHANGED'
    from public.service_products p
    where a.driver_id = new.driver_id
      and a.product_id = p.id
      and a.status = 'QUEUED'
      and p.market_id <> new.market_id;
  end if;
  return new;
end;
$$;
revoke all on function private.withdraw_incompatible_driver_availability()
from public, anon, authenticated;

drop trigger if exists withdraw_incompatible_driver_availability
on public.driver_operating_markets;
create trigger withdraw_incompatible_driver_availability
after update of market_id on public.driver_operating_markets
for each row execute function private.withdraw_incompatible_driver_availability();

create or replace function private.set_driver_product_preference(
  p_product_id uuid,
  p_enabled boolean,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_driver public.drivers%rowtype;
  v_actor_scope text;
  v_hash text;
  v_idem public.command_idempotency%rowtype;
  v_result jsonb;
begin
  if v_profile_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  if not private.has_capability('DRIVER') then
    raise exception 'DRIVER_CAPABILITY_REQUIRED';
  end if;

  select * into v_driver from public.drivers d
  where d.profile_id = v_profile_id for update;
  if not found then raise exception 'DRIVER_PROFILE_REQUIRED'; end if;
  if v_driver.standing <> 'ACTIVE' then raise exception 'DRIVER_STANDING_NOT_ACTIVE'; end if;

  if not exists (
    select 1 from public.service_products p
    join public.markets m on m.id = p.market_id
    where p.id = p_product_id
      and p.service_type = 'FIXED_ONE_WAY'
      and p.status in ('PILOT','ACTIVE')
      and m.status in ('PILOT','ACTIVE','SCALING')
  ) then raise exception 'FIXED_PRODUCT_NOT_AVAILABLE'; end if;

  v_actor_scope := 'profile:' || v_profile_id::text;
  v_hash := md5(concat_ws('|', p_product_id::text, p_enabled::text));
  insert into public.command_idempotency(
    actor_kind, actor_profile_id, actor_scope, command_name,
    idempotency_key, request_hash
  ) values (
    'USER', v_profile_id, v_actor_scope, 'set_driver_product_preference',
    p_idempotency_key, v_hash
  ) on conflict (actor_scope, command_name, idempotency_key) do nothing;
  select * into v_idem from public.command_idempotency i
  where i.actor_scope = v_actor_scope
    and i.command_name = 'set_driver_product_preference'
    and i.idempotency_key = p_idempotency_key
  for update;

  if v_idem.request_hash <> v_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if v_idem.status = 'SUCCEEDED' then return v_idem.result; end if;

  if not p_enabled and exists (
    select 1 from public.driver_availability a
    where a.driver_id = v_driver.id
      and a.product_id = p_product_id
      and a.status = 'RESERVED'
  ) then raise exception 'DRIVER_AVAILABILITY_RESERVED'; end if;

  insert into public.driver_product_preferences(driver_id, product_id, is_enabled, updated_at)
  values (v_driver.id, p_product_id, p_enabled, now())
  on conflict (driver_id, product_id) do update
    set is_enabled = excluded.is_enabled, updated_at = now();

  if not p_enabled then
    update public.driver_availability
    set status = 'WITHDRAWN', exited_at = now(), exit_reason = 'PREFERENCE_DISABLED'
    where driver_id = v_driver.id and product_id = p_product_id and status = 'QUEUED';
  end if;

  v_result := jsonb_build_object('product_id', p_product_id, 'is_enabled', p_enabled);
  update public.command_idempotency set status='SUCCEEDED', result=v_result, completed_at=now()
  where id = v_idem.id;
  return v_result;
end;
$$;
revoke all on function private.set_driver_product_preference(uuid, boolean, text)
from public, anon, authenticated;
grant execute on function private.set_driver_product_preference(uuid, boolean, text)
to authenticated;

create or replace function public.set_driver_product_preference(
  p_product_id uuid, p_enabled boolean, p_idempotency_key text
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.set_driver_product_preference(p_product_id, p_enabled, p_idempotency_key);
$$;
revoke all on function public.set_driver_product_preference(uuid, boolean, text)
from public, anon, authenticated;
grant execute on function public.set_driver_product_preference(uuid, boolean, text)
to authenticated;

create or replace function private.join_fixed_driver_queue(
  p_product_id uuid,
  p_vehicle_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_driver public.drivers%rowtype;
  v_product public.service_products%rowtype;
  v_operating public.driver_operating_markets%rowtype;
  v_actor_scope text;
  v_hash text;
  v_idem public.command_idempotency%rowtype;
  v_availability public.driver_availability%rowtype;
  v_result jsonb;
begin
  if v_profile_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  if not private.has_capability('DRIVER') then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;

  v_actor_scope := 'profile:' || v_profile_id::text;
  v_hash := md5(concat_ws('|', p_product_id::text, p_vehicle_id::text));
  insert into public.command_idempotency(
    actor_kind, actor_profile_id, actor_scope, command_name,
    idempotency_key, request_hash
  ) values (
    'USER', v_profile_id, v_actor_scope, 'join_fixed_driver_queue',
    p_idempotency_key, v_hash
  ) on conflict (actor_scope, command_name, idempotency_key) do nothing;

  select * into v_idem from public.command_idempotency i
  where i.actor_scope = v_actor_scope
    and i.command_name = 'join_fixed_driver_queue'
    and i.idempotency_key = p_idempotency_key
  for update;
  if v_idem.request_hash <> v_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if v_idem.status = 'SUCCEEDED' then return v_idem.result; end if;

  select * into v_driver from public.drivers d
  where d.profile_id = v_profile_id for update;
  if not found then raise exception 'DRIVER_PROFILE_REQUIRED'; end if;
  if v_driver.standing <> 'ACTIVE' then raise exception 'DRIVER_STANDING_NOT_ACTIVE'; end if;

  select * into v_product from public.service_products p
  where p.id = p_product_id and p.service_type = 'FIXED_ONE_WAY'
    and p.status in ('PILOT','ACTIVE');
  if not found then raise exception 'FIXED_PRODUCT_NOT_AVAILABLE'; end if;
  select * into v_operating from public.driver_operating_markets om
  where om.driver_id = v_driver.id for update;
  if not found then raise exception 'OPERATING_MARKET_REQUIRED'; end if;
  if v_operating.market_id <> v_product.market_id then
    raise exception 'OPERATING_MARKET_MISMATCH';
  end if;

  if not exists (
    select 1 from public.driver_product_preferences pref
    where pref.driver_id = v_driver.id
      and pref.product_id = p_product_id
      and pref.is_enabled
  ) then raise exception 'PRODUCT_PREFERENCE_REQUIRED'; end if;

  if not exists (
    select 1 from public.driver_active_vehicles av
    join public.driver_vehicle_access dva
      on dva.driver_id = av.driver_id and dva.vehicle_id = av.vehicle_id
    join public.vehicles v on v.id = av.vehicle_id
    where av.driver_id = v_driver.id
      and av.vehicle_id = p_vehicle_id
      and dva.revoked_at is null
      and v.status = 'ELIGIBLE'
  ) then raise exception 'ACTIVE_ELIGIBLE_VEHICLE_REQUIRED'; end if;

  if exists (
    select 1 from (values ('PHONE'),('DRIVING_LICENCE'),('DRIVER_PHOTO')) req(t)
    where not exists (
      select 1 from public.verification_records vr
      where vr.driver_id = v_driver.id
        and vr.verification_type = req.t
        and vr.status = 'VERIFIED'
        and (vr.expires_at is null or vr.expires_at > now())
    )
  ) then raise exception 'DRIVER_VERIFICATION_REQUIRED'; end if;

  if exists (
    select 1 from (values ('VEHICLE_RC'),('VEHICLE_PHOTOS')) req(t)
    where not exists (
      select 1 from public.verification_records vr
      where vr.vehicle_id = p_vehicle_id
        and vr.verification_type = req.t
        and vr.status = 'VERIFIED'
        and (vr.expires_at is null or vr.expires_at > now())
    )
  ) then raise exception 'VEHICLE_VERIFICATION_REQUIRED'; end if;
  if exists (
    select 1 from public.mobility_commitments c
    where (c.driver_id = v_driver.id or c.vehicle_id = p_vehicle_id)
      and c.status in ('RESERVED','ACTIVE')
      and c.starts_at <= now()
      and c.ends_at > now()
  ) then raise exception 'ACTIVE_COMMITMENT_CONFLICT'; end if;

  if exists (
    select 1 from public.driver_availability a
    where a.driver_id = v_driver.id
      and a.product_id = p_product_id
      and a.status in ('QUEUED','RESERVED')
  ) then raise exception 'ACTIVE_DRIVER_AVAILABILITY_EXISTS'; end if;

  insert into public.driver_availability(
    driver_id, vehicle_id, product_id, operating_market_id
  ) values (
    v_driver.id, p_vehicle_id, p_product_id, v_operating.market_id
  ) returning * into v_availability;

  v_result := jsonb_build_object(
    'availability_id', v_availability.id,
    'product_id', v_availability.product_id,
    'vehicle_id', v_availability.vehicle_id,
    'status', v_availability.status,
    'queued_at', v_availability.queued_at
  );
  update public.command_idempotency
  set status='SUCCEEDED', result=v_result, completed_at=now()
  where id = v_idem.id;
  return v_result;
end;
$$;

revoke all on function private.join_fixed_driver_queue(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function private.join_fixed_driver_queue(uuid, uuid, text)
to authenticated;
create or replace function public.join_fixed_driver_queue(
  p_product_id uuid, p_vehicle_id uuid, p_idempotency_key text
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.join_fixed_driver_queue(p_product_id, p_vehicle_id, p_idempotency_key);
$$;
revoke all on function public.join_fixed_driver_queue(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.join_fixed_driver_queue(uuid, uuid, text)
to authenticated;

create or replace function private.leave_fixed_driver_queue(
  p_availability_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_driver public.drivers%rowtype;
  v_actor_scope text;
  v_hash text;
  v_idem public.command_idempotency%rowtype;
  v_availability public.driver_availability%rowtype;
  v_result jsonb;
begin
  if v_profile_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  if not private.has_capability('DRIVER') then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  select * into v_driver from public.drivers d
  where d.profile_id = v_profile_id;
  if not found then raise exception 'DRIVER_PROFILE_REQUIRED'; end if;

  v_actor_scope := 'profile:' || v_profile_id::text;
  v_hash := md5(p_availability_id::text);
  insert into public.command_idempotency(
    actor_kind, actor_profile_id, actor_scope, command_name,
    idempotency_key, request_hash
  ) values (
    'USER', v_profile_id, v_actor_scope, 'leave_fixed_driver_queue',
    p_idempotency_key, v_hash
  ) on conflict (actor_scope, command_name, idempotency_key) do nothing;

  select * into v_idem from public.command_idempotency i
  where i.actor_scope = v_actor_scope
    and i.command_name = 'leave_fixed_driver_queue'
    and i.idempotency_key = p_idempotency_key
  for update;
  if v_idem.request_hash <> v_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if v_idem.status = 'SUCCEEDED' then return v_idem.result; end if;

  select * into v_availability from public.driver_availability a
  where a.id = p_availability_id and a.driver_id = v_driver.id
  for update;
  if not found then raise exception 'DRIVER_AVAILABILITY_NOT_FOUND'; end if;

  if v_availability.status = 'QUEUED' then
    update public.driver_availability
    set status='WITHDRAWN', exited_at=now(), exit_reason='DRIVER_LEFT_QUEUE'
    where id = v_availability.id returning * into v_availability;
  elsif v_availability.status not in ('WITHDRAWN','INELIGIBLE') then
    raise exception 'DRIVER_AVAILABILITY_NOT_LEAVABLE';
  end if;

  v_result := jsonb_build_object(
    'availability_id', v_availability.id,
    'status', v_availability.status,
    'exited_at', v_availability.exited_at
  );
  update public.command_idempotency
  set status='SUCCEEDED', result=v_result, completed_at=now()
  where id = v_idem.id;
  return v_result;
end;
$$;

revoke all on function private.leave_fixed_driver_queue(uuid, text)
from public, anon, authenticated;
grant execute on function private.leave_fixed_driver_queue(uuid, text)
to authenticated;

create or replace function public.leave_fixed_driver_queue(
  p_availability_id uuid, p_idempotency_key text
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.leave_fixed_driver_queue(p_availability_id, p_idempotency_key);
$$;
revoke all on function public.leave_fixed_driver_queue(uuid, text)
from public, anon, authenticated;
grant execute on function public.leave_fixed_driver_queue(uuid, text)
to authenticated;

create or replace function private.get_fixed_driver_workspace()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_driver public.drivers%rowtype;
  v_operating public.driver_operating_markets%rowtype;
  v_vehicle_id uuid;
  v_vehicle_name text;
  v_products jsonb;
begin
  if v_profile_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if not private.has_capability('DRIVER') then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;

  select * into v_driver from public.drivers d
  where d.profile_id = v_profile_id;
  if not found then raise exception 'DRIVER_PROFILE_REQUIRED'; end if;

  select * into v_operating from public.driver_operating_markets om
  where om.driver_id = v_driver.id;

  select av.vehicle_id, concat(v.vehicle_model, ' · ', v.registration_number)
  into v_vehicle_id, v_vehicle_name
  from public.driver_active_vehicles av
  join public.driver_vehicle_access dva
    on dva.driver_id = av.driver_id and dva.vehicle_id = av.vehicle_id and dva.revoked_at is null
  join public.vehicles v on v.id = av.vehicle_id
  where av.driver_id = v_driver.id;

  if v_operating.driver_id is null then
    return jsonb_build_object(
      'driver_id', v_driver.id,
      'standing', v_driver.standing,
      'operating_market_id', null,
      'active_vehicle_id', v_vehicle_id,
      'active_vehicle_name', v_vehicle_name,
      'products', '[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'product_id', p.id,
    'product_code', p.code,
    'display_name', p.display_name,
    'origin_name', o.name,
    'destination_name', dest.name,
    'preference_enabled', coalesce(pref.is_enabled, false),
    'queued_request_count', (
      select count(*) from public.fixed_passenger_requests r
      where r.product_id = p.id and r.status = 'QUEUED'
    ),
    'queued_seat_count', (
      select coalesce(sum(r.seat_count), 0) from public.fixed_passenger_requests r
      where r.product_id = p.id and r.status = 'QUEUED'
    ),
    'oldest_queued_at', (
      select min(r.queued_at) from public.fixed_passenger_requests r
      where r.product_id = p.id and r.status = 'QUEUED'
    ),
    'availability_id', a.id,
    'availability_status', a.status,
    'availability_queued_at', a.queued_at
  ) order by p.display_name), '[]'::jsonb)
  into v_products
  from public.service_products p
  join public.corridors c on c.id = p.corridor_id and c.is_active
  join public.locations o on o.id = c.origin_location_id
  join public.locations dest on dest.id = c.destination_location_id
  left join public.driver_product_preferences pref
    on pref.driver_id = v_driver.id and pref.product_id = p.id
  left join public.driver_availability a
    on a.driver_id = v_driver.id and a.product_id = p.id
   and a.status in ('QUEUED','RESERVED')
  where p.market_id = v_operating.market_id
    and p.service_type = 'FIXED_ONE_WAY'
    and p.status in ('PILOT','ACTIVE');

  return jsonb_build_object(
    'driver_id', v_driver.id,
    'standing', v_driver.standing,
    'operating_market_id', v_operating.market_id,
    'active_vehicle_id', v_vehicle_id,
    'active_vehicle_name', v_vehicle_name,
    'products', v_products
  );
end;
$$;

revoke all on function private.get_fixed_driver_workspace()
from public, anon, authenticated;
grant execute on function private.get_fixed_driver_workspace() to authenticated;

create or replace function public.get_fixed_driver_workspace()
returns jsonb language sql security invoker stable set search_path = '' as $$
  select private.get_fixed_driver_workspace();
$$;
revoke all on function public.get_fixed_driver_workspace()
from public, anon, authenticated;
grant execute on function public.get_fixed_driver_workspace() to authenticated;
