-- Slice 1B: canonical Driver Operating Market projection + mutation command.

create or replace function private.distance_meters(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 6371000.0 * 2.0 * asin(sqrt(least(1.0,
    power(sin(radians(lat2 - lat1) / 2.0), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lon2 - lon1) / 2.0), 2)
  )));
$$;
revoke all on function private.distance_meters(double precision, double precision, double precision, double precision)
from public, anon, authenticated;

create or replace function public.get_my_drive_context()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_driver public.drivers%rowtype;
  v_home_name text;
  v_operating jsonb;
  v_markets jsonb;
begin
  if v_profile_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if not private.has_capability('DRIVER') then
    raise exception 'DRIVER_CAPABILITY_REQUIRED';
  end if;

  select * into v_driver
  from public.drivers d
  where d.profile_id = v_profile_id;
  if not found then
    raise exception 'DRIVER_PROFILE_REQUIRED';
  end if;

  select m.name into v_home_name
  from public.markets m where m.id = v_driver.home_market_id;

  select jsonb_build_object(
    'market_id', om.market_id,
    'market_name', m.name,
    'verified_at', om.verified_at,
    'verification_method', om.verification_method,
    'verification_accuracy_meters', om.verification_accuracy_meters
  ) into v_operating
  from public.driver_operating_markets om
  join public.markets m on m.id = om.market_id
  where om.driver_id = v_driver.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'market_id', m.id,
    'market_name', m.name,
    'status', m.status
  ) order by m.name), '[]'::jsonb)
  into v_markets
  from public.markets m
  where m.status in ('PREPARING','PILOT','ACTIVE','SCALING')
    and exists (
      select 1 from public.market_presence_zones z
      where z.market_id = m.id and z.is_active
    );

  return jsonb_build_object(
    'driver_id', v_driver.id,
    'standing', v_driver.standing,
    'home_market', jsonb_build_object(
      'market_id', v_driver.home_market_id,
      'market_name', v_home_name
    ),
    'operating_market', v_operating,
    'available_markets', v_markets
  );
end;
$$;
revoke all on function public.get_my_drive_context() from public, anon, authenticated;
grant execute on function public.get_my_drive_context() to authenticated;

create or replace function public.driver_set_operating_market(
  p_market_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_captured_at timestamptz,
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
  v_market public.markets%rowtype;
  v_zone public.market_presence_zones%rowtype;
  v_previous_market_id uuid;
  v_request_hash text;
  v_actor_scope text;
  v_existing public.command_idempotency%rowtype;
  v_result jsonb;
begin
  if v_profile_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  -- Claim/serialize the idempotency identity before time-sensitive validation.
  -- A later retry of a completed command must return its original result even
  -- after the supplied GPS evidence has naturally aged out.
  v_actor_scope := 'profile:' || v_profile_id::text;
  v_request_hash := md5(concat_ws('|',
    p_market_id::text,
    p_latitude::text,
    p_longitude::text,
    p_accuracy_meters::text,
    p_captured_at::text
  ));

  insert into public.command_idempotency(
    actor_kind, actor_profile_id, actor_scope,
    command_name, idempotency_key, request_hash
  ) values (
    'USER', v_profile_id, v_actor_scope,
    'driver_set_operating_market', p_idempotency_key, v_request_hash
  )
  on conflict (actor_scope, command_name, idempotency_key) do nothing;

  select * into v_existing
  from public.command_idempotency i
  where i.actor_scope = v_actor_scope
    and i.command_name = 'driver_set_operating_market'
    and i.idempotency_key = p_idempotency_key
  for update;

  if v_existing.request_hash <> v_request_hash then
    raise exception 'IDEMPOTENCY_CONFLICT';
  end if;
  if v_existing.status = 'SUCCEEDED' then
    return v_existing.result;
  end if;

  if p_latitude not between -90 and 90
     or p_longitude not between -180 and 180
     or p_accuracy_meters <= 0 then
    raise exception 'INVALID_LOCATION_EVIDENCE';
  end if;

  if not private.has_capability('DRIVER') then
    raise exception 'DRIVER_CAPABILITY_REQUIRED';
  end if;

  select * into v_driver
  from public.drivers d
  where d.profile_id = v_profile_id
  for update;
  if not found then
    raise exception 'DRIVER_PROFILE_REQUIRED';
  end if;
  if v_driver.standing <> 'ACTIVE' then
    raise exception 'DRIVER_STANDING_NOT_ACTIVE';
  end if;

  select * into v_market
  from public.markets m
  where m.id = p_market_id
    and m.status in ('PREPARING','PILOT','ACTIVE','SCALING');
  if not found then
    raise exception 'MARKET_NOT_ELIGIBLE';
  end if;

  select z.* into v_zone
  from public.market_presence_zones z
  where z.market_id = p_market_id
    and z.is_active
    and p_accuracy_meters <= z.max_accuracy_meters
    and p_captured_at >= now() - make_interval(secs => z.max_location_age_seconds)
    and p_captured_at <= now() + interval '30 seconds'
    and private.distance_meters(
      p_latitude, p_longitude, z.latitude, z.longitude
    ) <= z.radius_meters
  order by private.distance_meters(
    p_latitude, p_longitude, z.latitude, z.longitude
  )
  limit 1;

  if not found then
    raise exception 'LOCATION_NOT_VERIFIED';
  end if;

  select om.market_id into v_previous_market_id
  from public.driver_operating_markets om
  where om.driver_id = v_driver.id
  for update;

  if exists (
    select 1
    from public.mobility_commitments c
    where c.driver_id = v_driver.id
      and c.status in ('RESERVED','ACTIVE')
      and c.starts_at <= now()
      and c.ends_at > now()
      and c.origin_market_id <> p_market_id
  ) then
    raise exception 'ACTIVE_COMMITMENT_CONFLICT';
  end if;



  -- Driver Availability does not exist until Slice 3. When it is introduced,
  -- incompatible uncommitted availability must be cleared in this transaction.
  insert into public.driver_operating_markets(
    driver_id, market_id, verified_at, verification_method,
    verification_accuracy_meters, verification_zone_id
  ) values (
    v_driver.id, p_market_id, p_captured_at, 'GPS',
    p_accuracy_meters, v_zone.id
  )
  on conflict (driver_id) do update set
    market_id = excluded.market_id,
    verified_at = excluded.verified_at,
    verification_method = excluded.verification_method,
    verification_accuracy_meters = excluded.verification_accuracy_meters,
    verification_zone_id = excluded.verification_zone_id,
    updated_at = now();

  insert into public.driver_operating_market_events(
    driver_id, previous_market_id, new_market_id,
    verification_method, verification_accuracy_meters,
    verification_zone_id, occurred_at
  ) values (
    v_driver.id, v_previous_market_id, p_market_id,
    'GPS', p_accuracy_meters, v_zone.id, now()
  );

  v_result := jsonb_build_object(
    'driver_id', v_driver.id,
    'market_id', p_market_id,
    'market_name', v_market.name,
    'verified_at', p_captured_at,
    'verification_method', 'GPS',
    'changed', v_previous_market_id is distinct from p_market_id
  );

  update public.command_idempotency
  set status = 'SUCCEEDED', result = v_result, completed_at = now()
  where actor_scope = v_actor_scope
    and command_name = 'driver_set_operating_market'
    and idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

revoke all on function public.driver_set_operating_market(
  uuid, double precision, double precision, double precision, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.driver_set_operating_market(
  uuid, double precision, double precision, double precision, timestamptz, text
) to authenticated;
