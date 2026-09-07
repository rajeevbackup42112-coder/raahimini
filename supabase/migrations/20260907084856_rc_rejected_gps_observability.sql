create table public.operational_observations(
  id uuid primary key default gen_random_uuid(),
  origin_market_id uuid not null references public.markets(id) on delete restrict,
  ride_id uuid not null references public.rides(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  observation_type text not null check(observation_type in ('GPS_REJECTED')),
  service_type text not null check(char_length(service_type) between 2 and 80),
  action text not null check(char_length(action) between 2 and 80),
  rejection_code text not null check(rejection_code in ('ARRIVAL_LOCATION_NOT_VERIFIED','COMPLETION_LOCATION_NOT_VERIFIED','ROUND_TRIP_LOCATION_NOT_VERIFIED','TRIP_LOCATION_NOT_VERIFIED')),
  accuracy_meters double precision not null check(accuracy_meters>0),
  captured_at timestamptz not null,
  correlation_id uuid not null unique,
  created_at timestamptz not null default now()
);
create index idx_operational_observations_market_created on public.operational_observations(origin_market_id,created_at desc);
create index idx_operational_observations_ride on public.operational_observations(ride_id);
create index idx_operational_observations_driver on public.operational_observations(driver_id);
create index idx_operational_observations_actor on public.operational_observations(actor_profile_id);
alter table public.operational_observations enable row level security;
create policy operational_observations_no_direct_client_access on public.operational_observations for all to authenticated using(false) with check(false);
revoke all on table public.operational_observations from public,anon,authenticated;

create or replace function private.record_rejected_gps_observation(
  p_ride_id uuid,p_action text,p_rejection_code text,p_accuracy_meters double precision,p_captured_at timestamptz,p_correlation_id uuid
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_profile uuid:=auth.uid(); v_driver uuid; v_market uuid; v_service text; v_id uuid;
begin
  if v_profile is null then raise exception 'UNAUTHENTICATED'; end if;
  select d.id into v_driver from public.drivers d where d.profile_id=v_profile;
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  if p_rejection_code not in ('ARRIVAL_LOCATION_NOT_VERIFIED','COMPLETION_LOCATION_NOT_VERIFIED','ROUND_TRIP_LOCATION_NOT_VERIFIED','TRIP_LOCATION_NOT_VERIFIED') then raise exception 'OBSERVATION_CODE_INVALID'; end if;
  if p_accuracy_meters is null or p_accuracy_meters<=0 or p_captured_at is null then raise exception 'OBSERVATION_GPS_EVIDENCE_REQUIRED'; end if;
  select r.origin_market_id,p.service_type into v_market,v_service
    from public.rides r join public.service_products p on p.id=r.product_id
   where r.id=p_ride_id and r.driver_id=v_driver;
  if v_market is null then raise exception 'RIDE_NOT_FOUND'; end if;
  insert into public.operational_observations(origin_market_id,ride_id,driver_id,actor_profile_id,observation_type,service_type,action,rejection_code,accuracy_meters,captured_at,correlation_id)
  values(v_market,p_ride_id,v_driver,v_profile,'GPS_REJECTED',v_service,upper(trim(coalesce(p_action,''))),p_rejection_code,p_accuracy_meters,p_captured_at,p_correlation_id)
  on conflict(correlation_id) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.operational_observations where correlation_id=p_correlation_id; end if;
  return jsonb_build_object('observation_id',v_id,'ride_id',p_ride_id,'observation_type','GPS_REJECTED','rejection_code',p_rejection_code);
end;$$;
revoke all on function private.record_rejected_gps_observation(uuid,text,text,double precision,timestamptz,uuid) from public,anon,authenticated;
grant execute on function private.record_rejected_gps_observation(uuid,text,text,double precision,timestamptz,uuid) to authenticated;

create or replace function public.record_rejected_gps_observation(
  p_ride_id uuid,p_action text,p_rejection_code text,p_accuracy_meters double precision,p_captured_at timestamptz,p_correlation_id uuid
) returns jsonb language sql security invoker set search_path=''
as $$ select private.record_rejected_gps_observation(p_ride_id,p_action,p_rejection_code,p_accuracy_meters,p_captured_at,p_correlation_id); $$;
revoke all on function public.record_rejected_gps_observation(uuid,text,text,double precision,timestamptz,uuid) from public,anon;
grant execute on function public.record_rejected_gps_observation(uuid,text,text,double precision,timestamptz,uuid) to authenticated;

create or replace function private.get_operational_health_workspace_v2()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_base jsonb; v_markets jsonb; v_telemetry jsonb;
begin
  v_base:=private.get_operational_health_workspace();
  select coalesce(jsonb_agg(
    m.item || jsonb_build_object(
      'rejected_gps_attempts_24h',(select count(*) from public.operational_observations o where o.origin_market_id=(m.item->>'market_id')::uuid and o.observation_type='GPS_REJECTED' and o.created_at>=now()-interval '24 hours'),
      'latest_rejected_gps_at',(select max(o.created_at) from public.operational_observations o where o.origin_market_id=(m.item->>'market_id')::uuid and o.observation_type='GPS_REJECTED'),
      'worst_rejected_gps_accuracy_meters_24h',(select max(o.accuracy_meters) from public.operational_observations o where o.origin_market_id=(m.item->>'market_id')::uuid and o.observation_type='GPS_REJECTED' and o.created_at>=now()-interval '24 hours')
    ) order by m.ord
  ),'[]'::jsonb) into v_markets
  from jsonb_array_elements(coalesce(v_base->'markets','[]'::jsonb)) with ordinality as m(item,ord);

  select coalesce(jsonb_agg(
    case when t.item->>'key'='rejected_gps_attempts'
      then jsonb_build_object('key','rejected_gps_attempts','status','AVAILABLE','detail','Rejected GPS attempts are persisted as privacy-minimized operational observations without latitude/longitude.')
      else t.item end order by t.ord
  ),'[]'::jsonb) into v_telemetry
  from jsonb_array_elements(coalesce(v_base->'telemetry_coverage','[]'::jsonb)) with ordinality as t(item,ord);

  return jsonb_set(jsonb_set(v_base,'{markets}',v_markets,true),'{telemetry_coverage}',v_telemetry,true);
end;$$;
revoke all on function private.get_operational_health_workspace_v2() from public,anon,authenticated;
grant execute on function private.get_operational_health_workspace_v2() to authenticated;

create or replace function public.get_operational_health_workspace()
returns jsonb language sql stable set search_path=''
as $$ select private.get_operational_health_workspace_v2(); $$;
revoke all on function public.get_operational_health_workspace() from public,anon;
grant execute on function public.get_operational_health_workspace() to authenticated;