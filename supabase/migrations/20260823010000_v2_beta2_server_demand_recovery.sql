-- Server-backed passenger recovery for active NOW demand.
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
    'supply_present',v_trip.id is not null and v_available>0,
    'available_count',v_available,
    'trip_id',v_trip.id
  );
end;
$function$;

revoke execute on function public.get_my_active_now_demand() from public, anon, service_role;
grant execute on function public.get_my_active_now_demand() to authenticated;
