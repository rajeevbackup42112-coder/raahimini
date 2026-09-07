create or replace function private.confirm_trip_threshold_locked(p_offering_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_o public.trip_offerings%rowtype; v_window tstzrange; v_commitment uuid; v_ride uuid; v_origin text; v_destination text; v_b public.trip_bookings%rowtype; v_rb uuid; v_count int:=0;
begin
 select * into v_o from public.trip_offerings where id=p_offering_id for update;
 if not found then raise exception 'TRIP_OFFERING_NOT_FOUND'; end if;
 if v_o.status='CONFIRMED' then return jsonb_build_object('confirmed',true,'offering_id',v_o.id,'ride_id',v_o.ride_id,'commitment_id',v_o.commitment_id); end if;
 if v_o.status<>'FILLING' then return jsonb_build_object('confirmed',false,'offering_id',v_o.id,'status',v_o.status); end if;
 if v_o.active_booked_seats<v_o.min_confirmation_seats then return jsonb_build_object('confirmed',false,'offering_id',v_o.id,'status','FILLING'); end if;
 if v_o.confirmation_deadline<=now() then raise exception 'TRIP_CONFIRMATION_DEADLINE_PASSED'; end if;
 if not private.raahi_trip_driver_vehicle_eligible(v_o.driver_id,v_o.vehicle_id,v_o.origin_market_id) then raise exception 'TRIP_DRIVER_NOT_ELIGIBLE'; end if;
 v_window:=private.raahi_trip_commitment_window(v_o.product_id,v_o.product_rules_version,v_o.departure_at,v_o.return_departure_at);
 begin
  insert into public.mobility_commitments(driver_id,vehicle_id,product_id,origin_market_id,source_type,source_id,starts_at,ends_at,status)
  values(v_o.driver_id,v_o.vehicle_id,v_o.product_id,v_o.origin_market_id,'RAAHI_TRIP',v_o.id,lower(v_window),upper(v_window),'RESERVED') returning id into v_commitment;
 exception when exclusion_violation then raise exception 'TRIP_COMMITMENT_CONFLICT'; end;
 select name into v_origin from public.locations where id=v_o.origin_location_id;
 select name into v_destination from public.locations where id=v_o.destination_location_id;
 insert into public.rides(product_id,product_rules_version,driver_id,vehicle_id,origin_market_id,origin_location_id,destination_location_id,commitment_id,capacity,booked_seat_count,fare_per_seat_inr,status,matched_at,driver_ack_deadline,commitment_ends_at,commercial_model,whole_car_total_inr,origin_text_snapshot,destination_text_snapshot,return_not_before,trip_offering_id)
 values(v_o.product_id,v_o.product_rules_version,v_o.driver_id,v_o.vehicle_id,v_o.origin_market_id,v_o.origin_location_id,v_o.destination_location_id,v_commitment,v_o.offered_seats,v_o.active_booked_seats,v_o.price_per_seat_inr,'UPCOMING',now(),null,upper(v_window),'PER_SEAT',null,v_origin,v_destination,v_o.return_departure_at,v_o.id)
 returning id into v_ride;
 for v_b in select * from public.trip_bookings where offering_id=v_o.id and status='FILLING' order by booked_at,id for update loop
  v_rb:=gen_random_uuid();
  insert into public.ride_bookings(id,ride_id,passenger_request_id,outstation_request_id,carpool_booking_id,trip_booking_id,passenger_profile_id,seat_count,fare_per_seat_inr,boarding_context,commercial_model,quoted_total_inr)
  values(v_rb,v_ride,null,null,null,v_b.id,v_b.passenger_profile_id,v_b.seat_count,v_b.price_per_seat_inr,jsonb_build_object('service_type','RAAHI_TRIP','trip_offering_id',v_o.id),'PER_SEAT',null);
  update public.trip_bookings set status='CONFIRMED',ride_booking_id=v_rb,updated_at=now() where id=v_b.id;
  v_count:=v_count+1;
 end loop;
 update public.trip_offerings set status='CONFIRMED',commitment_id=v_commitment,ride_id=v_ride,confirmed_at=now(),updated_at=now() where id=v_o.id;
 insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
 values(v_ride,'RAAHI_TRIP_CONFIRMED','SYSTEM',null,null,'UPCOMING',jsonb_build_object('trip_offering_id',v_o.id,'confirmed_seats',v_o.active_booked_seats,'booking_count',v_count,'threshold',v_o.min_confirmation_seats));
 return jsonb_build_object('confirmed',true,'offering_id',v_o.id,'ride_id',v_ride,'commitment_id',v_commitment,'confirmed_seats',v_o.active_booked_seats);
end; $$;
revoke all on function private.confirm_trip_threshold_locked(uuid) from public,anon,authenticated;

create or replace function private.book_trip_seats(p_offering_id uuid,p_seat_count integer,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_profile uuid:=auth.uid(); v_o public.trip_offerings%rowtype; v_driver public.drivers%rowtype; v_rules jsonb; v_max int; v_booking uuid:=gen_random_uuid(); v_rb uuid; v_idem public.command_idempotency; v_hash text; v_result jsonb; v_confirm jsonb; v_ride public.rides%rowtype;
begin
 if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
 v_hash:=md5(concat_ws('|',p_offering_id,p_seat_count)); v_idem:=private.claim_user_command('book_trip_seats',p_idempotency_key,v_hash); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_o from public.trip_offerings where id=p_offering_id for update; if not found then raise exception 'TRIP_OFFERING_NOT_FOUND'; end if;
 if v_o.status not in ('FILLING','CONFIRMED') or v_o.departure_at<=now() then raise exception 'TRIP_OFFERING_NOT_BOOKABLE'; end if;
 if v_o.status='FILLING' and v_o.confirmation_deadline<=now() then raise exception 'TRIP_CONFIRMATION_DEADLINE_PASSED'; end if;
 select * into v_driver from public.drivers where id=v_o.driver_id; if v_driver.profile_id=v_profile then raise exception 'TRIP_DRIVER_CANNOT_BOOK_SELF'; end if;
 select rules into v_rules from public.service_product_rule_versions where product_id=v_o.product_id and version_no=v_o.product_rules_version; v_max:=coalesce((v_rules->>'max_seats_per_booking')::int,4);
 if p_seat_count<1 or p_seat_count>v_max or v_o.active_booked_seats+p_seat_count>v_o.offered_seats then raise exception 'TRIP_CAPACITY_UNAVAILABLE'; end if;
 if exists(select 1 from public.trip_bookings b where b.offering_id=v_o.id and b.passenger_profile_id=v_profile and b.status in ('FILLING','CONFIRMED')) then raise exception 'TRIP_ACTIVE_BOOKING_EXISTS'; end if;
 if v_o.status='FILLING' then
  insert into public.trip_bookings(id,offering_id,passenger_profile_id,seat_count,price_per_seat_inr,status) values(v_booking,v_o.id,v_profile,p_seat_count,v_o.price_per_seat_inr,'FILLING');
  update public.trip_offerings set active_booked_seats=active_booked_seats+p_seat_count,updated_at=now() where id=v_o.id;
  if v_o.active_booked_seats+p_seat_count>=v_o.min_confirmation_seats then v_confirm:=private.confirm_trip_threshold_locked(v_o.id); end if;
  select * into v_o from public.trip_offerings where id=v_o.id;
  select ride_booking_id into v_rb from public.trip_bookings where id=v_booking;
  v_result:=jsonb_build_object('offering_id',v_o.id,'trip_booking_id',v_booking,'status',case when v_o.status='CONFIRMED' then 'CONFIRMED' else 'FILLING' end,'seat_count',p_seat_count,'price_per_seat_inr',v_o.price_per_seat_inr,'trip_confirmed',v_o.status='CONFIRMED','ride_id',v_o.ride_id,'ride_booking_id',v_rb);
 else
  if v_o.ride_id is null or v_o.commitment_id is null then raise exception 'TRIP_CONFIRMATION_STATE_INVALID'; end if;
  select * into v_ride from public.rides where id=v_o.ride_id for update; if not found or v_ride.status<>'UPCOMING' then raise exception 'TRIP_OFFERING_NOT_BOOKABLE'; end if;
  update public.rides set booked_seat_count=booked_seat_count+p_seat_count where id=v_ride.id and booked_seat_count+p_seat_count<=capacity; if not found then raise exception 'TRIP_CAPACITY_UNAVAILABLE'; end if;
  v_rb:=gen_random_uuid();
  insert into public.trip_bookings(id,offering_id,passenger_profile_id,seat_count,price_per_seat_inr,status,ride_booking_id) values(v_booking,v_o.id,v_profile,p_seat_count,v_o.price_per_seat_inr,'CONFIRMED',v_rb);
  insert into public.ride_bookings(id,ride_id,passenger_request_id,outstation_request_id,carpool_booking_id,trip_booking_id,passenger_profile_id,seat_count,fare_per_seat_inr,boarding_context,commercial_model,quoted_total_inr)
  values(v_rb,v_ride.id,null,null,null,v_booking,v_profile,p_seat_count,v_o.price_per_seat_inr,jsonb_build_object('service_type','RAAHI_TRIP','trip_offering_id',v_o.id),'PER_SEAT',null);
  update public.trip_offerings set active_booked_seats=active_booked_seats+p_seat_count,updated_at=now() where id=v_o.id;
  insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata) values(v_ride.id,'RAAHI_TRIP_BOOKED','PASSENGER',v_profile,'UPCOMING','UPCOMING',jsonb_build_object('trip_booking_id',v_booking,'seat_count',p_seat_count,'price_per_seat_inr',v_o.price_per_seat_inr));
  v_result:=jsonb_build_object('offering_id',v_o.id,'trip_booking_id',v_booking,'status','CONFIRMED','seat_count',p_seat_count,'price_per_seat_inr',v_o.price_per_seat_inr,'trip_confirmed',true,'ride_id',v_ride.id,'ride_booking_id',v_rb);
 end if;
 return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.book_trip_seats(uuid,integer,text) from public,anon,authenticated; grant execute on function private.book_trip_seats(uuid,integer,text) to authenticated;
create or replace function public.book_trip_seats(p_offering_id uuid,p_seat_count integer,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.book_trip_seats(p_offering_id,p_seat_count,p_idempotency_key); $$;
revoke all on function public.book_trip_seats(uuid,integer,text) from public,anon,authenticated; grant execute on function public.book_trip_seats(uuid,integer,text) to authenticated;