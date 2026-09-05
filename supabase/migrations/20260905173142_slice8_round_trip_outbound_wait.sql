create or replace function private.driver_complete_fixed_round_trip_outbound(
  p_ride_id uuid,p_latitude double precision,p_longitude double precision,
  p_accuracy_meters double precision,p_captured_at timestamptz,p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_driver_id uuid:=private.current_driver_id();
  v_idem public.command_idempotency%rowtype;
  v_ride public.rides%rowtype;
  v_service_type text;
  v_wait integer;
  v_zone_id uuid;
  v_distance double precision;
  v_not_before timestamptz;
  v_result jsonb;
  v_hash text:=md5(concat_ws('|',p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at));
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem:=private.claim_user_command('driver_complete_fixed_round_trip_outbound',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_ride from public.rides r where r.id=p_ride_id and r.driver_id=v_driver_id for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  select p.service_type into v_service_type from public.service_products p where p.id=v_ride.product_id;
  if v_service_type<>'FIXED_ROUND_TRIP' then raise exception 'RIDE_TRANSITION_INVALID'; end if;
  if v_ride.status='WAITING_FOR_RETURN' then
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status',v_ride.status,'return_not_before',v_ride.return_not_before);
    perform private.finish_user_command(v_idem.id,v_result); return v_result;
  end if;
  if v_ride.status<>'OUTBOUND_IN_PROGRESS' then raise exception 'RIDE_TRANSITION_INVALID'; end if;
  select z.zone_id,z.distance_meters into v_zone_id,v_distance
  from private.verify_fixed_rule_zone(p_ride_id,'outbound_completion',p_latitude,p_longitude,p_accuracy_meters,p_captured_at) z;
  select (rv.rules->>'return_wait_minutes')::integer into v_wait
  from public.service_product_rule_versions rv
  where rv.product_id=v_ride.product_id and rv.version_no=v_ride.product_rules_version;
  if v_wait is null or v_wait<0 or v_wait>1440 then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;
  v_not_before:=now()+make_interval(mins=>v_wait);
  update public.rides set status='WAITING_FOR_RETURN',outbound_completed_at=now(),
    outbound_completion_zone_id=v_zone_id,outbound_completion_accuracy_meters=p_accuracy_meters,
    return_not_before=v_not_before where id=v_ride.id;
  insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
  values(v_ride.id,'OUTBOUND_COMPLETED','DRIVER',auth.uid(),'OUTBOUND_IN_PROGRESS','OUTBOUND_COMPLETED',
    jsonb_build_object('zone_id',v_zone_id,'distance_meters',round(v_distance::numeric),'accuracy_meters',p_accuracy_meters));
  insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
  values(v_ride.id,'RETURN_WAIT_STARTED','DRIVER',auth.uid(),'OUTBOUND_COMPLETED','WAITING_FOR_RETURN',
    jsonb_build_object('return_not_before',v_not_before));
  v_result:=jsonb_build_object('ride_id',v_ride.id,'status','WAITING_FOR_RETURN','return_not_before',v_not_before);
  perform private.finish_user_command(v_idem.id,v_result); return v_result;
end; $$;
revoke all on function private.driver_complete_fixed_round_trip_outbound(uuid,double precision,double precision,double precision,timestamptz,text)
from public,anon,authenticated;
grant execute on function private.driver_complete_fixed_round_trip_outbound(uuid,double precision,double precision,double precision,timestamptz,text)
to authenticated;
create or replace function public.driver_complete_fixed_round_trip_outbound(
  p_ride_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision,
  p_captured_at timestamptz,p_idempotency_key text
) returns jsonb language sql security invoker set search_path='' as $$
  select private.driver_complete_fixed_round_trip_outbound(p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at,p_idempotency_key);
$$;
revoke all on function public.driver_complete_fixed_round_trip_outbound(uuid,double precision,double precision,double precision,timestamptz,text)
from public,anon,authenticated;
grant execute on function public.driver_complete_fixed_round_trip_outbound(uuid,double precision,double precision,double precision,timestamptz,text)
to authenticated;

create or replace function private.driver_start_fixed_return_boarding(p_ride_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_driver_id uuid:=private.current_driver_id();
  v_idem public.command_idempotency%rowtype;
  v_ride public.rides%rowtype;
  v_wait integer;
  v_deadline timestamptz;
  v_result jsonb;
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem:=private.claim_user_command('driver_start_fixed_return_boarding',p_idempotency_key,md5(p_ride_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_ride from public.rides r where r.id=p_ride_id and r.driver_id=v_driver_id for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  if not exists (select 1 from public.service_products p where p.id=v_ride.product_id and p.service_type='FIXED_ROUND_TRIP')
    then raise exception 'RIDE_TRANSITION_INVALID'; end if;
  if v_ride.status='RETURN_BOARDING' then
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status',v_ride.status,'return_boarding_deadline',v_ride.return_boarding_deadline);
    perform private.finish_user_command(v_idem.id,v_result); return v_result;
  end if;
  if v_ride.status<>'WAITING_FOR_RETURN' then raise exception 'RIDE_TRANSITION_INVALID'; end if;
  if v_ride.return_not_before is null or now()<v_ride.return_not_before then raise exception 'RETURN_WAIT_NOT_FINISHED'; end if;
  select (rv.rules->>'return_boarding_wait_minutes')::integer into v_wait
  from public.service_product_rule_versions rv
  where rv.product_id=v_ride.product_id and rv.version_no=v_ride.product_rules_version;
  if v_wait is null or v_wait<1 or v_wait>120 then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;
  v_deadline:=now()+make_interval(mins=>v_wait);
  update public.rides set status='RETURN_BOARDING',return_boarding_started_at=now(),return_boarding_deadline=v_deadline
  where id=v_ride.id;
  insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
  values(v_ride.id,'RETURN_BOARDING_STARTED','DRIVER',auth.uid(),'WAITING_FOR_RETURN','RETURN_BOARDING',
    jsonb_build_object('deadline',v_deadline));
  v_result:=jsonb_build_object('ride_id',v_ride.id,'status','RETURN_BOARDING','return_boarding_deadline',v_deadline);
  perform private.finish_user_command(v_idem.id,v_result); return v_result;
end; $$;
revoke all on function private.driver_start_fixed_return_boarding(uuid,text) from public,anon,authenticated;
grant execute on function private.driver_start_fixed_return_boarding(uuid,text) to authenticated;
create or replace function public.driver_start_fixed_return_boarding(p_ride_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.driver_start_fixed_return_boarding(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_start_fixed_return_boarding(uuid,text) from public,anon,authenticated;
grant execute on function public.driver_start_fixed_return_boarding(uuid,text) to authenticated;
