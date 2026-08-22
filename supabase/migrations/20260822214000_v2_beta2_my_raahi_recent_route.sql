create or replace function public.get_passenger_ride_status(p_request_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_request public.seat_requests;
  v_trip public.trips;
  v_driver public.drivers;
  v_vehicle public.vehicles;
  v_pickup_stop public.route_stops;
  v_eta integer;
  v_stops jsonb;
  v_seat_numbers integer[];
begin
  if auth.uid() is null then return jsonb_build_object('error','Not authenticated'); end if;
  select * into v_request from public.seat_requests where id=p_request_id and passenger_id=auth.uid();
  if v_request.id is null then return jsonb_build_object('error','Request not found'); end if;

  select * into v_trip from public.trips where id=v_request.trip_id;
  select * into v_driver from public.drivers where id=v_trip.driver_id;
  select * into v_vehicle from public.vehicles where id=v_trip.vehicle_id;
  select * into v_pickup_stop from public.route_stops where id=v_request.pickup_stop_id;

  if v_request.pickup_stop_order<=v_trip.current_stop_order then v_eta:=0;
  else
    select coalesce(sum(rs.minutes_from_prev),0) into v_eta from public.route_stops rs
    where rs.route_id=v_trip.route_id and rs.stop_order>v_trip.current_stop_order and rs.stop_order<=v_request.pickup_stop_order;
  end if;

  select jsonb_agg(jsonb_build_object('stop_id',rs.id,'stop_order',rs.stop_order,'name',rs.name,'is_current',rs.stop_order=v_trip.current_stop_order,'is_passed',rs.stop_order<v_trip.current_stop_order) order by rs.stop_order)
  into v_stops from public.route_stops rs where rs.route_id=v_trip.route_id;

  select coalesce(array_agg(ts.seat_number order by ts.seat_number),array[]::integer[]) into v_seat_numbers
  from public.trip_seats ts where ts.trip_id=v_request.trip_id and ts.request_id=v_request.id;

  return jsonb_build_object(
    'request_id',v_request.id,'trip_id',v_request.trip_id,'route_id',v_trip.route_id,'status',v_request.status,
    'pickup_stop_name',v_pickup_stop.name,'pickup_stop_order',v_request.pickup_stop_order,
    'seat_count',v_request.seat_count,'seat_numbers',v_seat_numbers,
    'driver_display_name',v_driver.display_name,'driver_phone',v_driver.phone,'vehicle_number',v_vehicle.registration_number,
    'current_stop_name',(select name from public.route_stops where route_id=v_trip.route_id and stop_order=v_trip.current_stop_order limit 1),
    'current_stop_order',v_trip.current_stop_order,'eta_minutes',v_eta,'trip_status',v_trip.status,'stops',coalesce(v_stops,'[]'::jsonb)
  );
end;
$function$;
