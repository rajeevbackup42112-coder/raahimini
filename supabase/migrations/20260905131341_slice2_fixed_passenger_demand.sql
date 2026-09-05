-- Slice 2: Passenger search + Fixed One Way demand.
-- Passenger intent is independent of any pre-existing Ride or Driver.

create table public.fixed_passenger_requests (
  id uuid primary key default gen_random_uuid(),
  passenger_profile_id uuid not null references public.profiles(id),
  product_id uuid not null references public.service_products(id),
  product_rules_version integer not null,
  seat_count smallint not null check (seat_count between 1 and 12),
  fare_per_seat_inr integer not null check (fare_per_seat_inr > 0),
  total_fare_inr integer generated always as (fare_per_seat_inr * seat_count) stored,
  boarding_context jsonb not null default '{}'::jsonb check (jsonb_typeof(boarding_context) = 'object'),
  status text not null default 'QUEUED' check (status in (
    'QUEUED','RESERVED','ASSIGNED','PASSENGER_CANCELLED','SUPERSEDED'
  )),
  queued_at timestamptz not null default now(),
  reserved_at timestamptz,
  assigned_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  foreign key (product_id, product_rules_version)
    references public.service_product_rule_versions(product_id, version_no)
);
create unique index ux_fixed_request_active_product
on public.fixed_passenger_requests(passenger_profile_id, product_id)
where status in ('QUEUED','RESERVED');

create index idx_fixed_requests_product_queue
on public.fixed_passenger_requests(product_id, status, queued_at, id)
where status in ('QUEUED','RESERVED');

alter table public.fixed_passenger_requests enable row level security;
revoke all on public.fixed_passenger_requests from public, anon, authenticated;

-- V1 Gomoh Fixed OW already has fare/timer rules. Add the frozen Passenger
-- seat limit as a new immutable rule version instead of hard-coding it in UI.
insert into public.service_product_rule_versions(product_id, version_no, rules)
select p.id, 2,
       r.rules || jsonb_build_object(
         'max_seats_per_request', 4,
         'currency', 'INR'
       )
from public.service_products p
join public.service_product_rule_versions r
  on r.product_id = p.id and r.version_no = 1
where p.code = 'GOMOH_DHANBAD_FIXED_OW'
on conflict (product_id, version_no) do nothing;

update public.service_products
set current_rules_version = 2
where code = 'GOMOH_DHANBAD_FIXED_OW';
create or replace function private.get_search_locations()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'location_id', l.id,
    'code', l.code,
    'name', l.name,
    'kind', l.kind,
    'market_id', l.market_id
  ) order by l.name), '[]'::jsonb)
  from public.locations l
  where l.is_active;
$$;
revoke all on function private.get_search_locations() from public, anon, authenticated;
grant usage on schema private to anon;
grant execute on function private.get_search_locations() to anon, authenticated;

create or replace function public.get_search_locations()
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$ select private.get_search_locations(); $$;
revoke all on function public.get_search_locations() from public, anon, authenticated;
grant execute on function public.get_search_locations() to anon, authenticated;
create or replace function private.get_mobility_options(
  p_origin_location_id uuid,
  p_destination_location_id uuid
)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'product_id', p.id,
    'product_code', p.code,
    'service_type', p.service_type,
    'display_name', p.display_name,
    'public_summary', p.public_summary,
    'origin_location_id', o.id,
    'origin_name', o.name,
    'destination_location_id', d.id,
    'destination_name', d.name,
    'fare_per_seat_inr', (rv.rules ->> 'fare_per_seat_inr')::integer,
    'max_seats_per_request', (rv.rules ->> 'max_seats_per_request')::integer,
    'currency', coalesce(rv.rules ->> 'currency', 'INR'),
    'rules_version', rv.version_no
  ) order by p.display_name), '[]'::jsonb)
  from public.service_products p
  join public.corridors c on c.id = p.corridor_id and c.is_active
  join public.locations o on o.id = c.origin_location_id and o.is_active
  join public.locations d on d.id = c.destination_location_id and d.is_active
  join public.markets m on m.id = p.market_id
  join public.service_product_rule_versions rv
    on rv.product_id = p.id and rv.version_no = p.current_rules_version
  where c.origin_location_id = p_origin_location_id
    and c.destination_location_id = p_destination_location_id
    and p.status in ('PILOT','ACTIVE')
    and m.status in ('PILOT','ACTIVE','SCALING')
    and p.service_type = 'FIXED_ONE_WAY'
    and jsonb_typeof(rv.rules -> 'fare_per_seat_inr') = 'number'
    and jsonb_typeof(rv.rules -> 'max_seats_per_request') = 'number';
