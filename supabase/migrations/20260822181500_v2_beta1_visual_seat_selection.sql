create or replace function public.get_public_active_car(p_route_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_trip public.trips;
  v_driver public.drivers;
  v_vehicle public.vehicles;
  v_stops jsonb;
  v_seats jsonb;
  v_available integer;
begin
  select * into v_trip
  from public.trips
  where route_id=p_route_id and status='ACTIVE_COLLECTING'
  order by created_at desc
  limit 1;

  if v_trip.id is null then
    return jsonb_build_object('has_active_car',false);
  end if;

  select * into v_driver from public.drivers where id=v_trip.driver_id;
  select * into v_vehicle from public.vehicles where id=v_trip.vehicle_id;
  v_available:=v_trip.capacity-v_trip.confirmed_count-v_trip.held_count-v_trip.driver_closed_count;

  select jsonb_agg(
    jsonb_build_object(
      'stop_id',rs.id,
      'stop_order',rs.stop_order,
      'name',rs.name,
      'is_current',rs.stop_order=v_trip.current_stop_order,
      'is_passed',rs.stop_order<v_trip.current_stop_order,
      'eta_minutes',case
        when rs.stop_order<v_trip.current_stop_order then null
        when rs.stop_order=v_trip.current_stop_order then 0
        else (
          select coalesce(sum(rs2.minutes_from_prev),0)
          from public.route_stops rs2
          where rs2.route_id=v_trip.route_id
            and rs2.stop_order>v_trip.current_stop_order
            and rs2.stop_order<=rs.stop_order
        )
      end
    ) order by rs.stop_order
  ) into v_stops
  from public.route_stops rs
  where rs.route_id=v_trip.route_id;

  select jsonb_agg(
    jsonb_build_object(
      'seat_number',ts.seat_number,
      'state',ts.state::text
    ) order by ts.seat_number
  ) into v_seats
  from public.trip_seats ts
  where ts.trip_id=v_trip.id;

  return jsonb_build_object(
    'has_active_car',true,
    'trip_id',v_trip.id,
    'route_id',v_trip.route_id,
    'status',v_trip.status,
    'fare_per_seat',v_trip.fare_per_seat,
    'driver_display_name',v_driver.display_name,
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
    'stops',coalesce(v_stops,'[]'::jsonb),
    'seats',coalesce(v_seats,'[]'::jsonb)
  );
end;
$function$;

revoke execute on function public.get_public_active_car(uuid) from public;
grant execute on function public.get_public_active_car(uuid) to anon, authenticated;

drop function if exists public.request_seats(uuid,uuid,integer);

create function public.request_seats(
  p_trip_id uuid,
  p_pickup_stop_id uuid,
  p_seat_count integer,
  p_seat_numbers integer[] default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_trip public.trips;
  v_stop public.route_stops;
  v_profile public.profiles;
  v_request_id uuid;
  v_available integer;
  v_seats integer[];
  v_written integer;
  v_unique_count integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('success',false,'error','Authentication required');
  end if;

  select * into v_profile from public.profiles where id=auth.uid();
  if v_profile.id is null or v_profile.is_restricted then
    return jsonb_build_object('success',false,'error','Account is restricted or unavailable');
  end if;
  if v_profile.role <> 'passenger' then
    return jsonb_build_object('success',false,'error','Only passenger accounts can request seats');
  end if;

  if not exists (
    select 1
    from auth.users
    where id=auth.uid()
      and phone is not null
      and length(btrim(phone))>0
      and phone_confirmed_at is not null
  ) then
    return jsonb_build_object('success',false,'error','Verify your mobile number before requesting a seat');
  end if;

  if p_seat_count<1 or p_seat_count>4 then
    return jsonb_build_object('success',false,'error','Invalid seat count');
  end if;

  if p_seat_numbers is not null then
    if coalesce(array_length(p_seat_numbers,1),0)<>p_seat_count then
      return jsonb_build_object('success',false,'error','Selected seat count does not match request');
    end if;
    select count(distinct s)::integer into v_unique_count from unnest(p_seat_numbers) as s;
    if v_unique_count<>p_seat_count then
      return jsonb_build_object('success',false,'error','Choose each seat only once');
    end if;
  end if;

  select * into v_trip from public.trips where id=p_trip_id for update;
  if v_trip.id is null or v_trip.status<>'ACTIVE_COLLECTING' then
    return jsonb_build_object('success',false,'error','Trip is not accepting requests');
  end if;

  select * into v_stop
  from public.route_stops
  where id=p_pickup_stop_id and route_id=v_trip.route_id;
  if v_stop.id is null then
    return jsonb_build_object('success',false,'error','Invalid pickup stop for this route');
  end if;
  if v_stop.stop_order<v_trip.current_stop_order then
    return jsonb_build_object('success',false,'error','Driver has already passed this pickup point');
  end if;

  if exists(
    select 1 from public.seat_requests
    where trip_id=p_trip_id
      and passenger_id=auth.uid()
      and status in('HELD','CONFIRMED')
  ) then
    return jsonb_build_object('success',false,'error','You already have an active request for this trip');
  end if;

  v_available:=v_trip.capacity-v_trip.confirmed_count-v_trip.held_count-v_trip.driver_closed_count;
  if v_available<p_seat_count then
    return jsonb_build_object('success',false,'error',format('Only %s seat(s) available — cannot partially fulfil request',v_available));
  end if;

  if p_seat_numbers is null then
    select array(
      select seat_number
      from public.trip_seats
      where trip_id=p_trip_id and state='AVAILABLE'
      order by seat_number
      limit p_seat_count
      for update
    ) into v_seats;
  else
    if exists(select 1 from unnest(p_seat_numbers) s where s<1 or s>v_trip.capacity) then
      return jsonb_build_object('success',false,'error','Invalid seat selection for this vehicle');
    end if;
    select array(
      select seat_number
      from public.trip_seats
      where trip_id=p_trip_id
        and seat_number=any(p_seat_numbers)
        and state='AVAILABLE'
      order by seat_number
      for update
    ) into v_seats;
    if coalesce(array_length(v_seats,1),0)<>p_seat_count then
      return jsonb_build_object('success',false,'error','One or more selected seats are no longer available');
    end if;
  end if;

  if coalesce(array_length(v_seats,1),0)<>p_seat_count then
    raise exception 'Seat ledger mismatch for trip %',p_trip_id;
  end if;

  insert into public.seat_requests(trip_id,passenger_id,pickup_stop_id,pickup_stop_order,seat_count,status)
    values(p_trip_id,auth.uid(),p_pickup_stop_id,v_stop.stop_order,p_seat_count,'HELD')
    returning id into v_request_id;

  update public.trip_seats
  set state='HELD',request_id=v_request_id,updated_at=now()
  where trip_id=p_trip_id and seat_number=any(v_seats) and state='AVAILABLE';

  get diagnostics v_written=row_count;
  if v_written<>p_seat_count then
    raise exception 'Could not reserve requested seat ledger for trip %',p_trip_id;
  end if;

  update public.trips set held_count=held_count+p_seat_count where id=p_trip_id;
  perform public.record_behaviour(auth.uid(),'passenger','request_created',p_trip_id,v_request_id,jsonb_build_object('seat_numbers',v_seats));
  perform public.record_audit('request_seats','seat_requests',v_request_id,null,jsonb_build_object('trip_id',p_trip_id,'seat_count',p_seat_count,'stop',v_stop.name,'seat_numbers',v_seats),null);

  return jsonb_build_object('success',true,'request_id',v_request_id,'status','HELD','seat_numbers',v_seats);
end;
$function$;

revoke execute on function public.request_seats(uuid,uuid,integer,integer[]) from public, anon, service_role;
grant execute on function public.request_seats(uuid,uuid,integer,integer[]) to authenticated;