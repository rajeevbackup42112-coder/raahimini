create or replace function private.cancel_trip_booking(p_trip_booking_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_profile uuid:=auth.uid(); v_b public.trip_bookings%rowtype; v_o public.trip_offerings%rowtype; v_ride public.rides%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
 v_idem:=private.claim_user_command('cancel_trip_booking',p_idempotency_key,md5(p_trip_booking_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_b from public.trip_bookings where id=p_trip_booking_id and passenger_profile_id=v_profile for update; if not found then raise exception 'TRIP_BOOKING_NOT_FOUND'; end if;
 if v_b.status='CANCELLED' then v_result:=jsonb_build_object('trip_booking_id',v_b.id,'status','CANCELLED'); return private.complete_user_command(v_idem.id,v_result); end if;
 if v_b.status not in ('FILLING','CONFIRMED') then raise exception 'TRIP_BOOKING_NOT_CANCELLABLE'; end if;
 select * into v_o from public.trip_offerings where id=v_b.offering_id for update;
 if v_b.status='CONFIRMED' then
  if v_o.ride_id is null then raise exception 'TRIP_CONFIRMATION_STATE_INVALID'; end if;
  select * into v_ride from public.rides where id=v_o.ride_id for update; if v_ride.status<>'UPCOMING' then raise exception 'TRIP_ALREADY_IN_FULFILMENT'; end if;
  update public.ride_bookings set status='CANCELLED' where id=v_b.ride_booking_id and status='ASSIGNED';
  update public.rides set booked_seat_count=booked_seat_count-v_b.seat_count where id=v_ride.id and booked_seat_count>=v_b.seat_count;
  insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata) values(v_ride.id,'RAAHI_TRIP_BOOKING_CANCELLED','PASSENGER',v_profile,'UPCOMING','UPCOMING',jsonb_build_object('trip_booking_id',v_b.id,'seat_count',v_b.seat_count,'trip_remains_confirmed',true));
 end if;
 update public.trip_bookings set status='CANCELLED',cancelled_at=now(),updated_at=now() where id=v_b.id;
 update public.trip_offerings set active_booked_seats=active_booked_seats-v_b.seat_count,updated_at=now() where id=v_o.id;
 v_result:=jsonb_build_object('trip_booking_id',v_b.id,'offering_id',v_o.id,'status','CANCELLED','trip_status',v_o.status);
 return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.cancel_trip_booking(uuid,text) from public,anon,authenticated; grant execute on function private.cancel_trip_booking(uuid,text) to authenticated;
create or replace function public.cancel_trip_booking(p_trip_booking_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.cancel_trip_booking(p_trip_booking_id,p_idempotency_key); $$;
revoke all on function public.cancel_trip_booking(uuid,text) from public,anon,authenticated; grant execute on function public.cancel_trip_booking(uuid,text) to authenticated;

create or replace function private.expire_trip_offering(p_offering_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_o public.trip_offerings%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 v_idem:=private.claim_system_command('expire_trip_offering',p_idempotency_key,md5(p_offering_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_o from public.trip_offerings where id=p_offering_id for update; if not found then raise exception 'TRIP_OFFERING_NOT_FOUND'; end if;
 if v_o.status='CONFIRMED' then v_result:=jsonb_build_object('offering_id',v_o.id,'status','CONFIRMED','changed',false); update public.command_idempotency set status='SUCCEEDED',result=v_result,completed_at=now() where id=v_idem.id; return v_result; end if;
 if v_o.status='NOT_CONFIRMED' then v_result:=jsonb_build_object('offering_id',v_o.id,'status','NOT_CONFIRMED','changed',false); update public.command_idempotency set status='SUCCEEDED',result=v_result,completed_at=now() where id=v_idem.id; return v_result; end if;
 if v_o.status<>'FILLING' then raise exception 'TRIP_OFFERING_NOT_EXPIRABLE'; end if;
 if now()<v_o.confirmation_deadline then raise exception 'TRIP_CONFIRMATION_DEADLINE_NOT_REACHED'; end if;
 if v_o.active_booked_seats>=v_o.min_confirmation_seats then raise exception 'TRIP_THRESHOLD_REACHED_NOT_CONFIRMED'; end if;
 update public.trip_bookings set status='NOT_CONFIRMED',updated_at=now() where offering_id=v_o.id and status='FILLING';
 update public.trip_offerings set status='NOT_CONFIRMED',active_booked_seats=0,not_confirmed_at=now(),updated_at=now() where id=v_o.id;
 v_result:=jsonb_build_object('offering_id',v_o.id,'status','NOT_CONFIRMED','changed',true,'penalty_free',true);
 update public.command_idempotency set status='SUCCEEDED',result=v_result,completed_at=now() where id=v_idem.id;
 return v_result;
end; $$;
revoke all on function private.expire_trip_offering(uuid,text) from public,anon,authenticated; grant execute on function private.expire_trip_offering(uuid,text) to service_role;