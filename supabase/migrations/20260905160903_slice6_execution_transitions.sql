-- Slice 6B: canonical departure and completion transitions.

create or replace function private.driver_depart_fixed_ride(
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
  v_result jsonb;
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem := private.claim_user_command('driver_depart_fixed_ride',p_idempotency_key,md5(p_ride_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  select * into v_ride from public.rides r
  where r.id=p_ride_id and r.driver_id=v_driver_id for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  if v_ride.status='IN_PROGRESS' then
    v_result := jsonb_build_object('ride_id',v_ride.id,'status',v_ride.status,'departed_at',v_ride.departed_at);
  elsif v_ride.status<>'READY_TO_DEPART' then
    raise exception 'RIDE_TRANSITION_INVALID';
  else
    update public.rides set status='IN_PROGRESS',departed_at=now() where id=v_ride.id;
    update public.mobility_commitments set status='ACTIVE' where id=v_ride.commitment_id and status in ('RESERVED','ACTIVE');
    insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state)
    values(v_ride.id,'RIDE_DEPARTED','DRIVER',auth.uid(),'READY_TO_DEPART','IN_PROGRESS');
    v_result := jsonb_build_object('ride_id',v_ride.id,'status','IN_PROGRESS','departed_at',now());
  end if;
  perform private.finish_user_command(v_idem.id,v_result);
  return v_result;
end;
$$;
revoke all on function private.driver_depart_fixed_ride(uuid,text) from public, anon, authenticated;
grant execute on function private.driver_depart_fixed_ride(uuid,text) to authenticated;

create or replace function public.driver_depart_fixed_ride(p_ride_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.driver_depart_fixed_ride(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_depart_fixed_ride(uuid,text) from public, anon, authenticated;
grant execute on function public.driver_depart_fixed_ride(uuid,text) to authenticated;

create or replace function private.driver_complete_fixed_ride(
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
  v_idem := private.claim_user_command('driver_complete_fixed_ride',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  select * into v_ride from public.rides r
  where r.id=p_ride_id and r.driver_id=v_driver_id for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  if v_ride.status='COMPLETED' then
    v_result := jsonb_build_object('ride_id',v_ride.id,'status',v_ride.status,'completed_at',v_ride.completed_at);
    perform private.finish_user_command(v_idem.id,v_result);
    return v_result;
  elsif v_ride.status<>'IN_PROGRESS' then
    raise exception 'RIDE_TRANSITION_INVALID';
  end if;

  select rv.rules into v_rules from public.service_product_rule_versions rv
  where rv.product_id=v_ride.product_id and rv.version_no=v_ride.product_rules_version;
  v_max_age := (v_rules->>'completion_max_location_age_seconds')::integer;
  v_max_accuracy := (v_rules->>'completion_max_accuracy_meters')::double precision;
  v_radius := (v_rules->>'completion_radius_meters')::double precision;
  if v_max_age is null or v_max_accuracy is null or v_radius is null then
    raise exception 'PRODUCT_CONFIGURATION_INVALID';
  end if;

  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180
     or p_accuracy_meters<=0 or p_accuracy_meters>v_max_accuracy
     or p_captured_at<now()-make_interval(secs=>v_max_age)
     or p_captured_at>now()+interval '30 seconds' then
    raise exception 'COMPLETION_LOCATION_NOT_VERIFIED';
  end if;
  select * into v_zone from public.market_presence_zones z
  where z.code=(v_rules->>'completion_zone_code') and z.is_active;
  if not found then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;

  v_distance := private.distance_meters(p_latitude,p_longitude,v_zone.latitude,v_zone.longitude);
  if v_distance>v_radius then raise exception 'COMPLETION_LOCATION_NOT_VERIFIED'; end if;

  update public.rides
  set status='COMPLETED', completed_at=now(), completion_zone_id=v_zone.id,
      completion_accuracy_meters=p_accuracy_meters
  where id=v_ride.id;
  update public.ride_bookings set status='COMPLETED'
  where ride_id=v_ride.id and status='BOARDED';
  update public.mobility_commitments set status='COMPLETED'
  where id=v_ride.commitment_id and status in ('RESERVED','ACTIVE');
  insert into public.ride_events(
    ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata
  ) values (
    v_ride.id,'RIDE_COMPLETED','DRIVER',auth.uid(),'IN_PROGRESS','COMPLETED',
    jsonb_build_object('completion_zone_id',v_zone.id,'distance_meters',round(v_distance::numeric),'accuracy_meters',p_accuracy_meters)
  );

  v_result := jsonb_build_object('ride_id',v_ride.id,'status','COMPLETED','completed_at',now(),'destination_zone',v_zone.label);
  perform private.finish_user_command(v_idem.id,v_result);
  return v_result;
end;
$$;

revoke all on function private.driver_complete_fixed_ride(uuid,double precision,double precision,double precision,timestamptz,text)
from public, anon, authenticated;
grant execute on function private.driver_complete_fixed_ride(uuid,double precision,double precision,double precision,timestamptz,text) to authenticated;

create or replace function public.driver_complete_fixed_ride(
  p_ride_id uuid,p_latitude double precision,p_longitude double precision,
  p_accuracy_meters double precision,p_captured_at timestamptz,p_idempotency_key text
)
returns jsonb language sql security invoker set search_path=''
as $$ select private.driver_complete_fixed_ride(p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at,p_idempotency_key); $$;
revoke all on function public.driver_complete_fixed_ride(uuid,double precision,double precision,double precision,timestamptz,text)
from public, anon, authenticated;
grant execute on function public.driver_complete_fixed_ride(uuid,double precision,double precision,double precision,timestamptz,text) to authenticated;
