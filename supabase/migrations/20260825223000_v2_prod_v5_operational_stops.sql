-- Raahi V2 Prod Version 5: simplified Driver "what is next" operational-stop foundation.
-- Version 4 remains the application rollback baseline; database history remains forward-only.

create or replace function public.driver_arrive_at_stop(p_trip_id uuid, p_stop_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
  v_trip public.trips;
  v_stop public.route_stops;
  v_ids uuid[];
  v_id uuid;
  v_count integer;
  v_released integer := 0;
  v_ledger integer;
  v_required_pickup_order integer;
  v_final_stop_order integer;
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Not authenticated'); end if;
  select id into v_driver_id from public.drivers where profile_id=auth.uid() and is_active=true;
  select * into v_trip from public.trips where id=p_trip_id for update;
  if v_trip.id is null or v_trip.driver_id is distinct from v_driver_id
     or v_trip.status not in ('ACTIVE_COLLECTING','IN_PROGRESS') then    return jsonb_build_object('success',false,'error','Trip not found, not authorized, or not active');
  end if;

  select * into v_stop from public.route_stops where id=p_stop_id and route_id=v_trip.route_id;
  if v_stop.id is null then return jsonb_build_object('success',false,'error','Invalid stop for this route'); end if;
  if v_stop.stop_order < v_trip.current_stop_order then
    return jsonb_build_object('success',false,'error','Cannot move backwards on the route');
  end if;

  if v_trip.status='ACTIVE_COLLECTING' then
    select min(sr.pickup_stop_order) into v_required_pickup_order
    from public.seat_requests sr
    where sr.trip_id=p_trip_id and sr.status='HELD'
      and sr.pickup_stop_order>=v_trip.current_stop_order;

    if v_required_pickup_order is null and v_stop.stop_order>v_trip.current_stop_order then
      return jsonb_build_object('success',false,'error','No waiting pickup ahead; resolve seats and depart instead');
    end if;
    if v_required_pickup_order is not null and v_stop.stop_order>v_trip.current_stop_order
       and v_stop.stop_order<>v_required_pickup_order then
      return jsonb_build_object('success',false,'error','Driver may move only to the next waiting passenger stop',
        'next_pickup_stop_order',v_required_pickup_order);
    end if;
  else
    select max(stop_order) into v_final_stop_order from public.route_stops where route_id=v_trip.route_id;    if v_final_stop_order is null then return jsonb_build_object('success',false,'error','Trip route has no stops'); end if;
    if v_stop.stop_order>v_trip.current_stop_order and v_stop.stop_order<>v_final_stop_order then
      return jsonb_build_object('success',false,'error','In-progress trips move only to the destination',
        'destination_stop_order',v_final_stop_order);
    end if;
  end if;

  insert into public.trip_progress(trip_id,stop_id,stop_order)
  values(p_trip_id,p_stop_id,v_stop.stop_order)
  on conflict(trip_id,stop_order) do update set arrived_at=now();

  select array(
    select id from public.seat_requests
    where trip_id=p_trip_id and status='HELD' and pickup_stop_order<v_stop.stop_order
    order by created_at for update
  ) into v_ids;

  foreach v_id in array coalesce(v_ids,array[]::uuid[]) loop
    select seat_count into v_count from public.seat_requests where id=v_id;
    select public.release_held_request_seats(v_id) into v_ledger;
    if v_ledger<>v_count then raise exception 'Expiry ledger mismatch for request %',v_id; end if;
    update public.seat_requests set status='EXPIRED',expired_at=now() where id=v_id;
    v_released:=v_released+v_count;
    perform public.record_behaviour(
      (select passenger_id from public.seat_requests where id=v_id),
      'passenger','request_expired',p_trip_id,v_id
    );  end loop;

  update public.trips
  set current_stop_order=v_stop.stop_order,held_count=held_count-v_released
  where id=p_trip_id;

  perform public.record_audit(
    'driver_arrive_at_stop','trips',p_trip_id,null,
    jsonb_build_object('stop',v_stop.name,'stop_order',v_stop.stop_order,
      'released_seats',v_released,'operational_progression',true),null
  );
  return jsonb_build_object('success',true,'current_stop_order',v_stop.stop_order,
    'stop_name',v_stop.name,'released_seats',v_released);
end;
$function$;

create or replace function public.driver_confirm_payment(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
  v_req public.seat_requests;
  v_trip public.trips;
  v_seats integer[];
  v_count integer;
begin  if auth.uid() is null then return jsonb_build_object('success',false,'error','Not authenticated'); end if;
  select id into v_driver_id from public.drivers where profile_id=auth.uid() and is_active=true;
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Not a driver'); end if;

  select * into v_req from public.seat_requests where id=p_request_id for update;
  if v_req.id is null then return jsonb_build_object('success',false,'error','Request not found'); end if;
  if v_req.status='CONFIRMED' then
    select array(select seat_number from public.trip_seats where request_id=p_request_id and state='CONFIRMED' order by seat_number)
      into v_seats;
    return jsonb_build_object('success',true,'already_confirmed',true,'seat_numbers',v_seats);
  end if;
  if v_req.status<>'HELD' then return jsonb_build_object('success',false,'error','Request is not HELD'); end if;

  select * into v_trip from public.trips where id=v_req.trip_id for update;
  if v_trip.driver_id is distinct from v_driver_id or v_trip.status<>'ACTIVE_COLLECTING' then
    return jsonb_build_object('success',false,'error','Not authorized for this collecting trip');
  end if;
  if v_req.pickup_stop_order<>v_trip.current_stop_order then
    return jsonb_build_object('success',false,'error','Confirm boarding only at the passenger pickup stop',
      'pickup_stop_order',v_req.pickup_stop_order,'current_stop_order',v_trip.current_stop_order);
  end if;

  select array(
    select seat_number from public.trip_seats
    where trip_id=v_req.trip_id and request_id=p_request_id and state='HELD'
    order by seat_number for update
  ) into v_seats;  if coalesce(array_length(v_seats,1),0)<>v_req.seat_count then
    raise exception 'Held-seat ledger mismatch for request %',p_request_id;
  end if;

  update public.trip_seats set state='CONFIRMED',updated_at=now()
  where request_id=p_request_id and state='HELD';
  get diagnostics v_count = row_count;
  if v_count<>v_req.seat_count then raise exception 'Confirmation ledger mismatch for request %',p_request_id; end if;

  update public.seat_requests set status='CONFIRMED',confirmed_at=now() where id=p_request_id;
  update public.trips
    set confirmed_count=confirmed_count+v_req.seat_count,held_count=held_count-v_req.seat_count
    where id=v_req.trip_id;
  perform public.record_behaviour(v_req.passenger_id,'passenger','booking_confirmed',v_req.trip_id,p_request_id);
  perform public.record_audit('driver_confirm_payment','seat_requests',p_request_id,null,
    jsonb_build_object('seat_numbers',v_seats,'pickup_stop_order',v_req.pickup_stop_order),null);
  return jsonb_build_object('success',true,'seat_numbers',v_seats);
end;
$function$;

create or replace function public.driver_advance_stop(p_trip_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
  v_trip public.trips;
  v_next_stop public.route_stops;
  v_next_pickup_order integer;  v_final_stop_order integer;
  v_departure_eligible boolean;
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Not authenticated'); end if;
  select id into v_driver_id from public.drivers where profile_id=auth.uid();
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Not a driver'); end if;

  select * into v_trip from public.trips where id=p_trip_id;
  if v_trip.id is null or v_trip.driver_id<>v_driver_id then
    return jsonb_build_object('success',false,'error','Trip not found or not authorized');
  end if;

  if v_trip.status='ACTIVE_COLLECTING' then
    select min(sr.pickup_stop_order) into v_next_pickup_order
    from public.seat_requests sr
    where sr.trip_id=p_trip_id and sr.status='HELD'
      and sr.pickup_stop_order>=v_trip.current_stop_order;

    if v_next_pickup_order=v_trip.current_stop_order then
      return jsonb_build_object('success',false,'error','Resolve the waiting passenger at the current stop first',
        'pickup_stop_order',v_next_pickup_order,'resolve_current_stop',true);
    end if;
    if v_next_pickup_order is null then
      v_departure_eligible := (v_trip.held_count=0 and v_trip.confirmed_count+v_trip.driver_closed_count=v_trip.capacity);
      if v_departure_eligible then
        return jsonb_build_object('success',false,'error','All assigned passengers are resolved; ready to depart',
          'ready_to_start',true);
      end if;
      return jsonb_build_object('success',false,'error','No waiting passengers ahead; wait for requests or close empty seats',
        'wait_or_close_seats',true);
    end if;    select * into v_next_stop
    from public.route_stops
    where route_id=v_trip.route_id and stop_order=v_next_pickup_order;
    if v_next_stop.id is null then
      return jsonb_build_object('success',false,'error','Next pickup stop is missing from route');
    end if;
    return public.driver_arrive_at_stop(p_trip_id,v_next_stop.id);
  end if;

  if v_trip.status='IN_PROGRESS' then
    select max(stop_order) into v_final_stop_order from public.route_stops where route_id=v_trip.route_id;
    if v_final_stop_order is null then return jsonb_build_object('success',false,'error','Trip route has no stops'); end if;
    if v_trip.current_stop_order=v_final_stop_order then
      return jsonb_build_object('success',false,'error','Already at the destination','already_at_final',true);
    end if;
    select * into v_next_stop
    from public.route_stops
    where route_id=v_trip.route_id and stop_order=v_final_stop_order;
    return public.driver_arrive_at_stop(p_trip_id,v_next_stop.id);
  end if;

  return jsonb_build_object('success',false,'error','Trip is not active');
end;
$function$;

create or replace function public.get_driver_active_car()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare  v_driver_id uuid;
  v_trip public.trips;
  v_vehicle public.vehicles;
  v_route public.routes;
  v_from_loc public.locations;
  v_to_loc public.locations;
  v_requests jsonb;
  v_stops jsonb;
  v_operational_stops jsonb;
  v_next_operational_stop jsonb;
  v_available integer;
  v_departure_eligible boolean;
  v_final_stop_order integer;
  v_next_action text;
begin
  if auth.uid() is null then return jsonb_build_object('error','Not authenticated'); end if;
  select d.id into v_driver_id
  from public.drivers d
  join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and p.role='driver' and p.is_restricted=false;
  if v_driver_id is null then return jsonb_build_object('error','Active driver account required'); end if;

  select * into v_trip
  from public.trips
  where driver_id=v_driver_id and status in('ACTIVE_COLLECTING','IN_PROGRESS')
  order by created_at desc limit 1;
  if v_trip.id is null then return jsonb_build_object('has_active_trip',false); end if;

  select * into v_vehicle from public.vehicles where id=v_trip.vehicle_id;
  select * into v_route from public.routes where id=v_trip.route_id;
  select * into v_from_loc from public.locations where id=v_route.from_location_id;  select * into v_to_loc from public.locations where id=v_route.to_location_id;
  v_available:=v_trip.capacity-v_trip.confirmed_count-v_trip.held_count-v_trip.driver_closed_count;
  v_departure_eligible:=(v_trip.held_count=0 and v_trip.confirmed_count+v_trip.driver_closed_count=v_trip.capacity);
  select max(stop_order) into v_final_stop_order from public.route_stops where route_id=v_trip.route_id;

  select jsonb_agg(jsonb_build_object(
    'request_id',sr.id,
    'passenger_display_name',p.display_name,
    'phone_masked',case when length(p.phone)>=10 then '+91 '||left(p.phone,2)||'xxx xx'||right(p.phone,4) else 'N/A' end,
    'pickup_stop_name',rs.name,
    'pickup_stop_order',sr.pickup_stop_order,
    'seat_count',sr.seat_count,
    'status',sr.status,
    'is_at_pickup',sr.pickup_stop_order=v_trip.current_stop_order,
    'amount_due',sr.seat_count*v_trip.fare_per_seat
  ) order by sr.created_at asc) into v_requests
  from public.seat_requests sr
  join public.profiles p on p.id=sr.passenger_id
  join public.route_stops rs on rs.id=sr.pickup_stop_id
  where sr.trip_id=v_trip.id and sr.status in('HELD','CONFIRMED');

  select jsonb_agg(jsonb_build_object(
    'stop_id',rs.id,
    'stop_order',rs.stop_order,
    'name',rs.name,
    'is_current',rs.stop_order=v_trip.current_stop_order,
    'is_passed',rs.stop_order<v_trip.current_stop_order,
    'eta_minutes',case      when rs.stop_order<v_trip.current_stop_order then null
      when rs.stop_order=v_trip.current_stop_order then 0
      else (select coalesce(sum(rs2.minutes_from_prev),0)
        from public.route_stops rs2
        where rs2.route_id=v_trip.route_id
          and rs2.stop_order>v_trip.current_stop_order
          and rs2.stop_order<=rs.stop_order)
    end
  ) order by rs.stop_order) into v_stops
  from public.route_stops rs where rs.route_id=v_trip.route_id;

  if v_trip.status='ACTIVE_COLLECTING' then
    select jsonb_agg(jsonb_build_object(
      'stop_id',x.stop_id,
      'stop_order',x.stop_order,
      'name',x.name,
      'request_count',x.request_count,
      'seat_count',x.seat_count,
      'action','PICKUP'
    ) order by x.stop_order) into v_operational_stops
    from (
      select rs.id as stop_id,rs.stop_order,rs.name,
        count(sr.id)::integer as request_count,
        sum(sr.seat_count)::integer as seat_count
      from public.seat_requests sr
      join public.route_stops rs on rs.id=sr.pickup_stop_id
      where sr.trip_id=v_trip.id and sr.status='HELD'
        and sr.pickup_stop_order>=v_trip.current_stop_order
      group by rs.id,rs.stop_order,rs.name
    ) x;
    select jsonb_build_object(
      'stop_id',x.stop_id,
      'stop_order',x.stop_order,
      'name',x.name,
      'request_count',x.request_count,
      'seat_count',x.seat_count,
      'action','PICKUP'
    ) into v_next_operational_stop
    from (
      select rs.id as stop_id,rs.stop_order,rs.name,
        count(sr.id)::integer as request_count,
        sum(sr.seat_count)::integer as seat_count
      from public.seat_requests sr
      join public.route_stops rs on rs.id=sr.pickup_stop_id
      where sr.trip_id=v_trip.id and sr.status='HELD'
        and sr.pickup_stop_order>=v_trip.current_stop_order
      group by rs.id,rs.stop_order,rs.name
      order by rs.stop_order
      limit 1
    ) x;

    if v_next_operational_stop is not null then
      if (v_next_operational_stop->>'stop_order')::integer=v_trip.current_stop_order then
        v_next_action:='PICKUP_NOW';
      else
        v_next_action:='DRIVE_TO_PICKUP';
      end if;
    elsif v_departure_eligible then
      v_next_action:='READY_TO_START';
    elsif v_available>0 then
      v_next_action:='WAIT_OR_CLOSE_SEATS';
    else
      v_next_action:='GET_READY';
    end if;
  else    select jsonb_build_array(jsonb_build_object(
      'stop_id',rs.id,
      'stop_order',rs.stop_order,
      'name',rs.name,
      'request_count',0,
      'seat_count',v_trip.confirmed_count,
      'action','DESTINATION'
    )), jsonb_build_object(
      'stop_id',rs.id,
      'stop_order',rs.stop_order,
      'name',rs.name,
      'request_count',0,
      'seat_count',v_trip.confirmed_count,
      'action','DESTINATION'
    )
    into v_operational_stops,v_next_operational_stop
    from public.route_stops rs
    where rs.route_id=v_trip.route_id and rs.stop_order=v_final_stop_order;

    if v_trip.current_stop_order=v_final_stop_order then
      v_operational_stops:='[]'::jsonb;
      v_next_operational_stop:=null;
      v_next_action:='COMPLETE_TRIP';
    else
      v_next_action:='DRIVE_TO_DESTINATION';
    end if;
  end if;

  return jsonb_build_object(
    'has_active_trip',true,
    'trip_id',v_trip.id,
    'route_id',v_trip.route_id,
    'route_code',v_route.code,
    'route_label',v_route.direction_label,
    'from_location',v_from_loc.name,
    'to_location',v_to_loc.name,    'status',v_trip.status,
    'fare_per_seat',v_trip.fare_per_seat,
    'vehicle_type',v_vehicle.vehicle_type,
    'vehicle_model',v_vehicle.vehicle_model,
    'vehicle_number',v_vehicle.registration_number,
    'capacity',v_trip.capacity,
    'confirmed_count',v_trip.confirmed_count,
    'held_count',v_trip.held_count,
    'driver_closed_count',v_trip.driver_closed_count,
    'available_count',v_available,
    'current_stop_order',v_trip.current_stop_order,
    'current_stop_name',(select name from public.route_stops where route_id=v_trip.route_id and stop_order=v_trip.current_stop_order limit 1),
    'departure_eligible',v_departure_eligible,
    'next_action',v_next_action,
    'next_operational_stop',v_next_operational_stop,
    'operational_stops',coalesce(v_operational_stops,'[]'::jsonb),
    'passenger_requests',coalesce(v_requests,'[]'::jsonb),
    'stops',coalesce(v_stops,'[]'::jsonb)
  );
end;
$function$;

comment on function public.driver_advance_stop(uuid) is
'Advances only to a meaningful pickup while collecting, or to the destination once in progress.';
comment on function public.get_driver_active_car() is
'Driver projection including next_action and operational_stops for the simplified Version 5 Driver UX.';