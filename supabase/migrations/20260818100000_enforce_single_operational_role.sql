-- Enforce Raahi's single operational role model at the canonical booking boundary.
-- Drivers and admins may browse public projections while signed out, but an authenticated
-- driver/admin account must never create a passenger seat request.

create or replace function public.request_seats(
  p_trip_id uuid,
  p_pickup_stop_id uuid,
  p_seat_count integer
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

  select array(
    select seat_number
    from public.trip_seats
    where trip_id=p_trip_id and state='AVAILABLE'
    order by seat_number
    limit p_seat_count
    for update
  ) into v_seats;

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
