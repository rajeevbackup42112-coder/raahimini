-- Canonical Raahi Shared Passenger commands and Trip booking capacity integration.

create or replace function private.start_shared_ride(
  p_origin_location_id uuid,
  p_destination_location_id uuid,
  p_desired_departure_at timestamptz,
  p_desired_window_end_at timestamptz,
  p_seat_count integer,
  p_notification_interest boolean,
  p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_profile uuid:=auth.uid();
  v_origin public.locations%rowtype;
  v_destination public.locations%rowtype;
  v_product public.service_products%rowtype;
  v_rules jsonb;
  v_max_booking integer;
  v_horizon integer;
  v_existing public.travel_intents%rowtype;
  v_idem public.command_idempotency;
  v_hash text;
  v_id uuid:=gen_random_uuid();
  v_match jsonb;
  v_result jsonb;
begin
  if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;

  v_hash:=md5(concat_ws('|',p_origin_location_id,p_destination_location_id,p_desired_departure_at,p_desired_window_end_at,p_seat_count,p_notification_interest));
  v_idem:=private.claim_user_command('start_shared_ride',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  select * into v_origin from public.locations where id=p_origin_location_id and is_active;
  if not found or v_origin.market_id is null then raise exception 'SHARED_ORIGIN_INVALID'; end if;
  select * into v_destination from public.locations where id=p_destination_location_id and is_active;
  if not found then raise exception 'SHARED_DESTINATION_INVALID'; end if;
  if p_origin_location_id=p_destination_location_id then raise exception 'SHARED_SAME_LOCATION'; end if;

  select p.* into v_product
    from public.service_products p
    join public.markets m on m.id=p.market_id and m.status in ('PILOT','ACTIVE','SCALING')
   where p.market_id=v_origin.market_id
     and p.service_type='RAAHI_TRIP'
     and p.status in ('PILOT','ACTIVE')
     and private.product_feature_enabled(p.id)
   order by p.code,p.id
   limit 1;
  if not found then raise exception 'SHARED_PRODUCT_NOT_AVAILABLE'; end if;

  select rv.rules into v_rules from public.service_product_rule_versions rv
   where rv.product_id=v_product.id and rv.version_no=v_product.current_rules_version;
  v_max_booking:=coalesce((v_rules->>'max_seats_per_booking')::integer,4);
  v_horizon:=coalesce((v_rules->>'max_publish_horizon_days')::integer,60);

  if p_seat_count is null or p_seat_count<1 or p_seat_count>v_max_booking then raise exception 'SHARED_SEAT_COUNT_INVALID'; end if;
  if p_desired_departure_at is null or p_desired_departure_at<=now() then raise exception 'SHARED_DEPARTURE_INVALID'; end if;
  if p_desired_departure_at>now()+make_interval(days=>v_horizon) then raise exception 'SHARED_DEPARTURE_INVALID'; end if;
  if p_desired_window_end_at is null or p_desired_window_end_at<p_desired_departure_at then raise exception 'SHARED_WINDOW_INVALID'; end if;

  select * into v_existing
    from public.travel_intents t
   where t.passenger_profile_id=v_profile
     and t.origin_location_id=p_origin_location_id
     and t.destination_location_id=p_destination_location_id
     and t.desired_departure_at is not distinct from p_desired_departure_at
     and t.acceptable_service_type='RAAHI_TRIP'
     and t.intent_kind='SHARED_REQUEST'
     and t.status='ACTIVE'
   limit 1
   for update;

  if found then
    v_match:=private.match_shared_request(v_existing.id);
    v_result:=jsonb_build_object(
      'intent_id',v_existing.id,'status','ACTIVE','deduplicated',true,
      'intent_kind','SHARED_REQUEST','seat_count',v_existing.seat_count,
      'notification_interest',v_existing.notification_interest,
      'creates_booking',false,'driver_offer_ready',coalesce((v_match->>'matched')::boolean,false),
      'match_id',v_match->'match_id'
    );
    return private.complete_user_command(v_idem.id,v_result);
  end if;

  insert into public.travel_intents(
    id,passenger_profile_id,origin_location_id,destination_location_id,origin_market_id,
    desired_departure_at,desired_window_end_at,seat_count,acceptable_service_type,
    notification_interest,status,intent_kind
  ) values(
    v_id,v_profile,p_origin_location_id,p_destination_location_id,v_origin.market_id,
    p_desired_departure_at,p_desired_window_end_at,p_seat_count,'RAAHI_TRIP',
    coalesce(p_notification_interest,false),'ACTIVE','SHARED_REQUEST'
  );

  perform private.ensure_emerging_corridor_signal(v_origin.market_id,p_origin_location_id,p_destination_location_id);
  v_match:=private.match_shared_request(v_id);

  v_result:=jsonb_build_object(
    'intent_id',v_id,'status','ACTIVE','deduplicated',false,
    'origin_market_id',v_origin.market_id,'seat_count',p_seat_count,
    'intent_kind','SHARED_REQUEST','notification_interest',coalesce(p_notification_interest,false),
    'creates_booking',false,'driver_offer_ready',coalesce((v_match->>'matched')::boolean,false),
    'match_id',v_match->'match_id'
  );
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.start_shared_ride(uuid,uuid,timestamptz,timestamptz,integer,boolean,text) from public,anon,authenticated;
grant execute on function private.start_shared_ride(uuid,uuid,timestamptz,timestamptz,integer,boolean,text) to authenticated;

create or replace function public.start_shared_ride(
  p_origin_location_id uuid,p_destination_location_id uuid,
  p_desired_departure_at timestamptz,p_desired_window_end_at timestamptz,
  p_seat_count integer,p_notification_interest boolean,p_idempotency_key text
)
returns jsonb language sql security invoker set search_path=''
as $$ select private.start_shared_ride(p_origin_location_id,p_destination_location_id,p_desired_departure_at,p_desired_window_end_at,p_seat_count,p_notification_interest,p_idempotency_key); $$;
revoke all on function public.start_shared_ride(uuid,uuid,timestamptz,timestamptz,integer,boolean,text) from public,anon,authenticated;
grant execute on function public.start_shared_ride(uuid,uuid,timestamptz,timestamptz,integer,boolean,text) to authenticated;

create or replace function private.accept_shared_trip_match(p_match_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_profile uuid:=auth.uid();
  v_offering_id uuid;
  v_m public.shared_trip_matches%rowtype;
  v_i public.travel_intents%rowtype;
  v_o public.trip_offerings%rowtype;
  v_driver public.drivers%rowtype;
  v_ride public.rides%rowtype;
  v_booking uuid:=gen_random_uuid();
  v_rb uuid;
  v_idem public.command_idempotency;
  v_hash text;
  v_confirm jsonb;
  v_result jsonb;
begin
  if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
  v_hash:=md5(p_match_id::text);
  v_idem:=private.claim_user_command('accept_shared_trip_match',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  select m.offering_id into v_offering_id
    from public.shared_trip_matches m
   where m.id=p_match_id and m.passenger_profile_id=v_profile;
  if v_offering_id is null then raise exception 'SHARED_MATCH_NOT_FOUND'; end if;

  -- Canonical lock order: Offering -> Match -> Intent.
  select * into v_o from public.trip_offerings where id=v_offering_id for update;
  if not found then raise exception 'TRIP_OFFERING_NOT_FOUND'; end if;
  perform private.release_expired_shared_trip_holds(v_o.id);

  select * into v_m from public.shared_trip_matches
   where id=p_match_id and passenger_profile_id=v_profile for update;
  if not found then raise exception 'SHARED_MATCH_NOT_FOUND'; end if;
  if v_m.status='ACCEPTED' then
    v_result:=jsonb_build_object('match_id',v_m.id,'status','ACCEPTED','trip_booking_id',v_m.trip_booking_id,'offering_id',v_m.offering_id);
    return private.complete_user_command(v_idem.id,v_result);
  end if;
  if v_m.status='EXPIRED' then raise exception 'SHARED_MATCH_EXPIRED'; end if;
  if v_m.status<>'OFFERED' then raise exception 'SHARED_MATCH_NOT_ACCEPTABLE'; end if;

  select * into v_i from public.travel_intents where id=v_m.travel_intent_id for update;
  if not found or v_i.intent_kind<>'SHARED_REQUEST' or v_i.status<>'ACTIVE' or v_i.passenger_profile_id<>v_profile then raise exception 'SHARED_REQUEST_NOT_ACTIVE'; end if;

  select * into v_o from public.trip_offerings where id=v_offering_id;
  if v_o.status not in ('FILLING','CONFIRMED') or v_o.departure_at<=now() then raise exception 'TRIP_OFFERING_NOT_BOOKABLE'; end if;
  if v_o.status='FILLING' and v_o.confirmation_deadline<=now() then raise exception 'TRIP_CONFIRMATION_DEADLINE_PASSED'; end if;
  if not private.product_feature_enabled(v_o.product_id) then raise exception 'SHARED_PRODUCT_NOT_AVAILABLE'; end if;

  select * into v_driver from public.drivers where id=v_o.driver_id;
  if v_driver.profile_id=v_profile then raise exception 'TRIP_DRIVER_CANNOT_BOOK_SELF'; end if;
  if not private.raahi_trip_driver_vehicle_eligible(v_o.driver_id,v_o.vehicle_id,v_o.origin_market_id) then raise exception 'TRIP_DRIVER_NOT_ELIGIBLE'; end if;
  if exists(select 1 from public.trip_bookings b where b.offering_id=v_o.id and b.passenger_profile_id=v_profile and b.status in ('FILLING','CONFIRMED')) then raise exception 'TRIP_ACTIVE_BOOKING_EXISTS'; end if;
  if v_o.held_seats<v_m.seat_count then raise exception 'SHARED_HOLD_STATE_INVALID'; end if;

  if v_o.status='FILLING' then
    insert into public.trip_bookings(id,offering_id,passenger_profile_id,seat_count,price_per_seat_inr,status)
    values(v_booking,v_o.id,v_profile,v_m.seat_count,v_m.price_per_seat_inr,'FILLING');

    update public.trip_offerings
       set held_seats=held_seats-v_m.seat_count,
           active_booked_seats=active_booked_seats+v_m.seat_count,
           updated_at=now()
     where id=v_o.id
       and held_seats>=v_m.seat_count
       and active_booked_seats+held_seats<=offered_seats;
    if not found then raise exception 'SHARED_HOLD_STATE_INVALID'; end if;

    update public.shared_trip_matches
       set status='ACCEPTED',accepted_at=now(),trip_booking_id=v_booking,updated_at=now()
     where id=v_m.id and status='OFFERED';
    if not found then raise exception 'SHARED_MATCH_STATE_CHANGED'; end if;

    update public.travel_intents
       set status='RESOLVED',resolved_product_id=v_o.product_id,updated_at=now()
     where id=v_i.id and status='ACTIVE';

    if v_o.active_booked_seats+v_m.seat_count>=v_o.min_confirmation_seats then
      v_confirm:=private.confirm_trip_threshold_locked(v_o.id);
    end if;

    select * into v_o from public.trip_offerings where id=v_o.id;
    select ride_booking_id into v_rb from public.trip_bookings where id=v_booking;
    v_result:=jsonb_build_object(
      'match_id',v_m.id,'offering_id',v_o.id,'trip_booking_id',v_booking,
      'status',case when v_o.status='CONFIRMED' then 'CONFIRMED' else 'FILLING' end,
      'seat_count',v_m.seat_count,'price_per_seat_inr',v_m.price_per_seat_inr,
      'trip_confirmed',v_o.status='CONFIRMED','ride_id',v_o.ride_id,'ride_booking_id',v_rb
    );
  else
    if v_o.ride_id is null or v_o.commitment_id is null then raise exception 'TRIP_CONFIRMATION_STATE_INVALID'; end if;
    select * into v_ride from public.rides where id=v_o.ride_id for update;
    if not found or v_ride.status<>'UPCOMING' then raise exception 'TRIP_OFFERING_NOT_BOOKABLE'; end if;
    if v_ride.booked_seat_count+v_m.seat_count>v_ride.capacity then raise exception 'TRIP_CAPACITY_UNAVAILABLE'; end if;

    insert into public.trip_bookings(id,offering_id,passenger_profile_id,seat_count,price_per_seat_inr,status)
    values(v_booking,v_o.id,v_profile,v_m.seat_count,v_m.price_per_seat_inr,'CONFIRMED');
    v_rb:=gen_random_uuid();
    insert into public.ride_bookings(
      id,ride_id,passenger_request_id,outstation_request_id,carpool_booking_id,trip_booking_id,
      passenger_profile_id,seat_count,fare_per_seat_inr,boarding_context,commercial_model,quoted_total_inr
    ) values(
      v_rb,v_ride.id,null,null,null,v_booking,v_profile,v_m.seat_count,v_m.price_per_seat_inr,
      jsonb_build_object('service_type','RAAHI_TRIP','trip_offering_id',v_o.id),'PER_SEAT',null
    );
    update public.trip_bookings set ride_booking_id=v_rb,updated_at=now() where id=v_booking;
    update public.rides set booked_seat_count=booked_seat_count+v_m.seat_count where id=v_ride.id;
    update public.trip_offerings
       set held_seats=held_seats-v_m.seat_count,
           active_booked_seats=active_booked_seats+v_m.seat_count,
           updated_at=now()
     where id=v_o.id and held_seats>=v_m.seat_count;
    if not found then raise exception 'SHARED_HOLD_STATE_INVALID'; end if;

    update public.shared_trip_matches
       set status='ACCEPTED',accepted_at=now(),trip_booking_id=v_booking,updated_at=now()
     where id=v_m.id and status='OFFERED';
    if not found then raise exception 'SHARED_MATCH_STATE_CHANGED'; end if;
    update public.travel_intents
       set status='RESOLVED',resolved_product_id=v_o.product_id,updated_at=now()
     where id=v_i.id and status='ACTIVE';

    insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
    values(v_ride.id,'RAAHI_SHARED_MATCH_ACCEPTED','PASSENGER',v_profile,'UPCOMING','UPCOMING',jsonb_build_object('shared_match_id',v_m.id,'trip_booking_id',v_booking,'seat_count',v_m.seat_count,'price_per_seat_inr',v_m.price_per_seat_inr));

    v_result:=jsonb_build_object(
      'match_id',v_m.id,'offering_id',v_o.id,'trip_booking_id',v_booking,
      'status','CONFIRMED','seat_count',v_m.seat_count,'price_per_seat_inr',v_m.price_per_seat_inr,
      'trip_confirmed',true,'ride_id',v_ride.id,'ride_booking_id',v_rb
    );
  end if;

  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.accept_shared_trip_match(uuid,text) from public,anon,authenticated;
grant execute on function private.accept_shared_trip_match(uuid,text) to authenticated;

create or replace function public.accept_shared_trip_match(p_match_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.accept_shared_trip_match(p_match_id,p_idempotency_key); $$;
revoke all on function public.accept_shared_trip_match(uuid,text) from public,anon,authenticated;
grant execute on function public.accept_shared_trip_match(uuid,text) to authenticated;

create or replace function private.decline_shared_trip_match(p_match_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_profile uuid:=auth.uid();
  v_offering_id uuid;
  v_m public.shared_trip_matches%rowtype;
  v_idem public.command_idempotency;
  v_next jsonb;
  v_result jsonb;
begin
  if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
  v_idem:=private.claim_user_command('decline_shared_trip_match',p_idempotency_key,md5(p_match_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  select m.offering_id into v_offering_id from public.shared_trip_matches m
   where m.id=p_match_id and m.passenger_profile_id=v_profile;
  if v_offering_id is null then raise exception 'SHARED_MATCH_NOT_FOUND'; end if;

  perform 1 from public.trip_offerings where id=v_offering_id for update;
  if not found then raise exception 'TRIP_OFFERING_NOT_FOUND'; end if;
  perform private.release_expired_shared_trip_holds(v_offering_id);
  select * into v_m from public.shared_trip_matches
   where id=p_match_id and passenger_profile_id=v_profile for update;
  if not found then raise exception 'SHARED_MATCH_NOT_FOUND'; end if;

  if v_m.status='DECLINED' then
    v_result:=jsonb_build_object('match_id',v_m.id,'status','DECLINED','next_offer_ready',false);
    return private.complete_user_command(v_idem.id,v_result);
  end if;
  if v_m.status='EXPIRED' then
    v_result:=jsonb_build_object('match_id',v_m.id,'status','EXPIRED','next_offer_ready',false);
    return private.complete_user_command(v_idem.id,v_result);
  end if;
  if v_m.status<>'OFFERED' then raise exception 'SHARED_MATCH_NOT_DECLINABLE'; end if;

  update public.trip_offerings set held_seats=held_seats-v_m.seat_count,updated_at=now()
   where id=v_offering_id and held_seats>=v_m.seat_count;
  if not found then raise exception 'SHARED_HOLD_STATE_INVALID'; end if;
  update public.shared_trip_matches set status='DECLINED',declined_at=now(),updated_at=now()
   where id=v_m.id and status='OFFERED';
  if not found then raise exception 'SHARED_MATCH_STATE_CHANGED'; end if;

  v_next:=private.match_shared_request(v_m.travel_intent_id);
  v_result:=jsonb_build_object(
    'match_id',v_m.id,'status','DECLINED',
    'next_offer_ready',coalesce((v_next->>'matched')::boolean,false),'next_match_id',v_next->'match_id'
  );
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.decline_shared_trip_match(uuid,text) from public,anon,authenticated;
grant execute on function private.decline_shared_trip_match(uuid,text) to authenticated;

create or replace function public.decline_shared_trip_match(p_match_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.decline_shared_trip_match(p_match_id,p_idempotency_key); $$;
revoke all on function public.decline_shared_trip_match(uuid,text) from public,anon,authenticated;
grant execute on function public.decline_shared_trip_match(uuid,text) to authenticated;

-- Replace the canonical direct Trip booking command so ordinary discovery bookings
-- cannot consume seats protected for Passenger-originated Raahi Shared requests.
create or replace function private.book_trip_seats(p_offering_id uuid,p_seat_count integer,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_profile uuid:=auth.uid();
  v_o public.trip_offerings%rowtype;
  v_driver public.drivers%rowtype;
  v_rules jsonb;
  v_max integer;
  v_booking uuid:=gen_random_uuid();
  v_rb uuid;
  v_idem public.command_idempotency;
  v_hash text;
  v_result jsonb;
  v_confirm jsonb;
  v_ride public.rides%rowtype;
begin
  if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
  v_hash:=md5(concat_ws('|',p_offering_id,p_seat_count));
  v_idem:=private.claim_user_command('book_trip_seats',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  select * into v_o from public.trip_offerings where id=p_offering_id for update;
  if not found then raise exception 'TRIP_OFFERING_NOT_FOUND'; end if;
  perform private.release_expired_shared_trip_holds(v_o.id);
  select * into v_o from public.trip_offerings where id=v_o.id;

  if not private.product_feature_enabled(v_o.product_id) then raise exception 'TRIP_PRODUCT_NOT_AVAILABLE'; end if;
  if v_o.status not in ('FILLING','CONFIRMED') or v_o.departure_at<=now() then raise exception 'TRIP_OFFERING_NOT_BOOKABLE'; end if;
  if v_o.status='FILLING' and v_o.confirmation_deadline<=now() then raise exception 'TRIP_CONFIRMATION_DEADLINE_PASSED'; end if;
  select * into v_driver from public.drivers where id=v_o.driver_id;
  if v_driver.profile_id=v_profile then raise exception 'TRIP_DRIVER_CANNOT_BOOK_SELF'; end if;
  select rules into v_rules from public.service_product_rule_versions where product_id=v_o.product_id and version_no=v_o.product_rules_version;
  v_max:=coalesce((v_rules->>'max_seats_per_booking')::integer,4);

  if p_seat_count<1 or p_seat_count>v_max or v_o.active_booked_seats+v_o.held_seats+p_seat_count>v_o.offered_seats then raise exception 'TRIP_CAPACITY_UNAVAILABLE'; end if;
  if exists(select 1 from public.trip_bookings b where b.offering_id=v_o.id and b.passenger_profile_id=v_profile and b.status in ('FILLING','CONFIRMED')) then raise exception 'TRIP_ACTIVE_BOOKING_EXISTS'; end if;

  if v_o.status='FILLING' then
    insert into public.trip_bookings(id,offering_id,passenger_profile_id,seat_count,price_per_seat_inr,status)
    values(v_booking,v_o.id,v_profile,p_seat_count,v_o.price_per_seat_inr,'FILLING');
    update public.trip_offerings set active_booked_seats=active_booked_seats+p_seat_count,updated_at=now() where id=v_o.id;
    if v_o.active_booked_seats+p_seat_count>=v_o.min_confirmation_seats then v_confirm:=private.confirm_trip_threshold_locked(v_o.id); end if;
    select * into v_o from public.trip_offerings where id=v_o.id;
    select ride_booking_id into v_rb from public.trip_bookings where id=v_booking;
    v_result:=jsonb_build_object('offering_id',v_o.id,'trip_booking_id',v_booking,'status',case when v_o.status='CONFIRMED' then 'CONFIRMED' else 'FILLING' end,'seat_count',p_seat_count,'price_per_seat_inr',v_o.price_per_seat_inr,'trip_confirmed',v_o.status='CONFIRMED','ride_id',v_o.ride_id,'ride_booking_id',v_rb);
  else
    if v_o.ride_id is null or v_o.commitment_id is null then raise exception 'TRIP_CONFIRMATION_STATE_INVALID'; end if;
    select * into v_ride from public.rides where id=v_o.ride_id for update;
    if not found or v_ride.status<>'UPCOMING' then raise exception 'TRIP_OFFERING_NOT_BOOKABLE'; end if;
    if v_ride.booked_seat_count+p_seat_count>v_ride.capacity then raise exception 'TRIP_CAPACITY_UNAVAILABLE'; end if;

    insert into public.trip_bookings(id,offering_id,passenger_profile_id,seat_count,price_per_seat_inr,status)
    values(v_booking,v_o.id,v_profile,p_seat_count,v_o.price_per_seat_inr,'CONFIRMED');
    v_rb:=gen_random_uuid();
    insert into public.ride_bookings(id,ride_id,passenger_request_id,outstation_request_id,carpool_booking_id,trip_booking_id,passenger_profile_id,seat_count,fare_per_seat_inr,boarding_context,commercial_model,quoted_total_inr)
    values(v_rb,v_ride.id,null,null,null,v_booking,v_profile,p_seat_count,v_o.price_per_seat_inr,jsonb_build_object('service_type','RAAHI_TRIP','trip_offering_id',v_o.id),'PER_SEAT',null);
    update public.trip_bookings set ride_booking_id=v_rb,updated_at=now() where id=v_booking;
    update public.rides set booked_seat_count=booked_seat_count+p_seat_count where id=v_ride.id;
    update public.trip_offerings set active_booked_seats=active_booked_seats+p_seat_count,updated_at=now() where id=v_o.id;
    insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
    values(v_ride.id,'RAAHI_TRIP_BOOKED','PASSENGER',v_profile,'UPCOMING','UPCOMING',jsonb_build_object('trip_booking_id',v_booking,'seat_count',p_seat_count,'price_per_seat_inr',v_o.price_per_seat_inr));
    v_result:=jsonb_build_object('offering_id',v_o.id,'trip_booking_id',v_booking,'status','CONFIRMED','seat_count',p_seat_count,'price_per_seat_inr',v_o.price_per_seat_inr,'trip_confirmed',true,'ride_id',v_ride.id,'ride_booking_id',v_rb);
  end if;

  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.book_trip_seats(uuid,integer,text) from public,anon,authenticated;
grant execute on function private.book_trip_seats(uuid,integer,text) to authenticated;

create or replace function public.book_trip_seats(p_offering_id uuid,p_seat_count integer,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.book_trip_seats(p_offering_id,p_seat_count,p_idempotency_key); $$;
revoke all on function public.book_trip_seats(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.book_trip_seats(uuid,integer,text) to authenticated;
