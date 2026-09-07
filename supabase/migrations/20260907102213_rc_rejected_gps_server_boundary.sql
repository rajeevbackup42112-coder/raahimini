revoke execute on function public.record_rejected_gps_observation(uuid,text,text,double precision,timestamptz,uuid) from authenticated;
revoke execute on function private.record_rejected_gps_observation(uuid,text,text,double precision,timestamptz,uuid) from authenticated;

create or replace function private.record_rejected_gps_observation_server(
  p_actor_profile_id uuid,
  p_ride_id uuid,
  p_action text,
  p_rejection_code text,
  p_accuracy_meters double precision,
  p_captured_at timestamptz,
  p_correlation_id uuid
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_driver uuid; v_market uuid; v_service text; v_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_actor_profile_id is null then raise exception 'ACTOR_PROFILE_REQUIRED'; end if;
  select d.id into v_driver from public.drivers d where d.profile_id=p_actor_profile_id;
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  if p_rejection_code not in ('ARRIVAL_LOCATION_NOT_VERIFIED','COMPLETION_LOCATION_NOT_VERIFIED','ROUND_TRIP_LOCATION_NOT_VERIFIED','TRIP_LOCATION_NOT_VERIFIED') then raise exception 'OBSERVATION_CODE_INVALID'; end if;
  if p_accuracy_meters is null or p_accuracy_meters<=0 or p_captured_at is null then raise exception 'OBSERVATION_GPS_EVIDENCE_REQUIRED'; end if;
  select r.origin_market_id,p.service_type into v_market,v_service
    from public.rides r join public.service_products p on p.id=r.product_id
   where r.id=p_ride_id and r.driver_id=v_driver;
  if v_market is null then raise exception 'RIDE_NOT_FOUND'; end if;
  insert into public.operational_observations(origin_market_id,ride_id,driver_id,actor_profile_id,observation_type,service_type,action,rejection_code,accuracy_meters,captured_at,correlation_id)
  values(v_market,p_ride_id,v_driver,p_actor_profile_id,'GPS_REJECTED',v_service,upper(trim(coalesce(p_action,''))),p_rejection_code,p_accuracy_meters,p_captured_at,p_correlation_id)
  on conflict(correlation_id) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.operational_observations where correlation_id=p_correlation_id; end if;
  return jsonb_build_object('observation_id',v_id,'ride_id',p_ride_id,'observation_type','GPS_REJECTED','rejection_code',p_rejection_code);
end;$$;
revoke all on function private.record_rejected_gps_observation_server(uuid,uuid,text,text,double precision,timestamptz,uuid) from public,anon,authenticated;
grant execute on function private.record_rejected_gps_observation_server(uuid,uuid,text,text,double precision,timestamptz,uuid) to service_role;

create or replace function public.record_rejected_gps_observation_server(
  p_actor_profile_id uuid,
  p_ride_id uuid,
  p_action text,
  p_rejection_code text,
  p_accuracy_meters double precision,
  p_captured_at timestamptz,
  p_correlation_id uuid
) returns jsonb language sql security invoker set search_path=''
as $$ select private.record_rejected_gps_observation_server(p_actor_profile_id,p_ride_id,p_action,p_rejection_code,p_accuracy_meters,p_captured_at,p_correlation_id); $$;
revoke all on function public.record_rejected_gps_observation_server(uuid,uuid,text,text,double precision,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.record_rejected_gps_observation_server(uuid,uuid,text,text,double precision,timestamptz,uuid) to service_role;