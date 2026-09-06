-- Slice 10B: Driver-owned publish/update/cancel and instant atomic Passenger booking.

update public.service_products
set corridor_id=null,display_name='Gomoh Carpool',
    public_summary='A Driver already making a journey from Gomoh can publish spare seats for instant eligible booking.'
where code='GOMOH_CARPOOL';

create or replace function private.carpool_driver_vehicle_eligible(p_driver_id uuid,p_vehicle_id uuid)
returns boolean language sql security definer stable set search_path=''
as $$
  select exists(
    select 1 from public.drivers d
    join public.driver_active_vehicles av on av.driver_id=d.id and av.vehicle_id=p_vehicle_id
    join public.driver_vehicle_access dva on dva.driver_id=d.id and dva.vehicle_id=p_vehicle_id and dva.revoked_at is null
    join public.vehicles v on v.id=p_vehicle_id and v.status='ELIGIBLE'
    where d.id=p_driver_id and d.standing='ACTIVE'
      and not exists (
        select 1 from (values ('PHONE'),('DRIVING_LICENCE'),('DRIVER_PHOTO')) req(t)
        where not exists(select 1 from public.verification_records vr
          where vr.driver_id=d.id and vr.verification_type=req.t and vr.status='VERIFIED'
            and (vr.expires_at is null or vr.expires_at>now()))
      )
      and not exists (
        select 1 from (values ('VEHICLE_RC'),('VEHICLE_PHOTOS')) req(t)
        where not exists(select 1 from public.verification_records vr
          where vr.vehicle_id=p_vehicle_id and vr.verification_type=req.t and vr.status='VERIFIED'
            and (vr.expires_at is null or vr.expires_at>now()))
      )
  );
$$;
revoke all on function private.carpool_driver_vehicle_eligible(uuid,uuid) from public,anon,authenticated;

create or replace function private.carpool_window_values(p_product_id uuid,p_rules_version integer,p_departure_at timestamptz)
returns tstzrange language sql security definer stable set search_path=''
as $$
  select tstzrange(
    p_departure_at-make_interval(mins=>coalesce((rv.rules->>'pre_departure_buffer_minutes')::int,0)),
    p_departure_at+make_interval(mins=>coalesce((rv.rules->>'journey_commitment_minutes')::int,240)+coalesce((rv.rules->>'post_arrival_buffer_minutes')::int,0)),
    '[)')
  from public.service_product_rule_versions rv
  where rv.product_id=p_product_id and rv.version_no=p_rules_version;
$$;
revoke all on function private.carpool_window_values(uuid,integer,timestamptz) from public,anon,authenticated;

