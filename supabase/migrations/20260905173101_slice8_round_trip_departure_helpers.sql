-- Slice 8C: Round Trip fulfilment commands on the existing Fixed Ride.

create or replace function private.driver_depart_fixed_ride(p_ride_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_driver_id uuid:=private.current_driver_id();
  v_idem public.command_idempotency%rowtype;
  v_ride public.rides%rowtype;
  v_service_type text;
  v_next text;
  v_event text;
  v_result jsonb;
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem:=private.claim_user_command('driver_depart_fixed_ride',p_idempotency_key,md5(p_ride_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_ride from public.rides r where r.id=p_ride_id and r.driver_id=v_driver_id for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  select p.service_type into v_service_type from public.service_products p where p.id=v_ride.product_id;
  v_next:=case when v_service_type='FIXED_ROUND_TRIP' then 'OUTBOUND_IN_PROGRESS' else 'IN_PROGRESS' end;
  v_event:=case when v_service_type='FIXED_ROUND_TRIP' then 'OUTBOUND_DEPARTED' else 'RIDE_DEPARTED' end;
  if v_ride.status in ('IN_PROGRESS','OUTBOUND_IN_PROGRESS') then
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status',v_ride.status,'departed_at',v_ride.departed_at);
  elsif v_ride.status<>'READY_TO_DEPART' then raise exception 'RIDE_TRANSITION_INVALID';
  else
    update public.rides set status=v_next,departed_at=now() where id=v_ride.id;
    update public.mobility_commitments set status='ACTIVE' where id=v_ride.commitment_id and status in ('RESERVED','ACTIVE');
    insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state)
    values(v_ride.id,v_event,'DRIVER',auth.uid(),'READY_TO_DEPART',v_next);
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status',v_next,'departed_at',now());
  end if;
  perform private.finish_user_command(v_idem.id,v_result); return v_result;
end; $$;
revoke all on function private.driver_depart_fixed_ride(uuid,text) from public,anon,authenticated;
grant execute on function private.driver_depart_fixed_ride(uuid,text) to authenticated;

create or replace function private.verify_fixed_rule_zone(
  p_ride_id uuid,p_prefix text,p_latitude double precision,p_longitude double precision,
  p_accuracy_meters double precision,p_captured_at timestamptz
)
returns table(zone_id uuid,distance_meters double precision)
language plpgsql security definer stable set search_path='' as $$
declare
  v_rules jsonb;
  v_zone public.market_presence_zones%rowtype;
  v_code text;
  v_radius double precision;
  v_max_accuracy double precision;
  v_max_age integer;
  v_distance double precision;
begin
  if p_prefix not in ('outbound_completion','return_completion') then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;
  select rv.rules into v_rules from public.rides r
  join public.service_product_rule_versions rv on rv.product_id=r.product_id and rv.version_no=r.product_rules_version
  where r.id=p_ride_id;
  if v_rules is null then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;
  v_code:=v_rules->>(p_prefix||'_zone_code');
  v_radius:=(v_rules->>(p_prefix||'_radius_meters'))::double precision;
  v_max_accuracy:=(v_rules->>(p_prefix||'_max_accuracy_meters'))::double precision;
  v_max_age:=(v_rules->>(p_prefix||'_max_location_age_seconds'))::integer;
  if v_code is null or v_radius is null or v_max_accuracy is null or v_max_age is null then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 or p_accuracy_meters<=0
     or p_accuracy_meters>v_max_accuracy or p_captured_at<now()-make_interval(secs=>v_max_age)
     or p_captured_at>now()+interval '30 seconds' then raise exception 'ROUND_TRIP_LOCATION_NOT_VERIFIED'; end if;
  select * into v_zone from public.market_presence_zones z where z.code=v_code and z.is_active;
  if not found then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;
  v_distance:=private.distance_meters(p_latitude,p_longitude,v_zone.latitude,v_zone.longitude);
  if v_distance>v_radius then raise exception 'ROUND_TRIP_LOCATION_NOT_VERIFIED'; end if;
  return query select v_zone.id,v_distance;
end; $$;
revoke all on function private.verify_fixed_rule_zone(uuid,text,double precision,double precision,double precision,timestamptz)
from public,anon,authenticated;

create or replace function private.sync_round_trip_return_expectation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='NO_SHOW' and old.status<>'NO_SHOW' and new.return_status='PENDING'
     and exists (
       select 1 from public.rides r join public.service_products p on p.id=r.product_id
       where r.id=new.ride_id and p.service_type='FIXED_ROUND_TRIP'
     ) then
    new.return_status:='NOT_APPLICABLE';
  end if;
  return new;
end; $$;
revoke all on function private.sync_round_trip_return_expectation() from public,anon,authenticated;
drop trigger if exists sync_round_trip_return_expectation on public.ride_bookings;
create trigger sync_round_trip_return_expectation
before update of status on public.ride_bookings
for each row execute function private.sync_round_trip_return_expectation();
