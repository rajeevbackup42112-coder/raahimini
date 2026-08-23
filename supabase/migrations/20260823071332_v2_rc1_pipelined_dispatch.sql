-- Raahi V2 canonical dispatch: FIFO is pipelined per one-way route.
-- Start Trip is the handoff point: the next waiting driver for the SAME route may collect immediately.

create or replace function public.activate_next_driver(p_route_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_next public.driver_queue;
  v_driver public.drivers;
  v_vehicle public.vehicles;
  v_route public.routes;
  v_trip_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_route_id::text, 0));
  select * into v_route from public.routes where id=p_route_id and is_active=true;
  if v_route.id is null then return jsonb_build_object('success',false,'error','Route is not active'); end if;

  -- An IN_PROGRESS trip does not block the next collecting car. Only one ACTIVE_COLLECTING
  -- queue entry is allowed for this one-way route at a time.
  if exists(select 1 from public.driver_queue where route_id=p_route_id and status='ACTIVE_COLLECTING') then
    return jsonb_build_object('success',true,'already_active',true);
  end if;

  select * into v_next from public.driver_queue
  where route_id=p_route_id and status='WAITING'
  order by queue_position, joined_at, id limit 1 for update;
  if v_next.id is null then return jsonb_build_object('success',false,'error','No waiting drivers in queue'); end if;

  select * into v_driver from public.drivers where id=v_next.driver_id and is_active=true for update;
  select * into v_vehicle from public.vehicles where id=v_driver.vehicle_id and is_active=true;
  if v_driver.id is null or v_vehicle.id is null then
    update public.driver_queue set status='CANCELLED' where id=v_next.id;
    return public.activate_next_driver(p_route_id);
  end if;
  update public.driver_queue set status='ACTIVE_COLLECTING', activated_at=now() where id=v_next.id;
  insert into public.trips(route_id,driver_id,vehicle_id,queue_entry_id,status,capacity)
  values(p_route_id,v_driver.id,v_vehicle.id,v_next.id,'ACTIVE_COLLECTING',v_vehicle.capacity)
  returning id into v_trip_id;

  insert into public.trip_seats(trip_id,seat_number)
  select v_trip_id, generate_series(1,v_vehicle.capacity);

  perform public.record_audit('activate_next_driver','driver_queue',v_next.id,null,
    jsonb_build_object('route_id',p_route_id,'trip_id',v_trip_id,'dispatch_mode','PIPELINED_PER_DIRECTION'));
  return jsonb_build_object('success',true,'queue_id',v_next.id,'driver_id',v_next.driver_id,'trip_id',v_trip_id);
end;
$function$;

