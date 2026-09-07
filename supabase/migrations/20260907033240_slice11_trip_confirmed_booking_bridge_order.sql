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
  insert into public.trip_bookings(id,offering_id,passenger_profile_id,seat_count,price_per_seat_inr,status) values(v_booking,v_o.id,v_profile,p_seat_count,v_o.price_per_seat_inr,'CONFIRMED');
  insert into public.ride_bookings(id,ride_id,passenger_request_id,outstation_request_id,carpool_booking_id,trip_booking_id,passenger_profile_id,seat_count,fare_per_seat_inr,boarding_context,commercial_model,quoted_total_inr)
  values(v_rb,v_ride.id,null,null,null,v_booking,v_profile,p_seat_count,v_o.price_per_seat_inr,jsonb_build_object('service_type','RAAHI_TRIP','trip_offering_id',v_o.id),'PER_SEAT',null);
  update public.trip_bookings set ride_booking_id=v_rb,updated_at=now() where id=v_booking;
  update public.trip_offerings set active_booked_seats=active_booked_seats+p_seat_count,updated_at=now() where id=v_o.id;
  insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata) values(v_ride.id,'RAAHI_TRIP_BOOKED','PASSENGER',v_profile,'UPCOMING','UPCOMING',jsonb_build_object('trip_booking_id',v_booking,'seat_count',p_seat_count,'price_per_seat_inr',v_o.price_per_seat_inr));
  v_result:=jsonb_build_object('offering_id',v_o.id,'trip_booking_id',v_booking,'status','CONFIRMED','seat_count',p_seat_count,'price_per_seat_inr',v_o.price_per_seat_inr,'trip_confirmed',true,'ride_id',v_ride.id,'ride_booking_id',v_rb);
 end if;
 return private.complete_user_command(v_idem.id,v_result);
end; $$;