$$;
revoke all on function private.get_mobility_options(uuid, uuid) from public, anon, authenticated;
grant execute on function private.get_mobility_options(uuid, uuid) to anon, authenticated;

create or replace function public.get_mobility_options(
  p_origin_location_id uuid,
  p_destination_location_id uuid
)
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$ select private.get_mobility_options(p_origin_location_id, p_destination_location_id); $$;
revoke all on function public.get_mobility_options(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_mobility_options(uuid, uuid) to anon, authenticated;
create or replace function private.get_fixed_product_detail(p_product_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'product_id', p.id,
    'product_code', p.code,
    'display_name', p.display_name,
    'public_summary', p.public_summary,
    'origin_location_id', o.id,
    'origin_name', o.name,
    'destination_location_id', d.id,
    'destination_name', d.name,
    'fare_per_seat_inr', (rv.rules ->> 'fare_per_seat_inr')::integer,
    'max_seats_per_request', (rv.rules ->> 'max_seats_per_request')::integer,
    'currency', coalesce(rv.rules ->> 'currency', 'INR'),
    'rules_version', rv.version_no
  )
  from public.service_products p
  join public.corridors c on c.id = p.corridor_id and c.is_active
  join public.locations o on o.id = c.origin_location_id and o.is_active
  join public.locations d on d.id = c.destination_location_id and d.is_active
  join public.markets m on m.id = p.market_id
  join public.service_product_rule_versions rv
    on rv.product_id = p.id and rv.version_no = p.current_rules_version
  where p.id = p_product_id
    and p.status in ('PILOT','ACTIVE')
    and m.status in ('PILOT','ACTIVE','SCALING')
    and p.service_type = 'FIXED_ONE_WAY'
    and jsonb_typeof(rv.rules -> 'fare_per_seat_inr') = 'number'
    and jsonb_typeof(rv.rules -> 'max_seats_per_request') = 'number';
$$;
revoke all on function private.get_fixed_product_detail(uuid) from public, anon, authenticated;
grant execute on function private.get_fixed_product_detail(uuid) to anon, authenticated;

create or replace function public.get_fixed_product_detail(p_product_id uuid)
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$ select private.get_fixed_product_detail(p_product_id); $$;
revoke all on function public.get_fixed_product_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_fixed_product_detail(uuid) to anon, authenticated;

create or replace function private.get_my_fixed_request(p_request_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'request_id', r.id,
    'product_id', r.product_id,
    'status', r.status,
    'seat_count', r.seat_count,
    'fare_per_seat_inr', r.fare_per_seat_inr,
    'total_fare_inr', r.total_fare_inr,
    'queued_at', r.queued_at,
    'cancelled_at', r.cancelled_at,
    'origin_name', o.name,
    'destination_name', d.name,
    'product_name', p.display_name,
    'rules_version', r.product_rules_version
  )
  from public.fixed_passenger_requests r
  join public.service_products p on p.id = r.product_id
  join public.corridors c on c.id = p.corridor_id
  join public.locations o on o.id = c.origin_location_id
  join public.locations d on d.id = c.destination_location_id
  where r.id = p_request_id
    and r.passenger_profile_id = auth.uid();
$$;
revoke all on function private.get_my_fixed_request(uuid) from public, anon, authenticated;
grant execute on function private.get_my_fixed_request(uuid) to authenticated;

create or replace function public.get_my_fixed_request(p_request_id uuid)
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$ select private.get_my_fixed_request(p_request_id); $$;
revoke all on function public.get_my_fixed_request(uuid) from public, anon, authenticated;
grant execute on function public.get_my_fixed_request(uuid) to authenticated;
create or replace function private.join_fixed_queue(
  p_product_id uuid,
  p_seat_count integer,
  p_boarding_context jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_actor_scope text;
  v_request_hash text;
  v_existing public.command_idempotency%rowtype;
  v_product public.service_products%rowtype;
  v_rules public.service_product_rule_versions%rowtype;
  v_max_seats integer;
  v_fare integer;
  v_request public.fixed_passenger_requests%rowtype;
  v_result jsonb;
begin
  if v_profile_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  if p_boarding_context is null or jsonb_typeof(p_boarding_context) <> 'object' then
    raise exception 'INVALID_BOARDING_CONTEXT';
  end if;
  v_actor_scope := 'profile:' || v_profile_id::text;
  v_request_hash := md5(concat_ws('|',
    p_product_id::text,
    p_seat_count::text,
    p_boarding_context::text
  ));

  insert into public.command_idempotency(
    actor_kind, actor_profile_id, actor_scope,
    command_name, idempotency_key, request_hash
  ) values (
    'USER', v_profile_id, v_actor_scope,
    'join_fixed_queue', p_idempotency_key, v_request_hash
  )
  on conflict (actor_scope, command_name, idempotency_key) do nothing;

  select * into v_existing
  from public.command_idempotency i
  where i.actor_scope = v_actor_scope
    and i.command_name = 'join_fixed_queue'
    and i.idempotency_key = p_idempotency_key
  for update;

  if v_existing.request_hash <> v_request_hash then
    raise exception 'IDEMPOTENCY_CONFLICT';
  end if;
  if v_existing.status = 'SUCCEEDED' then
    return v_existing.result;
  end if;

  if not private.has_capability('PASSENGER') then
    raise exception 'PASSENGER_CAPABILITY_REQUIRED';
  end if;
  select * into v_product
  from public.service_products p
  where p.id = p_product_id
    and p.service_type = 'FIXED_ONE_WAY'
    and p.status in ('PILOT','ACTIVE')
    and p.current_rules_version is not null
    and exists (
      select 1 from public.markets m
      where m.id = p.market_id
        and m.status in ('PILOT','ACTIVE','SCALING')
    );
  if not found then raise exception 'FIXED_PRODUCT_NOT_AVAILABLE'; end if;

  select * into v_rules
  from public.service_product_rule_versions r
  where r.product_id = v_product.id
    and r.version_no = v_product.current_rules_version;
  if not found then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;

  if jsonb_typeof(v_rules.rules -> 'fare_per_seat_inr') <> 'number'
     or jsonb_typeof(v_rules.rules -> 'max_seats_per_request') <> 'number' then
    raise exception 'PRODUCT_CONFIGURATION_INVALID';
  end if;

  v_fare := (v_rules.rules ->> 'fare_per_seat_inr')::integer;
  v_max_seats := (v_rules.rules ->> 'max_seats_per_request')::integer;
  if v_fare <= 0 or v_max_seats < 1 or v_max_seats > 12 then
    raise exception 'PRODUCT_CONFIGURATION_INVALID';
  end if;
  if p_seat_count < 1 or p_seat_count > v_max_seats then
    raise exception 'INVALID_SEAT_COUNT';
  end if;
  -- Serialize Passenger demand creation so two different idempotency keys
  -- cannot create competing active requests for the same Product.
  perform 1 from public.profiles p
  where p.id = v_profile_id
  for update;

  if exists (
    select 1 from public.fixed_passenger_requests r
    where r.passenger_profile_id = v_profile_id
      and r.product_id = p_product_id
      and r.status in ('QUEUED','RESERVED')
  ) then
    raise exception 'ACTIVE_FIXED_REQUEST_EXISTS';
  end if;

  insert into public.fixed_passenger_requests(
    passenger_profile_id, product_id, product_rules_version,
    seat_count, fare_per_seat_inr, boarding_context
  ) values (
    v_profile_id, v_product.id, v_rules.version_no,
    p_seat_count, v_fare, p_boarding_context
  ) returning * into v_request;

  v_result := jsonb_build_object(
    'request_id', v_request.id,
    'product_id', v_request.product_id,
    'status', v_request.status,
    'seat_count', v_request.seat_count,
    'fare_per_seat_inr', v_request.fare_per_seat_inr,
    'total_fare_inr', v_request.total_fare_inr,
    'queued_at', v_request.queued_at,
    'rules_version', v_request.product_rules_version
  );
  update public.command_idempotency
  set status = 'SUCCEEDED', result = v_result,
      completed_at = now()
  where id = v_existing.id;

  return v_result;
end;
$$;

revoke all on function private.join_fixed_queue(uuid, integer, jsonb, text)
from public, anon, authenticated;
grant execute on function private.join_fixed_queue(uuid, integer, jsonb, text)
to authenticated;

create or replace function public.join_fixed_queue(
  p_product_id uuid,
  p_seat_count integer,
  p_boarding_context jsonb,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.join_fixed_queue(
    p_product_id, p_seat_count, p_boarding_context, p_idempotency_key
  );
$$;
revoke all on function public.join_fixed_queue(uuid, integer, jsonb, text)
from public, anon, authenticated;
grant execute on function public.join_fixed_queue(uuid, integer, jsonb, text)
to authenticated;
create or replace function private.cancel_fixed_queue_request(
  p_request_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_actor_scope text;
  v_request_hash text;
  v_existing public.command_idempotency%rowtype;
  v_request public.fixed_passenger_requests%rowtype;
  v_result jsonb;
begin
  if v_profile_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_actor_scope := 'profile:' || v_profile_id::text;
  v_request_hash := md5(p_request_id::text);

  insert into public.command_idempotency(
    actor_kind, actor_profile_id, actor_scope,
    command_name, idempotency_key, request_hash
  ) values (
    'USER', v_profile_id, v_actor_scope,
    'cancel_fixed_queue_request', p_idempotency_key, v_request_hash
  )
  on conflict (actor_scope, command_name, idempotency_key) do nothing;
  select * into v_existing
  from public.command_idempotency i
  where i.actor_scope = v_actor_scope
    and i.command_name = 'cancel_fixed_queue_request'
    and i.idempotency_key = p_idempotency_key
  for update;

  if v_existing.request_hash <> v_request_hash then
    raise exception 'IDEMPOTENCY_CONFLICT';
  end if;
  if v_existing.status = 'SUCCEEDED' then
    return v_existing.result;
  end if;

  if not private.has_capability('PASSENGER') then
    raise exception 'PASSENGER_CAPABILITY_REQUIRED';
  end if;

  select * into v_request
  from public.fixed_passenger_requests r
  where r.id = p_request_id
    and r.passenger_profile_id = v_profile_id
  for update;

  if not found then raise exception 'FIXED_REQUEST_NOT_FOUND'; end if;

  if v_request.status = 'PASSENGER_CANCELLED' then
    v_result := jsonb_build_object(
      'request_id', v_request.id,
      'status', v_request.status,
      'cancelled_at', v_request.cancelled_at
    );
  elsif v_request.status = 'QUEUED' then
    update public.fixed_passenger_requests
    set status = 'PASSENGER_CANCELLED',
        cancelled_at = now(),
        cancel_reason = 'PASSENGER_REQUESTED'
    where id = v_request.id
    returning * into v_request;

    v_result := jsonb_build_object(
      'request_id', v_request.id,
      'status', v_request.status,
      'cancelled_at', v_request.cancelled_at
    );
  else
    raise exception 'FIXED_REQUEST_NOT_CANCELLABLE';
  end if;

  update public.command_idempotency
  set status = 'SUCCEEDED', result = v_result,
      completed_at = now()
  where id = v_existing.id;

  return v_result;
end;
$$;

revoke all on function private.cancel_fixed_queue_request(uuid, text)
from public, anon, authenticated;
grant execute on function private.cancel_fixed_queue_request(uuid, text)
to authenticated;

create or replace function public.cancel_fixed_queue_request(
  p_request_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_fixed_queue_request(
    p_request_id, p_idempotency_key
  );
$$;
revoke all on function public.cancel_fixed_queue_request(uuid, text)
from public, anon, authenticated;
grant execute on function public.cancel_fixed_queue_request(uuid, text)
to authenticated;
