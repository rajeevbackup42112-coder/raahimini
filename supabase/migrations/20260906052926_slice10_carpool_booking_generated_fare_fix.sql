create or replace function private.book_carpool_seats(p_journey_id uuid,p_seat_count integer,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_profile uuid:=auth.uid(); v_j public.carpool_journeys%rowtype; v_rules jsonb; v_driver public.drivers%rowtype; v_vehicle public.vehicles%rowtype;
  v_window tstzrange; v_commitment uuid; v_ride uuid; v_booking uuid:=gen_random_uuid(); v_ride_booking uuid:=gen_random_uuid();
  v_hash text; v_idem public.command_idempotency; v_result jsonb; v_max int; v_origin text; v_destination text;
begin
  if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
  v_hash:=md5(concat_ws('|',p_journey_id,p_seat_count));
  v_idem:=private.claim_user_command('book_carpool_seats',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_j from public.carpool_journeys where id=p_journey_id for update;
  if not found then raise exception 'CARPOOL_JOURNEY_NOT_FOUND'; end if;
  if v_j.status not in ('PUBLISHED','FULL') or v_j.departure_at<=now() then raise exception 'CARPOOL_JOURNEY_NOT_BOOKABLE'; end if;
  if v_j.status='FULL' then raise exception 'CARPOOL_CAPACITY_UNAVAILABLE'; end if;
  select * into v_driver from public.drivers where id=v_j.driver_id;
  if v_driver.profile_id=v_profile then raise exception 'CARPOOL_DRIVER_CANNOT_BOOK_SELF'; end if;
  if not private.carpool_driver_vehicle_eligible(v_j.driver_id,v_j.vehicle_id) then raise exception 'CARPOOL_DRIVER_NOT_ELIGIBLE'; end if;
  select * into v_vehicle from public.vehicles where id=v_j.vehicle_id;
  select rv.rules into v_rules from public.service_product_rule_versions rv where rv.product_id=v_j.product_id and rv.version_no=v_j.product_rules_version;
  v_max:=coalesce((v_rules->>'max_seats_per_booking')::int,4);
  if p_seat_count<1 or p_seat_count>v_max or v_j.active_booked_seats+p_seat_count>v_j.offered_seats then raise exception 'CARPOOL_CAPACITY_UNAVAILABLE'; end if;
  if exists(select 1 from public.carpool_bookings b where b.journey_id=v_j.id and b.passenger_profile_id=v_profile and b.status='ACTIVE') then raise exception 'CARPOOL_ACTIVE_BOOKING_EXISTS'; end if;
  v_window:=private.carpool_window_values(v_j.product_id,v_j.product_rules_version,v_j.departure_at);
  if v_j.commitment_id is null then
    begin
      insert into public.mobility_commitments(driver_id,vehicle_id,product_id,origin_market_id,source_type,source_id,starts_at,ends_at,status)
      values(v_j.driver_id,v_j.vehicle_id,v_j.product_id,v_j.origin_market_id,'CARPOOL',v_j.id,lower(v_window),upper(v_window),'RESERVED') returning id into v_commitment;
    exception when exclusion_violation then raise exception 'CARPOOL_COMMITMENT_CONFLICT'; end;
    select l.name into v_origin from public.locations l where l.id=v_j.origin_location_id;
    select l.name into v_destination from public.locations l where l.id=v_j.destination_location_id;
    insert into public.rides(product_id,product_rules_version,driver_id,vehicle_id,origin_market_id,origin_location_id,destination_location_id,commitment_id,capacity,booked_seat_count,fare_per_seat_inr,status,matched_at,driver_ack_deadline,commitment_ends_at,commercial_model,whole_car_total_inr,carpool_journey_id,origin_text_snapshot,destination_text_snapshot)
    values(v_j.product_id,v_j.product_rules_version,v_j.driver_id,v_j.vehicle_id,v_j.origin_market_id,v_j.origin_location_id,v_j.destination_location_id,v_commitment,v_j.offered_seats,p_seat_count,v_j.contribution_per_seat_inr,'UPCOMING',now(),null,upper(v_window),'PER_SEAT',null,v_j.id,v_origin,v_destination)
    returning id into v_ride;
    update public.carpool_journeys set commitment_id=v_commitment,ride_id=v_ride where id=v_j.id;
  else
    v_commitment:=v_j.commitment_id; v_ride:=v_j.ride_id;
    if v_ride is null then raise exception 'CARPOOL_COMMITMENT_STATE_INVALID'; end if;
    if not exists(select 1 from public.mobility_commitments c where c.id=v_commitment and c.status='RESERVED') then raise exception 'CARPOOL_JOURNEY_NOT_BOOKABLE'; end if;
    update public.rides set booked_seat_count=booked_seat_count+p_seat_count where id=v_ride and status='UPCOMING' and booked_seat_count+p_seat_count<=capacity;
    if not found then raise exception 'CARPOOL_JOURNEY_NOT_BOOKABLE'; end if;
  end if;
  insert into public.carpool_bookings(id,journey_id,passenger_profile_id,seat_count,contribution_per_seat_inr)
  values(v_booking,v_j.id,v_profile,p_seat_count,v_j.contribution_per_seat_inr);
  insert into public.ride_bookings(id,ride_id,passenger_request_id,outstation_request_id,carpool_booking_id,passenger_profile_id,seat_count,fare_per_seat_inr,boarding_context,commercial_model,quoted_total_inr)
  values(v_ride_booking,v_ride,null,null,v_booking,v_profile,p_seat_count,v_j.contribution_per_seat_inr,jsonb_build_object('service_type','CARPOOL','journey_id',v_j.id),'PER_SEAT',null);
  update public.carpool_bookings set ride_booking_id=v_ride_booking where id=v_booking;
  update public.carpool_journeys set active_booked_seats=active_booked_seats+p_seat_count,status=case when active_booked_seats+p_seat_count=offered_seats then 'FULL' else 'PUBLISHED' end where id=v_j.id;
  insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
  values(v_ride,'CARPOOL_BOOKED','PASSENGER',v_profile,'UPCOMING','UPCOMING',jsonb_build_object('carpool_booking_id',v_booking,'seat_count',p_seat_count,'contribution_per_seat_inr',v_j.contribution_per_seat_inr));
  v_result:=jsonb_build_object('journey_id',v_j.id,'carpool_booking_id',v_booking,'ride_id',v_ride,'ride_booking_id',v_ride_booking,'seat_count',p_seat_count,'contribution_per_seat_inr',v_j.contribution_per_seat_inr,'status','ACTIVE');
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.book_carpool_seats(uuid,integer,text) from public,anon,authenticated;
grant execute on function private.book_carpool_seats(uuid,integer,text) to authenticated;