-- Passenger seat holds expire after five minutes unless the driver confirms payment.
-- The expiry timestamp is server-authoritative. Clients only render the countdown.

alter table public.seat_requests
  add column if not exists hold_expires_at timestamptz;

update public.seat_requests
set hold_expires_at = created_at + interval '5 minutes'
where status = 'HELD' and hold_expires_at is null;

create or replace function public.expire_held_request_internal(p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_req public.seat_requests;
  v_released integer := 0;
begin
  select * into v_req
  from public.seat_requests
  where id = p_request_id
  for update;

  if v_req.id is null or v_req.status <> 'HELD' then
    return 0;
  end if;

  if v_req.hold_expires_at is null or v_req.hold_expires_at > now() then
    return 0;
  end if;

  perform 1 from public.trips where id = v_req.trip_id for update;
  select public.release_held_request_seats(p_request_id) into v_released;

  if v_released <> v_req.seat_count then
    raise exception 'Held-seat ledger mismatch for request %', p_request_id;
  end if;

  update public.seat_requests
  set status = 'EXPIRED', expired_at = now(), updated_at = now()
  where id = p_request_id;

  update public.trips
  set held_count = held_count - v_req.seat_count
  where id = v_req.trip_id;

  perform public.record_behaviour(v_req.passenger_id, 'passenger', 'request_expired', v_req.trip_id, p_request_id);
  perform public.record_audit('expire_held_request', 'seat_requests', p_request_id);
  return v_released;
end;
$function$;

revoke all on function public.expire_held_request_internal(uuid) from public, anon, authenticated;

create or replace function public.expire_my_held_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_req public.seat_requests;
  v_released integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  select * into v_req
  from public.seat_requests
  where id = p_request_id and passenger_id = auth.uid();

  if v_req.id is null then
    return jsonb_build_object('success', false, 'error', 'Request not found');
  end if;

  if v_req.status <> 'HELD' then
    return jsonb_build_object('success', true, 'expired', v_req.status = 'EXPIRED', 'status', v_req.status);
  end if;

  if v_req.hold_expires_at is null or v_req.hold_expires_at > now() then
    return jsonb_build_object('success', true, 'expired', false, 'status', v_req.status, 'hold_expires_at', v_req.hold_expires_at, 'server_now', now());
  end if;

  select public.expire_held_request_internal(p_request_id) into v_released;
  return jsonb_build_object('success', true, 'expired', true, 'status', 'EXPIRED', 'released_seats', v_released, 'server_now', now());
end;
$function$;

grant execute on function public.expire_my_held_request(uuid) to authenticated;

create or replace function public.request_seats(p_trip_id uuid, p_pickup_stop_id uuid, p_seat_count integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_trip public.trips;
  v_stop public.route_stops;
  v_profile public.profiles;
  v_request_id uuid;
  v_available integer;
  v_seats integer[];
  v_written integer;
  v_stale uuid;
  v_hold_expires_at timestamptz;
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Authentication required'); end if;
  select * into v_profile from public.profiles where id=auth.uid();
  if v_profile.id is null or v_profile.is_restricted then return jsonb_build_object('success',false,'error','Account is restricted or unavailable'); end if;
  if v_profile.role <> 'passenger' then return jsonb_build_object('success',false,'error','Only passenger accounts can request seats'); end if;

  if not exists (
    select 1 from auth.users where id=auth.uid() and phone is not null and length(btrim(phone))>0 and phone_confirmed_at is not null
  ) then return jsonb_build_object('success',false,'error','Verify your mobile number before requesting a seat'); end if;

  if p_seat_count<1 or p_seat_count>4 then return jsonb_build_object('success',false,'error','Invalid seat count'); end if;

  select * into v_trip from public.trips where id=p_trip_id for update;
  if v_trip.id is null or v_trip.status<>'ACTIVE_COLLECTING' then return jsonb_build_object('success',false,'error','Trip is not accepting requests'); end if;

  for v_stale in
    select id from public.seat_requests
    where trip_id=p_trip_id and status='HELD' and hold_expires_at is not null and hold_expires_at <= now()
    for update
  loop
    perform public.expire_held_request_internal(v_stale);
  end loop;

  select * into v_trip from public.trips where id=p_trip_id for update;
  select * into v_stop from public.route_stops where id=p_pickup_stop_id and route_id=v_trip.route_id;
  if v_stop.id is null then return jsonb_build_object('success',false,'error','Invalid pickup stop for this route'); end if;
  if v_stop.stop_order<v_trip.current_stop_order then return jsonb_build_object('success',false,'error','Driver has already passed this pickup point'); end if;

  if exists(select 1 from public.seat_requests where trip_id=p_trip_id and passenger_id=auth.uid() and status in('HELD','CONFIRMED')) then
    return jsonb_build_object('success',false,'error','You already have an active request for this trip');
  end if;

  v_available:=v_trip.capacity-v_trip.confirmed_count-v_trip.held_count-v_trip.driver_closed_count;
  if v_available<p_seat_count then return jsonb_build_object('success',false,'error',format('Only %s seat(s) available — cannot partially fulfil request',v_available)); end if;

  select array(select seat_number from public.trip_seats where trip_id=p_trip_id and state='AVAILABLE' order by seat_number limit p_seat_count for update) into v_seats;
  if coalesce(array_length(v_seats,1),0)<>p_seat_count then raise exception 'Seat ledger mismatch for trip %',p_trip_id; end if;

  v_hold_expires_at := now() + interval '5 minutes';
  insert into public.seat_requests(trip_id,passenger_id,pickup_stop_id,pickup_stop_order,seat_count,status,hold_expires_at)
    values(p_trip_id,auth.uid(),p_pickup_stop_id,v_stop.stop_order,p_seat_count,'HELD',v_hold_expires_at)
    returning id into v_request_id;

  update public.trip_seats set state='HELD',request_id=v_request_id,updated_at=now()
  where trip_id=p_trip_id and seat_number=any(v_seats) and state='AVAILABLE';
  get diagnostics v_written=row_count;
  if v_written<>p_seat_count then raise exception 'Could not reserve requested seat ledger for trip %',p_trip_id; end if;

  update public.trips set held_count=held_count+p_seat_count where id=p_trip_id;
  perform public.record_behaviour(auth.uid(),'passenger','request_created',p_trip_id,v_request_id,jsonb_build_object('seat_numbers',v_seats,'hold_expires_at',v_hold_expires_at));
  perform public.record_audit('request_seats','seat_requests',v_request_id,null,jsonb_build_object('trip_id',p_trip_id,'seat_count',p_seat_count,'stop',v_stop.name,'seat_numbers',v_seats,'hold_expires_at',v_hold_expires_at),null);
  return jsonb_build_object('success',true,'request_id',v_request_id,'status','HELD','seat_numbers',v_seats,'hold_expires_at',v_hold_expires_at,'server_now',now());
end;
$function$;

create or replace function public.driver_confirm_payment(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare v_driver_id uuid; v_req public.seat_requests; v_trip public.trips; v_seats integer[]; v_count integer; v_released integer;
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Not authenticated'); end if;
  select id into v_driver_id from public.drivers where profile_id=auth.uid() and is_active=true;
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Not a driver'); end if;
  select * into v_req from public.seat_requests where id=p_request_id for update;
  if v_req.id is null then return jsonb_build_object('success',false,'error','Request not found'); end if;
  if v_req.status='CONFIRMED' then
    select array(select seat_number from public.trip_seats where request_id=p_request_id and state='CONFIRMED' order by seat_number) into v_seats;
    return jsonb_build_object('success',true,'already_confirmed',true,'seat_numbers',v_seats);
  end if;
  if v_req.status<>'HELD' then return jsonb_build_object('success',false,'error','Request is not HELD'); end if;

  if v_req.hold_expires_at is not null and v_req.hold_expires_at <= now() then
    select public.expire_held_request_internal(p_request_id) into v_released;
    return jsonb_build_object('success',false,'error','Passenger hold expired','expired',true,'released_seats',v_released);
  end if;

  select * into v_trip from public.trips where id=v_req.trip_id for update;
  if v_trip.driver_id is distinct from v_driver_id or v_trip.status<>'ACTIVE_COLLECTING' then return jsonb_build_object('success',false,'error','Not authorized for this collecting trip'); end if;
  if v_req.pickup_stop_order<v_trip.current_stop_order then return jsonb_build_object('success',false,'error','Pickup opportunity has been passed'); end if;
  select array(select seat_number from public.trip_seats where trip_id=v_req.trip_id and request_id=p_request_id and state='HELD' order by seat_number for update) into v_seats;
  if coalesce(array_length(v_seats,1),0)<>v_req.seat_count then raise exception 'Held-seat ledger mismatch for request %',p_request_id; end if;
  update public.trip_seats set state='CONFIRMED',updated_at=now() where request_id=p_request_id and state='HELD';
  get diagnostics v_count=row_count;
  if v_count<>v_req.seat_count then raise exception 'Confirmation ledger mismatch for request %',p_request_id; end if;
  update public.seat_requests set status='CONFIRMED',confirmed_at=now(),updated_at=now() where id=p_request_id;
  update public.trips set confirmed_count=confirmed_count+v_req.seat_count,held_count=held_count-v_req.seat_count where id=v_req.trip_id;
  perform public.record_behaviour(v_req.passenger_id,'passenger','booking_confirmed',v_req.trip_id,p_request_id);
  perform public.record_audit('driver_confirm_payment','seat_requests',p_request_id,null,jsonb_build_object('seat_numbers',v_seats),null);
  return jsonb_build_object('success',true,'seat_numbers',v_seats);
end;
$function$;

create or replace function public.get_passenger_ride_status(p_request_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $function$
declare
  v_request public.seat_requests; v_trip public.trips; v_driver public.drivers; v_vehicle public.vehicles; v_pickup_stop public.route_stops; v_eta integer; v_stops jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('error','Not authenticated'); end if;
  select * into v_request from public.seat_requests where id=p_request_id and passenger_id=auth.uid();
  if v_request.id is null then return jsonb_build_object('error','Request not found'); end if;
  select * into v_trip from public.trips where id=v_request.trip_id;
  select * into v_driver from public.drivers where id=v_trip.driver_id;
  select * into v_vehicle from public.vehicles where id=v_trip.vehicle_id;
  select * into v_pickup_stop from public.route_stops where id=v_request.pickup_stop_id;
  if v_request.pickup_stop_order <= v_trip.current_stop_order then v_eta:=0; else
    select coalesce(sum(rs.minutes_from_prev),0) into v_eta from public.route_stops rs where rs.route_id=v_trip.route_id and rs.stop_order>v_trip.current_stop_order and rs.stop_order<=v_request.pickup_stop_order;
  end if;
  select jsonb_agg(jsonb_build_object('stop_id',rs.id,'stop_order',rs.stop_order,'name',rs.name,'is_current',rs.stop_order=v_trip.current_stop_order,'is_passed',rs.stop_order<v_trip.current_stop_order) order by rs.stop_order)
    into v_stops from public.route_stops rs where rs.route_id=v_trip.route_id;
  return jsonb_build_object(
    'request_id',v_request.id,'trip_id',v_request.trip_id,'status',v_request.status,'pickup_stop_name',v_pickup_stop.name,'pickup_stop_order',v_request.pickup_stop_order,
    'seat_count',v_request.seat_count,'driver_display_name',v_driver.display_name,'driver_phone',v_driver.phone,'vehicle_number',v_vehicle.registration_number,
    'current_stop_name',(select name from public.route_stops where route_id=v_trip.route_id and stop_order=v_trip.current_stop_order limit 1),
    'current_stop_order',v_trip.current_stop_order,'eta_minutes',v_eta,'trip_status',v_trip.status,'stops',coalesce(v_stops,'[]'::jsonb),
    'hold_expires_at',v_request.hold_expires_at,'server_now',now()
  );
end;
$function$;
