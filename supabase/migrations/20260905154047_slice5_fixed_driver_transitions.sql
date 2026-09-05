-- Slice 5B: canonical Driver fulfilment transitions.

create or replace function private.claim_user_command(
  p_command_name text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.command_idempotency
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.command_idempotency%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  insert into public.command_idempotency(
    actor_kind, actor_profile_id, actor_scope, command_name,
    idempotency_key, request_hash
  ) values (
    'USER', v_uid, 'profile:' || v_uid::text, p_command_name,
    p_idempotency_key, p_request_hash
  ) on conflict (actor_scope, command_name, idempotency_key) do nothing;
  select * into v_row
  from public.command_idempotency i
  where i.actor_scope = 'profile:' || v_uid::text
    and i.command_name = p_command_name
    and i.idempotency_key = p_idempotency_key
  for update;

  if v_row.request_hash <> p_request_hash then
    raise exception 'IDEMPOTENCY_CONFLICT';
  end if;
  return v_row;
end;
$$;

revoke all on function private.claim_user_command(text,text,text)
from public, anon, authenticated;

create or replace function private.finish_user_command(
  p_id uuid,
  p_result jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.command_idempotency
  set status = 'SUCCEEDED', result = p_result, completed_at = now()
  where id = p_id;
$$;

revoke all on function private.finish_user_command(uuid,jsonb)
from public, anon, authenticated;
create or replace function private.driver_acknowledge_fixed_ride(
  p_ride_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver_id uuid := private.current_driver_id();
  v_idem public.command_idempotency%rowtype;
  v_ride public.rides%rowtype;
  v_result jsonb;
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem := private.claim_user_command('driver_acknowledge_fixed_ride', p_idempotency_key, md5(p_ride_id::text));
  if v_idem.status = 'SUCCEEDED' then return v_idem.result; end if;

  select * into v_ride from public.rides r
  where r.id = p_ride_id and r.driver_id = v_driver_id
  for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;

  if v_ride.status = 'DRIVER_ACKNOWLEDGED' then
    v_result := jsonb_build_object('ride_id',v_ride.id,'status',v_ride.status,'acknowledged_at',v_ride.driver_acknowledged_at);
  elsif v_ride.status <> 'MATCHED' then
    raise exception 'RIDE_TRANSITION_INVALID';
  elsif now() > v_ride.driver_ack_deadline then
    raise exception 'DRIVER_ACK_DEADLINE_EXPIRED';
  else
    update public.rides
    set status='DRIVER_ACKNOWLEDGED', driver_acknowledged_at=now()
    where id=v_ride.id;
    insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state)
    values(v_ride.id,'DRIVER_ACKNOWLEDGED','DRIVER',auth.uid(),'MATCHED','DRIVER_ACKNOWLEDGED');
    v_result := jsonb_build_object('ride_id',v_ride.id,'status','DRIVER_ACKNOWLEDGED','acknowledged_at',now());
  end if;

  perform private.finish_user_command(v_idem.id,v_result);
  return v_result;
end;
$$;

revoke all on function private.driver_acknowledge_fixed_ride(uuid,text)
from public, anon, authenticated;

create or replace function public.driver_acknowledge_fixed_ride(p_ride_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.driver_acknowledge_fixed_ride(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_acknowledge_fixed_ride(uuid,text) from public, anon, authenticated;
grant execute on function public.driver_acknowledge_fixed_ride(uuid,text) to authenticated;

create or replace function private.driver_begin_fixed_approach(
  p_ride_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver_id uuid := private.current_driver_id();
  v_idem public.command_idempotency%rowtype;
  v_ride public.rides%rowtype;
  v_result jsonb;
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem := private.claim_user_command('driver_begin_fixed_approach', p_idempotency_key, md5(p_ride_id::text));
  if v_idem.status = 'SUCCEEDED' then return v_idem.result; end if;

  select * into v_ride from public.rides r
  where r.id=p_ride_id and r.driver_id=v_driver_id
  for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;

  if v_ride.status='DRIVER_EN_ROUTE' then
    v_result := jsonb_build_object('ride_id',v_ride.id,'status',v_ride.status,'en_route_at',v_ride.en_route_at);
  elsif v_ride.status <> 'DRIVER_ACKNOWLEDGED' then
    raise exception 'RIDE_TRANSITION_INVALID';
  else
    update public.rides set status='DRIVER_EN_ROUTE', en_route_at=now() where id=v_ride.id;
    update public.mobility_commitments set status='ACTIVE'
    where id=v_ride.commitment_id and status='RESERVED';
    insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state)
    values(v_ride.id,'DRIVER_EN_ROUTE','DRIVER',auth.uid(),'DRIVER_ACKNOWLEDGED','DRIVER_EN_ROUTE');
    v_result := jsonb_build_object('ride_id',v_ride.id,'status','DRIVER_EN_ROUTE','en_route_at',now());
  end if;

  perform private.finish_user_command(v_idem.id,v_result);
  return v_result;
end;
$$;

revoke all on function private.driver_begin_fixed_approach(uuid,text) from public, anon, authenticated;
create or replace function public.driver_begin_fixed_approach(p_ride_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.driver_begin_fixed_approach(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_begin_fixed_approach(uuid,text) from public, anon, authenticated;
grant execute on function public.driver_begin_fixed_approach(uuid,text) to authenticated;
create or replace function private.driver_arrive_fixed_ride(
  p_ride_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_captured_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_driver_id uuid := private.current_driver_id();
  v_idem public.command_idempotency%rowtype;
  v_ride public.rides%rowtype;
  v_rules jsonb;
  v_zone public.market_presence_zones%rowtype;
  v_distance double precision;
  v_max_age integer;
  v_max_accuracy double precision;
  v_radius double precision;
  v_result jsonb;
  v_hash text := md5(concat_ws('|',p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at));
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem := private.claim_user_command('driver_arrive_fixed_ride',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  select * into v_ride from public.rides r
  where r.id=p_ride_id and r.driver_id=v_driver_id
  for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  if v_ride.status='DRIVER_ARRIVED' then
    v_result := jsonb_build_object('ride_id',v_ride.id,'status',v_ride.status,'arrived_at',v_ride.arrived_at);
    perform private.finish_user_command(v_idem.id,v_result);
    return v_result;
  elsif v_ride.status <> 'DRIVER_EN_ROUTE' then
    raise exception 'RIDE_TRANSITION_INVALID';
  end if;

  select rv.rules into v_rules
  from public.service_product_rule_versions rv
  where rv.product_id=v_ride.product_id and rv.version_no=v_ride.product_rules_version;

  v_max_age := (v_rules->>'arrival_max_location_age_seconds')::integer;
  v_max_accuracy := (v_rules->>'arrival_max_accuracy_meters')::double precision;
  v_radius := (v_rules->>'arrival_radius_meters')::double precision;
  if v_max_age is null or v_max_accuracy is null or v_radius is null then
    raise exception 'PRODUCT_CONFIGURATION_INVALID';
  end if;

  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180
     or p_accuracy_meters <= 0 or p_accuracy_meters > v_max_accuracy
     or p_captured_at < now() - make_interval(secs=>v_max_age)
     or p_captured_at > now() + interval '30 seconds' then
    raise exception 'ARRIVAL_LOCATION_NOT_VERIFIED';
  end if;

  select * into v_zone from public.market_presence_zones z
  where z.code=(v_rules->>'arrival_zone_code') and z.is_active;
  if not found then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;

  v_distance := private.distance_meters(p_latitude,p_longitude,v_zone.latitude,v_zone.longitude);
  if v_distance > v_radius then raise exception 'ARRIVAL_LOCATION_NOT_VERIFIED'; end if;
  update public.rides
  set status='DRIVER_ARRIVED', arrived_at=now(),
      arrival_zone_id=v_zone.id,
      arrival_accuracy_meters=p_accuracy_meters
  where id=v_ride.id;

  insert into public.ride_events(
    ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata
  ) values (
    v_ride.id,'DRIVER_ARRIVED','DRIVER',auth.uid(),'DRIVER_EN_ROUTE','DRIVER_ARRIVED',
    jsonb_build_object(
      'arrival_zone_id',v_zone.id,
      'distance_meters',round(v_distance::numeric),
      'accuracy_meters',p_accuracy_meters
    )
  );

  v_result := jsonb_build_object(
    'ride_id',v_ride.id,'status','DRIVER_ARRIVED','arrived_at',now(),
    'distance_meters',round(v_distance::numeric)
  );
  perform private.finish_user_command(v_idem.id,v_result);
  return v_result;
end;
$$;

revoke all on function private.driver_arrive_fixed_ride(uuid,double precision,double precision,double precision,timestamptz,text)
from public, anon, authenticated;
create or replace function public.driver_arrive_fixed_ride(
  p_ride_id uuid,p_latitude double precision,p_longitude double precision,
  p_accuracy_meters double precision,p_captured_at timestamptz,p_idempotency_key text
)
returns jsonb language sql security invoker set search_path=''
as $$ select private.driver_arrive_fixed_ride(p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at,p_idempotency_key); $$;
revoke all on function public.driver_arrive_fixed_ride(uuid,double precision,double precision,double precision,timestamptz,text)
from public, anon, authenticated;
grant execute on function public.driver_arrive_fixed_ride(uuid,double precision,double precision,double precision,timestamptz,text)
to authenticated;

create or replace function private.driver_start_fixed_boarding(
  p_ride_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_driver_id uuid := private.current_driver_id();
  v_idem public.command_idempotency%rowtype;
  v_ride public.rides%rowtype;
  v_wait_minutes integer;
  v_result jsonb;
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem := private.claim_user_command('driver_start_fixed_boarding',p_idempotency_key,md5(p_ride_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  select * into v_ride from public.rides r
  where r.id=p_ride_id and r.driver_id=v_driver_id
  for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;

  if v_ride.status='BOARDING' then
    v_result := jsonb_build_object('ride_id',v_ride.id,'status',v_ride.status,'boarding_deadline',v_ride.boarding_deadline);
  elsif v_ride.status <> 'DRIVER_ARRIVED' then
    raise exception 'RIDE_TRANSITION_INVALID';
  else
    select (rv.rules->>'boarding_wait_minutes')::integer into v_wait_minutes
    from public.service_product_rule_versions rv
    where rv.product_id=v_ride.product_id and rv.version_no=v_ride.product_rules_version;
    if v_wait_minutes is null or v_wait_minutes <= 0 then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;

    update public.rides
    set status='BOARDING', boarding_started_at=now(),
        boarding_deadline=now()+make_interval(mins=>v_wait_minutes)
    where id=v_ride.id;
    insert into public.ride_events(
      ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata
    ) values (
      v_ride.id,'BOARDING_STARTED','DRIVER',auth.uid(),'DRIVER_ARRIVED','BOARDING',
      jsonb_build_object('boarding_wait_minutes',v_wait_minutes)
    );
    v_result := jsonb_build_object(
      'ride_id',v_ride.id,'status','BOARDING',
      'boarding_deadline',now()+make_interval(mins=>v_wait_minutes)
    );
  end if;

  perform private.finish_user_command(v_idem.id,v_result);
  return v_result;
end;
$$;

revoke all on function private.driver_start_fixed_boarding(uuid,text) from public, anon, authenticated;
create or replace function public.driver_start_fixed_boarding(p_ride_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.driver_start_fixed_boarding(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_start_fixed_boarding(uuid,text) from public, anon, authenticated;
grant execute on function public.driver_start_fixed_boarding(uuid,text) to authenticated;
