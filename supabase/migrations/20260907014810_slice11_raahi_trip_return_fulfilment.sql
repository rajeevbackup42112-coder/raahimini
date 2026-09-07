create or replace function private.driver_start_trip_return_boarding(p_ride_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_ride public.rides%rowtype; v_wait int; v_deadline timestamptz; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if; v_idem:=private.claim_user_command('driver_start_trip_return_boarding',p_idempotency_key,md5(p_ride_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_ride from public.rides where id=p_ride_id and driver_id=v_driver and trip_offering_id is not null for update; if not found then raise exception 'RIDE_NOT_FOUND'; end if;
 if v_ride.status='RETURN_BOARDING' then v_result:=jsonb_build_object('ride_id',v_ride.id,'status','RETURN_BOARDING','return_boarding_deadline',v_ride.return_boarding_deadline); return private.complete_user_command(v_idem.id,v_result); end if;
 if v_ride.status<>'WAITING_FOR_RETURN' then raise exception 'RIDE_TRANSITION_INVALID'; end if; if v_ride.return_not_before is null or now()<v_ride.return_not_before then raise exception 'RETURN_WAIT_NOT_FINISHED'; end if;
 select (rules->>'return_boarding_wait_minutes')::int into v_wait from public.service_product_rule_versions where product_id=v_ride.product_id and version_no=v_ride.product_rules_version; if v_wait is null or v_wait<1 or v_wait>120 then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if; v_deadline:=now()+make_interval(mins=>v_wait);
 update public.rides set status='RETURN_BOARDING',return_boarding_started_at=now(),return_boarding_deadline=v_deadline where id=v_ride.id;
 insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata) values(v_ride.id,'RETURN_BOARDING_STARTED','DRIVER',auth.uid(),'WAITING_FOR_RETURN','RETURN_BOARDING',jsonb_build_object('deadline',v_deadline));
 v_result:=jsonb_build_object('ride_id',v_ride.id,'status','RETURN_BOARDING','return_boarding_deadline',v_deadline); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_start_trip_return_boarding(uuid,text) from public,anon,authenticated; grant execute on function private.driver_start_trip_return_boarding(uuid,text) to authenticated;
create or replace function public.driver_start_trip_return_boarding(p_ride_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_start_trip_return_boarding(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_start_trip_return_boarding(uuid,text) from public,anon,authenticated; grant execute on function public.driver_start_trip_return_boarding(uuid,text) to authenticated;

create or replace function private.driver_mark_trip_return_boarded(p_booking_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_b public.ride_bookings%rowtype; v_ride public.rides%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if; v_idem:=private.claim_user_command('driver_mark_trip_return_boarded',p_idempotency_key,md5(p_booking_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_b from public.ride_bookings where id=p_booking_id and trip_booking_id is not null for update; if not found then raise exception 'BOOKING_NOT_FOUND'; end if; select * into v_ride from public.rides where id=v_b.ride_id and driver_id=v_driver and trip_offering_id is not null for update; if not found then raise exception 'RIDE_NOT_FOUND'; end if;
 if v_ride.status<>'RETURN_BOARDING' or v_b.status<>'BOARDED' then raise exception 'BOOKING_TRANSITION_INVALID'; end if; if v_b.return_status='BOARDED' then v_result:=jsonb_build_object('booking_id',v_b.id,'return_status','BOARDED'); elsif v_b.return_status<>'PENDING' then raise exception 'BOOKING_TRANSITION_INVALID'; else update public.ride_bookings set return_status='BOARDED',return_boarded_at=now() where id=v_b.id; insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata) values(v_ride.id,'PASSENGER_RETURN_BOARDED','DRIVER',auth.uid(),'RETURN_BOARDING','RETURN_BOARDING',jsonb_build_object('booking_id',v_b.id,'seat_count',v_b.seat_count)); v_result:=jsonb_build_object('booking_id',v_b.id,'return_status','BOARDED'); end if;
 return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_mark_trip_return_boarded(uuid,text) from public,anon,authenticated; grant execute on function private.driver_mark_trip_return_boarded(uuid,text) to authenticated;
create or replace function public.driver_mark_trip_return_boarded(p_booking_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_mark_trip_return_boarded(p_booking_id,p_idempotency_key); $$;
revoke all on function public.driver_mark_trip_return_boarded(uuid,text) from public,anon,authenticated; grant execute on function public.driver_mark_trip_return_boarded(uuid,text) to authenticated;

create or replace function private.driver_report_trip_return_no_show(p_booking_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_b public.ride_bookings%rowtype; v_ride public.rides%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if; v_idem:=private.claim_user_command('driver_report_trip_return_no_show',p_idempotency_key,md5(p_booking_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_b from public.ride_bookings where id=p_booking_id and trip_booking_id is not null for update; if not found then raise exception 'BOOKING_NOT_FOUND'; end if; select * into v_ride from public.rides where id=v_b.ride_id and driver_id=v_driver and trip_offering_id is not null for update; if not found then raise exception 'RIDE_NOT_FOUND'; end if;
 if v_ride.status<>'RETURN_BOARDING' or v_b.status<>'BOARDED' then raise exception 'BOOKING_TRANSITION_INVALID'; end if; if v_b.return_status='NO_SHOW' then v_result:=jsonb_build_object('booking_id',v_b.id,'return_status','NO_SHOW'); elsif v_b.return_status<>'PENDING' then raise exception 'BOOKING_TRANSITION_INVALID'; elsif v_ride.return_boarding_deadline is null or now()<v_ride.return_boarding_deadline then raise exception 'RETURN_BOARDING_WAIT_NOT_EXPIRED'; else update public.ride_bookings set return_status='NO_SHOW',return_no_show_at=now() where id=v_b.id; insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata) values(v_ride.id,'PASSENGER_RETURN_NO_SHOW','DRIVER',auth.uid(),'RETURN_BOARDING','RETURN_BOARDING',jsonb_build_object('booking_id',v_b.id,'seat_count',v_b.seat_count)); v_result:=jsonb_build_object('booking_id',v_b.id,'return_status','NO_SHOW'); end if;
 return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_report_trip_return_no_show(uuid,text) from public,anon,authenticated; grant execute on function private.driver_report_trip_return_no_show(uuid,text) to authenticated;
create or replace function public.driver_report_trip_return_no_show(p_booking_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_report_trip_return_no_show(p_booking_id,p_idempotency_key); $$;
revoke all on function public.driver_report_trip_return_no_show(uuid,text) from public,anon,authenticated; grant execute on function public.driver_report_trip_return_no_show(uuid,text) to authenticated;

create or replace function private.driver_depart_trip_return(p_ride_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_ride public.rides%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if; v_idem:=private.claim_user_command('driver_depart_trip_return',p_idempotency_key,md5(p_ride_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if; select * into v_ride from public.rides where id=p_ride_id and driver_id=v_driver and trip_offering_id is not null for update; if not found then raise exception 'RIDE_NOT_FOUND'; end if;
 if v_ride.status='RETURN_IN_PROGRESS' then v_result:=jsonb_build_object('ride_id',v_ride.id,'status','RETURN_IN_PROGRESS','return_departed_at',v_ride.return_departed_at); elsif v_ride.status<>'RETURN_BOARDING' then raise exception 'RIDE_TRANSITION_INVALID'; elsif exists(select 1 from public.ride_bookings b where b.ride_id=v_ride.id and b.status='BOARDED' and b.return_status='PENDING') then raise exception 'RETURN_MANIFEST_UNRESOLVED'; else update public.rides set status='RETURN_IN_PROGRESS',return_departed_at=now() where id=v_ride.id; insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state) values(v_ride.id,'RETURN_DEPARTED','DRIVER',auth.uid(),'RETURN_BOARDING','RETURN_IN_PROGRESS'); v_result:=jsonb_build_object('ride_id',v_ride.id,'status','RETURN_IN_PROGRESS','return_departed_at',now()); end if;
 return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_depart_trip_return(uuid,text) from public,anon,authenticated; grant execute on function private.driver_depart_trip_return(uuid,text) to authenticated;
create or replace function public.driver_depart_trip_return(p_ride_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_depart_trip_return(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_depart_trip_return(uuid,text) from public,anon,authenticated; grant execute on function public.driver_depart_trip_return(uuid,text) to authenticated;

create or replace function private.driver_complete_trip_return(p_ride_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision,p_captured_at timestamptz,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_ride public.rides%rowtype; v_o public.trip_offerings%rowtype; v_zone uuid; v_distance double precision; v_idem public.command_idempotency; v_result jsonb; v_hash text:=md5(concat_ws('|',p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at));
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if; v_idem:=private.claim_user_command('driver_complete_trip_return',p_idempotency_key,v_hash); if v_idem.status='SUCCEEDED' then return v_idem.result; end if; select * into v_ride from public.rides where id=p_ride_id and driver_id=v_driver and trip_offering_id is not null for update; if not found then raise exception 'RIDE_NOT_FOUND'; end if; select * into v_o from public.trip_offerings where id=v_ride.trip_offering_id for update;
 if v_ride.status='COMPLETED' then v_result:=jsonb_build_object('ride_id',v_ride.id,'offering_id',v_o.id,'status','COMPLETED','completed_at',v_ride.completed_at); return private.complete_user_command(v_idem.id,v_result); end if; if v_ride.status<>'RETURN_IN_PROGRESS' then raise exception 'RIDE_TRANSITION_INVALID'; end if;
 select z.zone_id,z.distance_meters into v_zone,v_distance from private.verify_trip_rule_zone(v_ride.id,'return_completion',p_latitude,p_longitude,p_accuracy_meters,p_captured_at) z;
 update public.rides set status='COMPLETED',completed_at=now(),return_completed_at=now(),return_completion_zone_id=v_zone,return_completion_accuracy_meters=p_accuracy_meters where id=v_ride.id;
 update public.ride_bookings set status='COMPLETED' where ride_id=v_ride.id and status='BOARDED';
 update public.trip_bookings tb set status='COMPLETED',completed_at=now(),updated_at=now() from public.ride_bookings rb where rb.ride_id=v_ride.id and rb.trip_booking_id=tb.id and rb.status='COMPLETED' and tb.status='CONFIRMED';
 update public.mobility_commitments set status='COMPLETED',updated_at=now() where id=v_ride.commitment_id and status in ('RESERVED','ACTIVE');
 update public.trip_offerings set status='COMPLETED',completed_at=now(),updated_at=now() where id=v_o.id;
 insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata) values(v_ride.id,'RAAHI_TRIP_COMPLETED','DRIVER',auth.uid(),'RETURN_IN_PROGRESS','COMPLETED',jsonb_build_object('return_completion_zone_id',v_zone,'distance_meters',round(v_distance::numeric),'accuracy_meters',p_accuracy_meters));
 v_result:=jsonb_build_object('ride_id',v_ride.id,'offering_id',v_o.id,'status','COMPLETED','completed_at',now()); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_complete_trip_return(uuid,double precision,double precision,double precision,timestamptz,text) from public,anon,authenticated; grant execute on function private.driver_complete_trip_return(uuid,double precision,double precision,double precision,timestamptz,text) to authenticated;
create or replace function public.driver_complete_trip_return(p_ride_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision,p_captured_at timestamptz,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_complete_trip_return(p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at,p_idempotency_key); $$;
revoke all on function public.driver_complete_trip_return(uuid,double precision,double precision,double precision,timestamptz,text) from public,anon,authenticated; grant execute on function public.driver_complete_trip_return(uuid,double precision,double precision,double precision,timestamptz,text) to authenticated;