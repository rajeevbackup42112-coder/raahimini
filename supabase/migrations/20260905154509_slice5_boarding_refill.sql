-- Slice 5C: boarding facts, bounded refill, and system-owned ready-to-depart.

create or replace function private.resolve_fixed_boarding_state(p_ride_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_ride public.rides%rowtype;
  v_unresolved integer;
  v_refill_minutes integer;
  v_result jsonb;
begin
  select * into v_ride from public.rides r where r.id=p_ride_id for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  if v_ride.status <> 'BOARDING' then
    return jsonb_build_object('ride_id',v_ride.id,'status',v_ride.status);
  end if;

  select count(*) into v_unresolved
  from public.ride_bookings b
  where b.ride_id=v_ride.id and b.status='ASSIGNED';
  if v_unresolved > 0 then
    return jsonb_build_object('ride_id',v_ride.id,'status','BOARDING','unresolved_bookings',v_unresolved);
  end if;

  if v_ride.booked_seat_count >= v_ride.capacity then
    update public.rides set status='READY_TO_DEPART',ready_to_depart_at=now() where id=v_ride.id;
    insert into public.ride_events(ride_id,event_type,actor_kind,previous_state,next_state,metadata)
    values(v_ride.id,'READY_TO_DEPART','SYSTEM','BOARDING','READY_TO_DEPART',jsonb_build_object('reason','ALL_SEATS_RESOLVED'));
    return jsonb_build_object('ride_id',v_ride.id,'status','READY_TO_DEPART');
  end if;

  select (rv.rules->>'refill_window_minutes')::integer into v_refill_minutes
  from public.service_product_rule_versions rv
  where rv.product_id=v_ride.product_id and rv.version_no=v_ride.product_rules_version;
  v_refill_minutes := coalesce(v_refill_minutes,0);

  if v_refill_minutes <= 0 then
    update public.rides set status='READY_TO_DEPART',ready_to_depart_at=now() where id=v_ride.id;
    insert into public.ride_events(ride_id,event_type,actor_kind,previous_state,next_state,metadata)
    values(v_ride.id,'READY_TO_DEPART','SYSTEM','BOARDING','READY_TO_DEPART',jsonb_build_object('reason','REFILL_DISABLED'));
    return jsonb_build_object('ride_id',v_ride.id,'status','READY_TO_DEPART');
  end if;

  if v_ride.refill_deadline is null then
    update public.rides set refill_deadline=now()+make_interval(mins=>v_refill_minutes) where id=v_ride.id;
    insert into public.ride_events(ride_id,event_type,actor_kind,previous_state,next_state,metadata)
    values(v_ride.id,'REFILL_WINDOW_OPENED','SYSTEM','BOARDING','BOARDING',jsonb_build_object('refill_window_minutes',v_refill_minutes));
    return jsonb_build_object('ride_id',v_ride.id,'status','BOARDING','refill_deadline',now()+make_interval(mins=>v_refill_minutes));
  end if;

  if now() >= v_ride.refill_deadline then
    update public.rides set status='READY_TO_DEPART',ready_to_depart_at=now() where id=v_ride.id;
    insert into public.ride_events(ride_id,event_type,actor_kind,previous_state,next_state,metadata)
    values(v_ride.id,'READY_TO_DEPART','SYSTEM','BOARDING','READY_TO_DEPART',jsonb_build_object('reason','REFILL_WINDOW_EXPIRED'));
    return jsonb_build_object('ride_id',v_ride.id,'status','READY_TO_DEPART');
  end if;

  return jsonb_build_object('ride_id',v_ride.id,'status','BOARDING','refill_deadline',v_ride.refill_deadline);
end;
$$;

revoke all on function private.resolve_fixed_boarding_state(uuid) from public, anon, authenticated;
create or replace function private.driver_mark_fixed_boarded(
  p_booking_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_driver_id uuid := private.current_driver_id();
  v_idem public.command_idempotency%rowtype;
  v_booking public.ride_bookings%rowtype;
  v_ride public.rides%rowtype;
  v_result jsonb;
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem := private.claim_user_command('driver_mark_fixed_boarded',p_idempotency_key,md5(p_booking_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  select b.* into v_booking from public.ride_bookings b where b.id=p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  select * into v_ride from public.rides r where r.id=v_booking.ride_id and r.driver_id=v_driver_id for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  if v_ride.status <> 'BOARDING' then raise exception 'RIDE_TRANSITION_INVALID'; end if;

  if v_booking.status='BOARDED' then
    v_result := jsonb_build_object('booking_id',v_booking.id,'status','BOARDED','ride_id',v_ride.id);
  elsif v_booking.status <> 'ASSIGNED' then
    raise exception 'BOOKING_TRANSITION_INVALID';
  else
    update public.ride_bookings set status='BOARDED' where id=v_booking.id;
    insert into public.ride_events(
      ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata
    ) values (
      v_ride.id,'PASSENGER_BOARDED','DRIVER',auth.uid(),'BOARDING','BOARDING',
      jsonb_build_object('booking_id',v_booking.id,'seat_count',v_booking.seat_count)
    );
    v_result := jsonb_build_object('booking_id',v_booking.id,'status','BOARDED','ride_id',v_ride.id);
  end if;

  perform private.finish_user_command(v_idem.id,v_result);
  perform private.resolve_fixed_boarding_state(v_ride.id);
  return v_result;
end;
$$;

revoke all on function private.driver_mark_fixed_boarded(uuid,text) from public, anon, authenticated;
create or replace function public.driver_mark_fixed_boarded(p_booking_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.driver_mark_fixed_boarded(p_booking_id,p_idempotency_key); $$;
revoke all on function public.driver_mark_fixed_boarded(uuid,text) from public, anon, authenticated;
grant execute on function public.driver_mark_fixed_boarded(uuid,text) to authenticated;

create or replace function private.driver_report_fixed_no_show(
  p_booking_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_driver_id uuid := private.current_driver_id();
  v_idem public.command_idempotency%rowtype;
  v_booking public.ride_bookings%rowtype;
  v_ride public.rides%rowtype;
  v_result jsonb;
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem := private.claim_user_command('driver_report_fixed_no_show',p_idempotency_key,md5(p_booking_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  select b.* into v_booking from public.ride_bookings b where b.id=p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  select * into v_ride from public.rides r where r.id=v_booking.ride_id and r.driver_id=v_driver_id for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  if v_ride.status <> 'BOARDING' then raise exception 'RIDE_TRANSITION_INVALID'; end if;
  if v_ride.boarding_deadline is null or now() < v_ride.boarding_deadline then
    raise exception 'BOARDING_WAIT_NOT_EXPIRED';
  end if;

  if v_booking.status='NO_SHOW' then
    v_result := jsonb_build_object('booking_id',v_booking.id,'status','NO_SHOW','ride_id',v_ride.id);
  elsif v_booking.status <> 'ASSIGNED' then
    raise exception 'BOOKING_TRANSITION_INVALID';
  else
    update public.ride_bookings set status='NO_SHOW' where id=v_booking.id;
    update public.rides
    set booked_seat_count=booked_seat_count-v_booking.seat_count
    where id=v_ride.id and booked_seat_count>=v_booking.seat_count;
    insert into public.ride_events(
      ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata
    ) values (
      v_ride.id,'PASSENGER_NO_SHOW','DRIVER',auth.uid(),'BOARDING','BOARDING',
      jsonb_build_object('booking_id',v_booking.id,'seat_count',v_booking.seat_count)
    );
    v_result := jsonb_build_object('booking_id',v_booking.id,'status','NO_SHOW','ride_id',v_ride.id);
  end if;
  perform private.finish_user_command(v_idem.id,v_result);
  perform private.resolve_fixed_boarding_state(v_ride.id);
  return v_result;
end;
$$;

revoke all on function private.driver_report_fixed_no_show(uuid,text) from public, anon, authenticated;
create or replace function public.driver_report_fixed_no_show(p_booking_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.driver_report_fixed_no_show(p_booking_id,p_idempotency_key); $$;
revoke all on function public.driver_report_fixed_no_show(uuid,text) from public, anon, authenticated;
grant execute on function public.driver_report_fixed_no_show(uuid,text) to authenticated;

create or replace function private.evaluate_my_fixed_boarding(p_ride_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_driver_id uuid := private.current_driver_id();
  v_owner uuid;
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  select r.driver_id into v_owner from public.rides r where r.id=p_ride_id;
  if v_owner is null or v_owner<>v_driver_id then raise exception 'RIDE_NOT_FOUND'; end if;
  return private.resolve_fixed_boarding_state(p_ride_id);
end;
$$;

revoke all on function private.evaluate_my_fixed_boarding(uuid) from public, anon, authenticated;
create or replace function public.evaluate_my_fixed_boarding(p_ride_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$ select private.evaluate_my_fixed_boarding(p_ride_id); $$;
revoke all on function public.evaluate_my_fixed_boarding(uuid) from public, anon, authenticated;
grant execute on function public.evaluate_my_fixed_boarding(uuid) to authenticated;
create or replace function private.try_refill_fixed_product(p_product_id uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_ride public.rides%rowtype;
  v_request public.fixed_passenger_requests%rowtype;
  v_open integer;
  v_added integer := 0;
begin
  for v_ride in
    select r.* from public.rides r
    where r.product_id=p_product_id
      and r.status='BOARDING'
      and r.refill_deadline is not null
      and r.refill_deadline>now()
      and r.booked_seat_count<r.capacity
    order by r.refill_deadline,r.matched_at
    for update skip locked
  loop
    v_open := v_ride.capacity-v_ride.booked_seat_count;
    select q.* into v_request
    from public.fixed_passenger_requests q
    where q.product_id=p_product_id
      and q.status='QUEUED'
      and q.seat_count<=v_open
    order by q.match_skip_count desc,q.queued_at,q.id
    limit 1
    for update skip locked;
    if not found then continue; end if;

    update public.fixed_passenger_requests
    set status='ASSIGNED',assigned_at=now()
    where id=v_request.id and status='QUEUED';
    if not found then continue; end if;

    insert into public.ride_bookings(
      ride_id,passenger_request_id,passenger_profile_id,
      seat_count,fare_per_seat_inr,boarding_context
    ) values (
      v_ride.id,v_request.id,v_request.passenger_profile_id,
      v_request.seat_count,v_request.fare_per_seat_inr,v_request.boarding_context
    );

    update public.rides
    set booked_seat_count=booked_seat_count+v_request.seat_count
    where id=v_ride.id;

    insert into public.ride_events(
      ride_id,event_type,actor_kind,previous_state,next_state,metadata
    ) values (
      v_ride.id,'REFILL_PASSENGER_ASSIGNED','SYSTEM','BOARDING','BOARDING',
      jsonb_build_object('passenger_request_id',v_request.id,'seat_count',v_request.seat_count)
    );
    v_added := v_added+1;
    perform private.resolve_fixed_boarding_state(v_ride.id);
  end loop;
  return v_added;
end;
$$;

revoke all on function private.try_refill_fixed_product(uuid) from public, anon, authenticated;
grant execute on function private.try_refill_fixed_product(uuid) to service_role;
-- Passenger liquidity first attempts bounded refill, then the ordinary matcher.
create or replace function private.trigger_fixed_product_match()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_key text;
begin
  if new.status<>'QUEUED' then return new; end if;
  if tg_op='UPDATE' and old.status='QUEUED' then return new; end if;

  if tg_table_name='fixed_passenger_requests' then
    perform private.try_refill_fixed_product(new.product_id);
  end if;

  v_key := 'queue:' || tg_table_name || ':' || new.id::text;
  perform private.match_fixed_product(new.product_id,v_key);
  return new;
end;
$$;

revoke all on function private.trigger_fixed_product_match()
from public, anon, authenticated;