create or replace function private.publish_carpool_journey(
  p_product_id uuid,p_vehicle_id uuid,p_origin_location_id uuid,p_destination_location_id uuid,
  p_departure_at timestamptz,p_offered_seats integer,p_contribution_per_seat_inr integer,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_driver uuid:=private.current_driver_id(); v_product public.service_products%rowtype;
  v_vehicle public.vehicles%rowtype; v_rules jsonb; v_window tstzrange;
  v_hash text; v_idem public.command_idempotency; v_id uuid; v_result jsonb;
  v_min_lead int; v_horizon int;
begin
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_hash:=md5(concat_ws('|',p_product_id,p_vehicle_id,p_origin_location_id,p_destination_location_id,p_departure_at,p_offered_seats,p_contribution_per_seat_inr));
  v_idem:=private.claim_user_command('publish_carpool_journey',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_product from public.service_products p where p.id=p_product_id and p.service_type='CARPOOL' and p.status in ('PILOT','ACTIVE');
  if not found or not exists(select 1 from public.markets m where m.id=v_product.market_id and m.status in ('PILOT','ACTIVE','SCALING')) then raise exception 'CARPOOL_PRODUCT_NOT_AVAILABLE'; end if;
  select * into v_vehicle from public.vehicles where id=p_vehicle_id;
  if not private.carpool_driver_vehicle_eligible(v_driver,p_vehicle_id) then raise exception 'CARPOOL_DRIVER_NOT_ELIGIBLE'; end if;
  if p_offered_seats<1 or p_offered_seats>v_vehicle.bookable_passenger_capacity then raise exception 'CARPOOL_CAPACITY_INVALID'; end if;
  if p_contribution_per_seat_inr<=0 then raise exception 'CARPOOL_CONTRIBUTION_INVALID'; end if;
  if not exists(select 1 from public.locations l where l.id=p_origin_location_id and l.market_id=v_product.market_id and l.is_active) then raise exception 'CARPOOL_ORIGIN_INVALID'; end if;
  if p_destination_location_id=p_origin_location_id or not exists(select 1 from public.locations l where l.id=p_destination_location_id and l.is_active) then raise exception 'CARPOOL_DESTINATION_INVALID'; end if;
  select rv.rules into v_rules from public.service_product_rule_versions rv where rv.product_id=v_product.id and rv.version_no=v_product.current_rules_version;
  v_min_lead:=coalesce((v_rules->>'min_departure_lead_minutes')::int,30);
  v_horizon:=coalesce((v_rules->>'max_publish_horizon_days')::int,30);
  if p_departure_at<now()+make_interval(mins=>v_min_lead) or p_departure_at>now()+make_interval(days=>v_horizon) then raise exception 'CARPOOL_DEPARTURE_INVALID'; end if;
  v_window:=private.carpool_window_values(v_product.id,v_product.current_rules_version,p_departure_at);
  if exists(select 1 from public.mobility_commitments c where (c.driver_id=v_driver or c.vehicle_id=p_vehicle_id) and c.status in ('RESERVED','ACTIVE') and c.starts_at<upper(v_window) and c.ends_at>lower(v_window)) then raise exception 'CARPOOL_COMMITMENT_CONFLICT'; end if;
  insert into public.carpool_journeys(product_id,product_rules_version,driver_id,vehicle_id,origin_market_id,origin_location_id,destination_location_id,departure_at,offered_seats,contribution_per_seat_inr)
  values(v_product.id,v_product.current_rules_version,v_driver,p_vehicle_id,v_product.market_id,p_origin_location_id,p_destination_location_id,p_departure_at,p_offered_seats,p_contribution_per_seat_inr)
  returning id into v_id;
  v_result:=jsonb_build_object('journey_id',v_id,'status','PUBLISHED','offered_seats',p_offered_seats,'contribution_per_seat_inr',p_contribution_per_seat_inr);
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.publish_carpool_journey(uuid,uuid,uuid,uuid,timestamptz,integer,integer,text) from public,anon,authenticated;
grant execute on function private.publish_carpool_journey(uuid,uuid,uuid,uuid,timestamptz,integer,integer,text) to authenticated;
create or replace function public.publish_carpool_journey(
  p_product_id uuid,p_vehicle_id uuid,p_origin_location_id uuid,p_destination_location_id uuid,
  p_departure_at timestamptz,p_offered_seats integer,p_contribution_per_seat_inr integer,p_idempotency_key text
) returns jsonb language sql security invoker set search_path=''
as $$ select private.publish_carpool_journey(p_product_id,p_vehicle_id,p_origin_location_id,p_destination_location_id,p_departure_at,p_offered_seats,p_contribution_per_seat_inr,p_idempotency_key); $$;
revoke all on function public.publish_carpool_journey(uuid,uuid,uuid,uuid,timestamptz,integer,integer,text) from public,anon,authenticated;
grant execute on function public.publish_carpool_journey(uuid,uuid,uuid,uuid,timestamptz,integer,integer,text) to authenticated;

create or replace function private.update_uncommitted_carpool(
  p_journey_id uuid,p_destination_location_id uuid,p_departure_at timestamptz,
  p_offered_seats integer,p_contribution_per_seat_inr integer,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_driver uuid:=private.current_driver_id(); v_j public.carpool_journeys%rowtype; v_vehicle public.vehicles%rowtype;
  v_rules jsonb; v_window tstzrange; v_hash text; v_idem public.command_idempotency; v_result jsonb; v_min_lead int; v_horizon int;
begin
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_hash:=md5(concat_ws('|',p_journey_id,p_destination_location_id,p_departure_at,p_offered_seats,p_contribution_per_seat_inr));
  v_idem:=private.claim_user_command('update_uncommitted_carpool',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_j from public.carpool_journeys where id=p_journey_id and driver_id=v_driver for update;
  if not found then raise exception 'CARPOOL_JOURNEY_NOT_FOUND'; end if;
  if v_j.status<>'PUBLISHED' or v_j.active_booked_seats<>0 or v_j.commitment_id is not null then raise exception 'CARPOOL_ALREADY_COMMITTED'; end if;
  select * into v_vehicle from public.vehicles where id=v_j.vehicle_id;
  if not private.carpool_driver_vehicle_eligible(v_driver,v_j.vehicle_id) then raise exception 'CARPOOL_DRIVER_NOT_ELIGIBLE'; end if;
  if p_offered_seats<1 or p_offered_seats>v_vehicle.bookable_passenger_capacity then raise exception 'CARPOOL_CAPACITY_INVALID'; end if;
  if p_contribution_per_seat_inr<=0 then raise exception 'CARPOOL_CONTRIBUTION_INVALID'; end if;
  if p_destination_location_id=v_j.origin_location_id or not exists(select 1 from public.locations l where l.id=p_destination_location_id and l.is_active) then raise exception 'CARPOOL_DESTINATION_INVALID'; end if;
  select rv.rules into v_rules from public.service_product_rule_versions rv where rv.product_id=v_j.product_id and rv.version_no=v_j.product_rules_version;
  v_min_lead:=coalesce((v_rules->>'min_departure_lead_minutes')::int,30); v_horizon:=coalesce((v_rules->>'max_publish_horizon_days')::int,30);
  if p_departure_at<now()+make_interval(mins=>v_min_lead) or p_departure_at>now()+make_interval(days=>v_horizon) then raise exception 'CARPOOL_DEPARTURE_INVALID'; end if;
  v_window:=private.carpool_window_values(v_j.product_id,v_j.product_rules_version,p_departure_at);
  if exists(select 1 from public.mobility_commitments c where (c.driver_id=v_driver or c.vehicle_id=v_j.vehicle_id) and c.status in ('RESERVED','ACTIVE') and c.starts_at<upper(v_window) and c.ends_at>lower(v_window)) then raise exception 'CARPOOL_COMMITMENT_CONFLICT'; end if;
  update public.carpool_journeys set destination_location_id=p_destination_location_id,departure_at=p_departure_at,offered_seats=p_offered_seats,contribution_per_seat_inr=p_contribution_per_seat_inr where id=v_j.id;
  v_result:=jsonb_build_object('journey_id',v_j.id,'status','PUBLISHED','offered_seats',p_offered_seats,'contribution_per_seat_inr',p_contribution_per_seat_inr,'departure_at',p_departure_at);
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.update_uncommitted_carpool(uuid,uuid,timestamptz,integer,integer,text) from public,anon,authenticated;
grant execute on function private.update_uncommitted_carpool(uuid,uuid,timestamptz,integer,integer,text) to authenticated;
create or replace function public.update_uncommitted_carpool(p_journey_id uuid,p_destination_location_id uuid,p_departure_at timestamptz,p_offered_seats integer,p_contribution_per_seat_inr integer,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.update_uncommitted_carpool(p_journey_id,p_destination_location_id,p_departure_at,p_offered_seats,p_contribution_per_seat_inr,p_idempotency_key); $$;
revoke all on function public.update_uncommitted_carpool(uuid,uuid,timestamptz,integer,integer,text) from public,anon,authenticated;
grant execute on function public.update_uncommitted_carpool(uuid,uuid,timestamptz,integer,integer,text) to authenticated;

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
  insert into public.ride_bookings(id,ride_id,passenger_request_id,outstation_request_id,carpool_booking_id,passenger_profile_id,seat_count,fare_per_seat_inr,total_fare_inr,boarding_context,commercial_model,quoted_total_inr)
  values(v_ride_booking,v_ride,null,null,v_booking,v_profile,p_seat_count,v_j.contribution_per_seat_inr,p_seat_count*v_j.contribution_per_seat_inr,jsonb_build_object('service_type','CARPOOL','journey_id',v_j.id),'PER_SEAT',null);
  update public.carpool_bookings set ride_booking_id=v_ride_booking where id=v_booking;
  update public.carpool_journeys set active_booked_seats=active_booked_seats+p_seat_count,status=case when active_booked_seats+p_seat_count=offered_seats then 'FULL' else 'PUBLISHED' end where id=v_j.id;
  insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
  values(v_ride,'CARPOOL_BOOKED','PASSENGER',v_profile,'UPCOMING','UPCOMING',jsonb_build_object('carpool_booking_id',v_booking,'seat_count',p_seat_count,'contribution_per_seat_inr',v_j.contribution_per_seat_inr));
  v_result:=jsonb_build_object('journey_id',v_j.id,'carpool_booking_id',v_booking,'ride_id',v_ride,'ride_booking_id',v_ride_booking,'seat_count',p_seat_count,'contribution_per_seat_inr',v_j.contribution_per_seat_inr,'status','ACTIVE');
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.book_carpool_seats(uuid,integer,text) from public,anon,authenticated;
grant execute on function private.book_carpool_seats(uuid,integer,text) to authenticated;
create or replace function public.book_carpool_seats(p_journey_id uuid,p_seat_count integer,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.book_carpool_seats(p_journey_id,p_seat_count,p_idempotency_key); $$;
revoke all on function public.book_carpool_seats(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.book_carpool_seats(uuid,integer,text) to authenticated;

create or replace function private.cancel_carpool_booking(p_carpool_booking_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_profile uuid:=auth.uid(); v_b public.carpool_bookings%rowtype; v_j public.carpool_journeys%rowtype; v_ride public.rides%rowtype;
 v_hash text; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
 v_hash:=md5(p_carpool_booking_id::text); v_idem:=private.claim_user_command('cancel_carpool_booking',p_idempotency_key,v_hash);
 if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_b from public.carpool_bookings where id=p_carpool_booking_id and passenger_profile_id=v_profile for update;
 if not found then raise exception 'CARPOOL_BOOKING_NOT_FOUND'; end if;
 if v_b.status='CANCELLED' then v_result:=jsonb_build_object('carpool_booking_id',v_b.id,'status','CANCELLED'); return private.complete_user_command(v_idem.id,v_result); end if;
 if v_b.status<>'ACTIVE' then raise exception 'CARPOOL_BOOKING_NOT_CANCELLABLE'; end if;
 select * into v_j from public.carpool_journeys where id=v_b.journey_id for update;
 select * into v_ride from public.rides where id=v_j.ride_id for update;
 if v_ride.id is null or v_ride.status<>'UPCOMING' then raise exception 'CARPOOL_ALREADY_IN_FULFILMENT'; end if;
 update public.carpool_bookings set status='CANCELLED',cancelled_at=now() where id=v_b.id;
 update public.ride_bookings set status='CANCELLED' where id=v_b.ride_booking_id and status='ASSIGNED';
 update public.carpool_journeys set active_booked_seats=active_booked_seats-v_b.seat_count,
   status=case when status='CHANGE_PENDING' then status else 'PUBLISHED' end where id=v_j.id;
 update public.rides set booked_seat_count=booked_seat_count-v_b.seat_count where id=v_ride.id and booked_seat_count>=v_b.seat_count;
 update public.carpool_booking_change_consents set status='REJECTED',responded_at=now() where carpool_booking_id=v_b.id and status='PENDING';
 insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
 values(v_ride.id,'CARPOOL_BOOKING_CANCELLED','PASSENGER',v_profile,'UPCOMING','UPCOMING',jsonb_build_object('carpool_booking_id',v_b.id,'seat_count',v_b.seat_count));
 v_result:=jsonb_build_object('carpool_booking_id',v_b.id,'journey_id',v_j.id,'status','CANCELLED');
 return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.cancel_carpool_booking(uuid,text) from public,anon,authenticated;
grant execute on function private.cancel_carpool_booking(uuid,text) to authenticated;
create or replace function public.cancel_carpool_booking(p_carpool_booking_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.cancel_carpool_booking(p_carpool_booking_id,p_idempotency_key); $$;
revoke all on function public.cancel_carpool_booking(uuid,text) from public,anon,authenticated;
grant execute on function public.cancel_carpool_booking(uuid,text) to authenticated;

create or replace function private.cancel_carpool_journey(p_journey_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_j public.carpool_journeys%rowtype; v_ride public.rides%rowtype; v_hash text; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
 v_hash:=md5(p_journey_id::text); v_idem:=private.claim_user_command('cancel_carpool_journey',p_idempotency_key,v_hash);
 if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_j from public.carpool_journeys where id=p_journey_id and driver_id=v_driver for update;
 if not found then raise exception 'CARPOOL_JOURNEY_NOT_FOUND'; end if;
 if v_j.status='DRIVER_CANCELLED' then v_result:=jsonb_build_object('journey_id',v_j.id,'status','DRIVER_CANCELLED'); return private.complete_user_command(v_idem.id,v_result); end if;
 if v_j.status not in ('PUBLISHED','FULL','CHANGE_PENDING') then raise exception 'CARPOOL_JOURNEY_NOT_CANCELLABLE'; end if;
 if v_j.ride_id is not null then
   select * into v_ride from public.rides where id=v_j.ride_id for update;
   if v_ride.status<>'UPCOMING' then raise exception 'CARPOOL_ALREADY_IN_FULFILMENT'; end if;
   update public.rides set status='CANCELLED' where id=v_ride.id;
   update public.ride_bookings set status='CANCELLED' where ride_id=v_ride.id and status='ASSIGNED';
   update public.mobility_commitments set status='RELEASED' where id=v_j.commitment_id and status='RESERVED';
   insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state)
   values(v_ride.id,'CARPOOL_DRIVER_CANCELLED','DRIVER',auth.uid(),'UPCOMING','CANCELLED');
 end if;
 update public.carpool_bookings set status='DRIVER_CANCELLED',cancelled_at=now() where journey_id=v_j.id and status='ACTIVE';
 update public.carpool_change_proposals set status='CANCELLED',resolved_at=now() where journey_id=v_j.id and status='PENDING';
 update public.carpool_journeys set status='DRIVER_CANCELLED',active_booked_seats=0,cancelled_at=now() where id=v_j.id;
 v_result:=jsonb_build_object('journey_id',v_j.id,'status','DRIVER_CANCELLED');
 return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.cancel_carpool_journey(uuid,text) from public,anon,authenticated;
grant execute on function private.cancel_carpool_journey(uuid,text) to authenticated;
create or replace function public.cancel_carpool_journey(p_journey_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.cancel_carpool_journey(p_journey_id,p_idempotency_key); $$;
revoke all on function public.cancel_carpool_journey(uuid,text) from public,anon,authenticated;
grant execute on function public.cancel_carpool_journey(uuid,text) to authenticated;