create or replace function public.start_trip(p_trip_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
  v_trip public.trips;
  v_location public.trip_live_locations;
  v_activation jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Not authenticated'); end if;
  select id into v_driver_id from public.drivers where profile_id=auth.uid();
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Not a driver'); end if;

  select * into v_trip from public.trips where id=p_trip_id for update;
  if v_trip.id is null or v_trip.driver_id<>v_driver_id then return jsonb_build_object('success',false,'error','Trip not found or not authorized'); end if;
  if v_trip.status='IN_PROGRESS' then return jsonb_build_object('success',true,'already_started',true); end if;
  if v_trip.status<>'ACTIVE_COLLECTING' then return jsonb_build_object('success',false,'error','Trip is not in ACTIVE_COLLECTING state'); end if;
  if v_trip.held_count>0 then return jsonb_build_object('success',false,'error',format('Cannot start: %s held request(s) must be resolved',v_trip.held_count)); end if;
  if v_trip.confirmed_count+v_trip.driver_closed_count<>v_trip.capacity then
    return jsonb_build_object('success',false,'error',format('Cannot start: confirmed(%s) + closed(%s) must equal capacity(%s)',v_trip.confirmed_count,v_trip.driver_closed_count,v_trip.capacity));
  end if;

  select * into v_location from public.trip_live_locations where trip_id=p_trip_id and driver_id=v_driver_id;
  if v_location.trip_id is null or v_location.captured_at<now()-interval '60 seconds' or v_location.accuracy_meters>200 then
    return jsonb_build_object('success',false,'error','Turn on location and get a usable GPS fix before starting the trip','location_required',true);
  end if;

  update public.trips set status='IN_PROGRESS',started_at=now() where id=p_trip_id;
  update public.driver_queue set status='IN_PROGRESS' where id=v_trip.queue_entry_id;

  -- Canonical handoff: as soon as this car departs, activate the next FIFO driver on this route.
  select public.activate_next_driver(v_trip.route_id) into v_activation;
  perform public.record_audit('start_trip','trips',p_trip_id,null,
    jsonb_build_object('dispatch_mode','PIPELINED_PER_DIRECTION','next_driver_activation',v_activation,
      'gps_fix_required',true,'gps_accuracy_meters',v_location.accuracy_meters));

  return jsonb_build_object('success',true,'next_driver_activation',v_activation,'gps_active',true);
end;
$function$;

-- Completion is terminal bookkeeping only. Driver handoff already happened at Start Trip.
create or replace function public.complete_trip(p_trip_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
  v_trip public.trips;
  v_final_stop_order integer;
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Not authenticated'); end if;
  select id into v_driver_id from public.drivers where profile_id=auth.uid() and is_active=true;
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Not an active driver'); end if;

  select * into v_trip from public.trips where id=p_trip_id for update;
  if v_trip.id is null or v_trip.driver_id is distinct from v_driver_id then return jsonb_build_object('success',false,'error','Trip not found or not authorized'); end if;
  if v_trip.status='COMPLETED' then return jsonb_build_object('success',true,'already_completed',true); end if;
  if v_trip.status<>'IN_PROGRESS' then return jsonb_build_object('success',false,'error','Trip is not IN_PROGRESS'); end if;

  select max(stop_order) into v_final_stop_order from public.route_stops where route_id=v_trip.route_id;
  if v_final_stop_order is null then return jsonb_build_object('success',false,'error','Trip route has no stops'); end if;
  if v_trip.current_stop_order<>v_final_stop_order then
    return jsonb_build_object('success',false,'error','Trip can be completed only at the final stop',
      'current_stop_order',v_trip.current_stop_order,'final_stop_order',v_final_stop_order);
  end if;

  update public.trips set status='COMPLETED',completed_at=now() where id=p_trip_id;
  update public.driver_queue set status='DONE',completed_at=now() where id=v_trip.queue_entry_id;
  update public.drivers set trips_completed=trips_completed+1 where id=v_driver_id;

  insert into public.behaviour_events(actor_id,actor_role,event_type,trip_id)
  select sr.passenger_id,'passenger','trip_completed',p_trip_id
  from public.seat_requests sr where sr.trip_id=p_trip_id and sr.status='CONFIRMED';
  perform public.record_behaviour(v_driver_id,'driver','trip_completed',p_trip_id);
  perform public.record_audit('complete_trip','trips',p_trip_id,null,
    jsonb_build_object('dispatch_mode','PIPELINED_PER_DIRECTION','handoff_already_occurred_at_start',true));

  return jsonb_build_object('success',true);
end;
$function$;

revoke execute on function public.activate_next_driver(uuid) from public, anon, authenticated;
grant execute on function public.activate_next_driver(uuid) to service_role;
revoke execute on function public.start_trip(uuid) from public, anon;
grant execute on function public.start_trip(uuid) to authenticated;
revoke execute on function public.complete_trip(uuid) from public, anon;
grant execute on function public.complete_trip(uuid) to authenticated;

create or replace function public.get_driver_post_start_return_demand(p_trip_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
  v_trip public.trips;
  v_route public.routes;
  v_reverse_id uuid;
  v_summary jsonb;
  v_label text;
begin
  if auth.uid() is null then
    return jsonb_build_object('has_signal', false, 'error', 'Not authenticated');
  end if;
  select id into v_driver_id from public.drivers where profile_id=auth.uid() and is_active=true;
  if v_driver_id is null then
    return jsonb_build_object('has_signal', false, 'error', 'Not an active driver');
  end if;
  select * into v_trip from public.trips where id=p_trip_id and driver_id=v_driver_id;
  if v_trip.id is null or v_trip.status <> 'IN_PROGRESS' then
    return jsonb_build_object('has_signal', false);
  end if;
  select * into v_route from public.routes where id=v_trip.route_id;
  select id into v_reverse_id
  from public.routes
  where from_location_id=v_route.to_location_id
    and to_location_id=v_route.from_location_id
    and is_active=true
  order by id
  limit 1;
  if v_reverse_id is null then
    return jsonb_build_object('has_signal', false);
  end if;
  select public.get_route_demand_summary(v_reverse_id) into v_summary;
  v_label := upper(coalesce(v_summary->>'demand_label','NONE'));
  return jsonb_build_object(
    'has_signal', true,
    'level', case when v_label='HIGH' then 'High' when v_label='MEDIUM' then 'Medium' else 'Low' end
  );
end;
$function$;

revoke execute on function public.get_driver_post_start_return_demand(uuid) from public, anon;
grant execute on function public.get_driver_post_start_return_demand(uuid) to authenticated;
