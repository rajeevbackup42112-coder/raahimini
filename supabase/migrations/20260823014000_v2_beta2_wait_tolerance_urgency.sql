create or replace function public.get_route_demand_summary(p_route_id uuid)
returns jsonb
language sql
stable security definer
set search_path to ''
as $function$
  with counts as (
    select
      count(*) filter (where intent_kind='NOW' and status='ACTIVE' and earliest_at<=now() and latest_at>=now())::integer as now_count,
      count(*) filter (where intent_kind='SCHEDULED' and status='ACTIVE' and latest_at>=now() and earliest_at<=now()+interval '7 days')::integer as scheduled_count,
      min(wait_tolerance_minutes) filter (where intent_kind='NOW' and status='ACTIVE' and earliest_at<=now() and latest_at>=now())::integer as min_wait_tolerance_minutes
    from public.demand_intents
    where route_id=p_route_id
  )
  select jsonb_build_object(
    'route_id',p_route_id,
    'now_count',now_count,
    'scheduled_count',scheduled_count,
    'demand_label',case when now_count>=4 then 'HIGH' when now_count>=2 then 'MEDIUM' when now_count=1 then 'LOW' else 'NONE' end,
    'min_wait_tolerance_minutes',min_wait_tolerance_minutes
  )
  from counts;
$function$;

create or replace function public.get_my_active_now_demand()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_intent public.demand_intents;
  v_trip public.trips;
  v_available integer := 0;
begin
  if v_uid is null then return jsonb_build_object('has_active_demand', false); end if;

  select * into v_intent
  from public.demand_intents
  where passenger_id=v_uid
    and intent_kind='NOW'
    and status='ACTIVE'
    and earliest_at<=now()
    and latest_at>=now()
  order by created_at desc
  limit 1;

  if v_intent.id is null then return jsonb_build_object('has_active_demand', false); end if;

  select * into v_trip
  from public.trips
  where route_id=v_intent.route_id and status='ACTIVE_COLLECTING'
  order by created_at desc
  limit 1;

  if v_trip.id is not null then
    v_available := greatest(v_trip.capacity-v_trip.confirmed_count-v_trip.held_count-v_trip.driver_closed_count,0);
  end if;

  return jsonb_build_object(
    'has_active_demand',true,
    'intent_id',v_intent.id,
    'route_id',v_intent.route_id,
    'expires_at',v_intent.latest_at,
    'wait_tolerance_minutes',v_intent.wait_tolerance_minutes,
    'supply_present',v_trip.id is not null and v_available>0,
    'available_count',v_available,
    'trip_id',v_trip.id
  );
end;
$function$;
