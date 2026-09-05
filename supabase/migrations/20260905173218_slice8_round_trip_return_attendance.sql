create or replace function private.driver_mark_fixed_return_boarded(p_booking_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_driver_id uuid:=private.current_driver_id();
  v_idem public.command_idempotency%rowtype;
  v_booking public.ride_bookings%rowtype;
  v_ride public.rides%rowtype;
  v_result jsonb;
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem:=private.claim_user_command('driver_mark_fixed_return_boarded',p_idempotency_key,md5(p_booking_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_booking from public.ride_bookings b where b.id=p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  select * into v_ride from public.rides r where r.id=v_booking.ride_id and r.driver_id=v_driver_id for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  if v_ride.status<>'RETURN_BOARDING' or v_booking.status<>'BOARDED' then raise exception 'BOOKING_TRANSITION_INVALID'; end if;
  if v_booking.return_status='BOARDED' then
    v_result:=jsonb_build_object('booking_id',v_booking.id,'return_status',v_booking.return_status);
  elsif v_booking.return_status<>'PENDING' then raise exception 'BOOKING_TRANSITION_INVALID';
  else
    update public.ride_bookings set return_status='BOARDED',return_boarded_at=now() where id=v_booking.id;
    insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
    values(v_ride.id,'PASSENGER_RETURN_BOARDED','DRIVER',auth.uid(),'RETURN_BOARDING','RETURN_BOARDING',
      jsonb_build_object('booking_id',v_booking.id,'seat_count',v_booking.seat_count));
    v_result:=jsonb_build_object('booking_id',v_booking.id,'return_status','BOARDED');
  end if;
  perform private.finish_user_command(v_idem.id,v_result); return v_result;
end; $$;
revoke all on function private.driver_mark_fixed_return_boarded(uuid,text) from public,anon,authenticated;
grant execute on function private.driver_mark_fixed_return_boarded(uuid,text) to authenticated;
create or replace function public.driver_mark_fixed_return_boarded(p_booking_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.driver_mark_fixed_return_boarded(p_booking_id,p_idempotency_key); $$;
revoke all on function public.driver_mark_fixed_return_boarded(uuid,text) from public,anon,authenticated;
grant execute on function public.driver_mark_fixed_return_boarded(uuid,text) to authenticated;

create or replace function private.driver_report_fixed_return_no_show(p_booking_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_driver_id uuid:=private.current_driver_id();
  v_idem public.command_idempotency%rowtype;
  v_booking public.ride_bookings%rowtype;
  v_ride public.rides%rowtype;
  v_result jsonb;
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem:=private.claim_user_command('driver_report_fixed_return_no_show',p_idempotency_key,md5(p_booking_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_booking from public.ride_bookings b where b.id=p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  select * into v_ride from public.rides r where r.id=v_booking.ride_id and r.driver_id=v_driver_id for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  if v_ride.status<>'RETURN_BOARDING' or v_booking.status<>'BOARDED' then raise exception 'BOOKING_TRANSITION_INVALID'; end if;
  if v_booking.return_status='NO_SHOW' then
    v_result:=jsonb_build_object('booking_id',v_booking.id,'return_status',v_booking.return_status);
  elsif v_booking.return_status<>'PENDING' then raise exception 'BOOKING_TRANSITION_INVALID';
  elsif v_ride.return_boarding_deadline is null or now()<v_ride.return_boarding_deadline then raise exception 'RETURN_BOARDING_WAIT_NOT_EXPIRED';
  else
    update public.ride_bookings set return_status='NO_SHOW',return_no_show_at=now() where id=v_booking.id;
    insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
    values(v_ride.id,'PASSENGER_RETURN_NO_SHOW','DRIVER',auth.uid(),'RETURN_BOARDING','RETURN_BOARDING',
      jsonb_build_object('booking_id',v_booking.id,'seat_count',v_booking.seat_count));
    v_result:=jsonb_build_object('booking_id',v_booking.id,'return_status','NO_SHOW');
  end if;
  perform private.finish_user_command(v_idem.id,v_result); return v_result;
end; $$;
revoke all on function private.driver_report_fixed_return_no_show(uuid,text) from public,anon,authenticated;
grant execute on function private.driver_report_fixed_return_no_show(uuid,text) to authenticated;
create or replace function public.driver_report_fixed_return_no_show(p_booking_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.driver_report_fixed_return_no_show(p_booking_id,p_idempotency_key); $$;
revoke all on function public.driver_report_fixed_return_no_show(uuid,text) from public,anon,authenticated;
grant execute on function public.driver_report_fixed_return_no_show(uuid,text) to authenticated;
