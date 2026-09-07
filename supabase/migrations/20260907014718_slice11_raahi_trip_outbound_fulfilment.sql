create or replace function private.verify_trip_rule_zone(p_ride_id uuid,p_phase text,p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision,p_captured_at timestamptz)
returns table(zone_id uuid,distance_meters double precision) language plpgsql security definer stable set search_path=''
as $$
declare v_ride public.rides%rowtype; v_o public.trip_offerings%rowtype; v_rules jsonb; v_location uuid; v_zone public.market_presence_zones%rowtype; v_max_age int; v_max_accuracy double precision; v_radius double precision; v_distance double precision;
begin
 select * into v_ride from public.rides where id=p_ride_id and trip_offering_id is not null; if not found then raise exception 'RIDE_NOT_FOUND'; end if;
 select * into v_o from public.trip_offerings where id=v_ride.trip_offering_id;
 select rules into v_rules from public.service_product_rule_versions where product_id=v_ride.product_id and version_no=v_ride.product_rules_version;
 if p_phase='arrival' then v_location:=v_o.origin_location_id; v_max_age:=(v_rules->>'arrival_max_location_age_seconds')::int; v_max_accuracy:=(v_rules->>'arrival_max_accuracy_meters')::double precision; v_radius:=(v_rules->>'arrival_radius_meters')::double precision;
 elsif p_phase='destination' then v_location:=v_o.destination_location_id; v_max_age:=(v_rules->>'destination_max_location_age_seconds')::int; v_max_accuracy:=(v_rules->>'destination_max_accuracy_meters')::double precision; v_radius:=(v_rules->>'destination_radius_meters')::double precision;
 elsif p_phase='return_completion' then v_location:=v_o.origin_location_id; v_max_age:=(v_rules->>'return_completion_max_location_age_seconds')::int; v_max_accuracy:=(v_rules->>'return_completion_max_accuracy_meters')::double precision; v_radius:=(v_rules->>'return_completion_radius_meters')::double precision;
 else raise exception 'TRIP_LOCATION_PHASE_INVALID'; end if;
 if v_max_age is null or v_max_accuracy is null or v_radius is null then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;
 if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 or p_accuracy_meters<=0 or p_accuracy_meters>v_max_accuracy or p_captured_at<now()-make_interval(secs=>v_max_age) or p_captured_at>now()+interval '30 seconds' then raise exception 'TRIP_LOCATION_NOT_VERIFIED'; end if;
 select z.* into v_zone from public.locations l join public.market_presence_zones z on z.market_id=l.market_id and z.is_active where l.id=v_location order by z.radius_meters asc limit 1; if not found then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;
 v_distance:=private.distance_meters(p_latitude,p_longitude,v_zone.latitude,v_zone.longitude); if v_distance>v_radius then raise exception 'TRIP_LOCATION_NOT_VERIFIED'; end if;
 zone_id:=v_zone.id; distance_meters:=v_distance; return next;
end; $$;
revoke all on function private.verify_trip_rule_zone(uuid,text,double precision,double precision,double precision,timestamptz) from public,anon,authenticated;

create or replace function private.driver_begin_trip_approach(p_ride_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_ride public.rides%rowtype; v_o public.trip_offerings%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
 v_idem:=private.claim_user_command('driver_begin_trip_approach',p_idempotency_key,md5(p_ride_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_ride from public.rides where id=p_ride_id and driver_id=v_driver and trip_offering_id is not null for update; if not found then raise exception 'RIDE_NOT_FOUND'; end if;
 select * into v_o from public.trip_offerings where id=v_ride.trip_offering_id for update;
 if v_ride.status='DRIVER_EN_ROUTE' then v_result:=jsonb_build_object('ride_id',v_ride.id,'status','DRIVER_EN_ROUTE');
 elsif v_ride.status<>'UPCOMING' or v_o.status not in ('CONFIRMED','UPCOMING') then raise exception 'RIDE_TRANSITION_INVALID';
 else update public.rides set status='DRIVER_EN_ROUTE',en_route_at=now() where id=v_ride.id; update public.mobility_commitments set status='ACTIVE' where id=v_ride.commitment_id and status='RESERVED'; update public.trip_offerings set status='IN_FULFILMENT',updated_at=now() where id=v_o.id; insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state) values(v_ride.id,'DRIVER_EN_ROUTE','DRIVER',auth.uid(),'UPCOMING','DRIVER_EN_ROUTE'); v_result:=jsonb_build_object('ride_id',v_ride.id,'status','DRIVER_EN_ROUTE','en_route_at',now()); end if;
 return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_begin_trip_approach(uuid,text) from public,anon,authenticated; grant execute on function private.driver_begin_trip_approach(uuid,text) to authenticated;
create or replace function public.driver_begin_trip_approach(p_ride_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_begin_trip_approach(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_begin_trip_approach(uuid,text) from public,anon,authenticated; grant execute on function public.driver_begin_trip_approach(uuid,text) to authenticated;

create or replace function private.driver_arrive_trip(p_ride_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision,p_captured_at timestamptz,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_ride public.rides%rowtype; v_zone uuid; v_distance double precision; v_idem public.command_idempotency; v_result jsonb; v_hash text:=md5(concat_ws('|',p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at));
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if; v_idem:=private.claim_user_command('driver_arrive_trip',p_idempotency_key,v_hash); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_ride from public.rides where id=p_ride_id and driver_id=v_driver and trip_offering_id is not null for update; if not found then raise exception 'RIDE_NOT_FOUND'; end if;
 if v_ride.status='DRIVER_ARRIVED' then v_result:=jsonb_build_object('ride_id',v_ride.id,'status','DRIVER_ARRIVED','arrived_at',v_ride.arrived_at); return private.complete_user_command(v_idem.id,v_result); end if; if v_ride.status<>'DRIVER_EN_ROUTE' then raise exception 'RIDE_TRANSITION_INVALID'; end if;
 select z.zone_id,z.distance_meters into v_zone,v_distance from private.verify_trip_rule_zone(v_ride.id,'arrival',p_latitude,p_longitude,p_accuracy_meters,p_captured_at) z;
 update public.rides set status='DRIVER_ARRIVED',arrived_at=now(),arrival_zone_id=v_zone,arrival_accuracy_meters=p_accuracy_meters where id=v_ride.id;
 insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata) values(v_ride.id,'DRIVER_ARRIVED','DRIVER',auth.uid(),'DRIVER_EN_ROUTE','DRIVER_ARRIVED',jsonb_build_object('arrival_zone_id',v_zone,'distance_meters',round(v_distance::numeric),'accuracy_meters',p_accuracy_meters));
 v_result:=jsonb_build_object('ride_id',v_ride.id,'status','DRIVER_ARRIVED','arrived_at',now()); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_arrive_trip(uuid,double precision,double precision,double precision,timestamptz,text) from public,anon,authenticated; grant execute on function private.driver_arrive_trip(uuid,double precision,double precision,double precision,timestamptz,text) to authenticated;
create or replace function public.driver_arrive_trip(p_ride_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision,p_captured_at timestamptz,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_arrive_trip(p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at,p_idempotency_key); $$;
revoke all on function public.driver_arrive_trip(uuid,double precision,double precision,double precision,timestamptz,text) from public,anon,authenticated; grant execute on function public.driver_arrive_trip(uuid,double precision,double precision,double precision,timestamptz,text) to authenticated;

create or replace function private.driver_start_trip_boarding(p_ride_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_ride public.rides%rowtype; v_wait int; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if; v_idem:=private.claim_user_command('driver_start_trip_boarding',p_idempotency_key,md5(p_ride_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_ride from public.rides where id=p_ride_id and driver_id=v_driver and trip_offering_id is not null for update; if not found then raise exception 'RIDE_NOT_FOUND'; end if;
 if v_ride.status='BOARDING' then v_result:=jsonb_build_object('ride_id',v_ride.id,'status','BOARDING','boarding_deadline',v_ride.boarding_deadline); return private.complete_user_command(v_idem.id,v_result); end if; if v_ride.status<>'DRIVER_ARRIVED' then raise exception 'RIDE_TRANSITION_INVALID'; end if;
 select (rules->>'boarding_wait_minutes')::int into v_wait from public.service_product_rule_versions where product_id=v_ride.product_id and version_no=v_ride.product_rules_version; if v_wait is null or v_wait<1 then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;
 update public.rides set status='BOARDING',boarding_started_at=now(),boarding_deadline=now()+make_interval(mins=>v_wait) where id=v_ride.id; insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata) values(v_ride.id,'BOARDING_STARTED','DRIVER',auth.uid(),'DRIVER_ARRIVED','BOARDING',jsonb_build_object('boarding_wait_minutes',v_wait));
 v_result:=jsonb_build_object('ride_id',v_ride.id,'status','BOARDING','boarding_deadline',now()+make_interval(mins=>v_wait)); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_start_trip_boarding(uuid,text) from public,anon,authenticated; grant execute on function private.driver_start_trip_boarding(uuid,text) to authenticated;
create or replace function public.driver_start_trip_boarding(p_ride_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_start_trip_boarding(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_start_trip_boarding(uuid,text) from public,anon,authenticated; grant execute on function public.driver_start_trip_boarding(uuid,text) to authenticated;

create or replace function private.driver_mark_trip_boarded(p_booking_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_b public.ride_bookings%rowtype; v_ride public.rides%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if; v_idem:=private.claim_user_command('driver_mark_trip_boarded',p_idempotency_key,md5(p_booking_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_b from public.ride_bookings where id=p_booking_id and trip_booking_id is not null for update; if not found then raise exception 'BOOKING_NOT_FOUND'; end if; select * into v_ride from public.rides where id=v_b.ride_id and driver_id=v_driver and trip_offering_id is not null for update; if not found then raise exception 'RIDE_NOT_FOUND'; end if; if v_ride.status<>'BOARDING' then raise exception 'RIDE_TRANSITION_INVALID'; end if;
 if v_b.status='BOARDED' then v_result:=jsonb_build_object('booking_id',v_b.id,'status','BOARDED'); elsif v_b.status<>'ASSIGNED' then raise exception 'BOOKING_TRANSITION_INVALID'; else update public.ride_bookings set status='BOARDED' where id=v_b.id; insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata) values(v_ride.id,'PASSENGER_BOARDED','DRIVER',auth.uid(),'BOARDING','BOARDING',jsonb_build_object('booking_id',v_b.id,'seat_count',v_b.seat_count)); v_result:=jsonb_build_object('booking_id',v_b.id,'status','BOARDED'); end if;
 perform private.resolve_fixed_boarding_state(v_ride.id); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_mark_trip_boarded(uuid,text) from public,anon,authenticated; grant execute on function private.driver_mark_trip_boarded(uuid,text) to authenticated;
create or replace function public.driver_mark_trip_boarded(p_booking_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_mark_trip_boarded(p_booking_id,p_idempotency_key); $$;
revoke all on function public.driver_mark_trip_boarded(uuid,text) from public,anon,authenticated; grant execute on function public.driver_mark_trip_boarded(uuid,text) to authenticated;

create or replace function private.driver_report_trip_no_show(p_booking_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_b public.ride_bookings%rowtype; v_ride public.rides%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if; v_idem:=private.claim_user_command('driver_report_trip_no_show',p_idempotency_key,md5(p_booking_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_b from public.ride_bookings where id=p_booking_id and trip_booking_id is not null for update; if not found then raise exception 'BOOKING_NOT_FOUND'; end if; select * into v_ride from public.rides where id=v_b.ride_id and driver_id=v_driver and trip_offering_id is not null for update; if not found then raise exception 'RIDE_NOT_FOUND'; end if; if v_ride.status<>'BOARDING' then raise exception 'RIDE_TRANSITION_INVALID'; end if; if v_ride.boarding_deadline is null or now()<v_ride.boarding_deadline then raise exception 'BOARDING_WAIT_NOT_EXPIRED'; end if;
 if v_b.status='NO_SHOW' then v_result:=jsonb_build_object('booking_id',v_b.id,'status','NO_SHOW'); elsif v_b.status<>'ASSIGNED' then raise exception 'BOOKING_TRANSITION_INVALID'; else update public.ride_bookings set status='NO_SHOW' where id=v_b.id; update public.trip_bookings set status='NO_SHOW',updated_at=now() where id=v_b.trip_booking_id and status='CONFIRMED'; update public.rides set booked_seat_count=booked_seat_count-v_b.seat_count where id=v_ride.id and booked_seat_count>=v_b.seat_count; update public.trip_offerings set active_booked_seats=active_booked_seats-v_b.seat_count,updated_at=now() where id=v_ride.trip_offering_id; insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata) values(v_ride.id,'PASSENGER_NO_SHOW','DRIVER',auth.uid(),'BOARDING','BOARDING',jsonb_build_object('booking_id',v_b.id,'seat_count',v_b.seat_count)); v_result:=jsonb_build_object('booking_id',v_b.id,'status','NO_SHOW'); end if;
 perform private.resolve_fixed_boarding_state(v_ride.id); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_report_trip_no_show(uuid,text) from public,anon,authenticated; grant execute on function private.driver_report_trip_no_show(uuid,text) to authenticated;
create or replace function public.driver_report_trip_no_show(p_booking_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_report_trip_no_show(p_booking_id,p_idempotency_key); $$;
revoke all on function public.driver_report_trip_no_show(uuid,text) from public,anon,authenticated; grant execute on function public.driver_report_trip_no_show(uuid,text) to authenticated;

create or replace function private.driver_depart_trip(p_ride_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_ride public.rides%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if; v_idem:=private.claim_user_command('driver_depart_trip',p_idempotency_key,md5(p_ride_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if; select * into v_ride from public.rides where id=p_ride_id and driver_id=v_driver and trip_offering_id is not null for update; if not found then raise exception 'RIDE_NOT_FOUND'; end if;
 if v_ride.status='OUTBOUND_IN_PROGRESS' then v_result:=jsonb_build_object('ride_id',v_ride.id,'status','OUTBOUND_IN_PROGRESS'); elsif v_ride.status<>'READY_TO_DEPART' then raise exception 'RIDE_TRANSITION_INVALID'; else update public.rides set status='OUTBOUND_IN_PROGRESS',departed_at=now() where id=v_ride.id; update public.mobility_commitments set status='ACTIVE' where id=v_ride.commitment_id and status in ('RESERVED','ACTIVE'); insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state) values(v_ride.id,'OUTBOUND_DEPARTED','DRIVER',auth.uid(),'READY_TO_DEPART','OUTBOUND_IN_PROGRESS'); v_result:=jsonb_build_object('ride_id',v_ride.id,'status','OUTBOUND_IN_PROGRESS','departed_at',now()); end if; return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_depart_trip(uuid,text) from public,anon,authenticated; grant execute on function private.driver_depart_trip(uuid,text) to authenticated;
create or replace function public.driver_depart_trip(p_ride_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_depart_trip(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_depart_trip(uuid,text) from public,anon,authenticated; grant execute on function public.driver_depart_trip(uuid,text) to authenticated;

create or replace function private.driver_complete_trip_outbound(p_ride_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision,p_captured_at timestamptz,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_ride public.rides%rowtype; v_zone uuid; v_distance double precision; v_idem public.command_idempotency; v_result jsonb; v_hash text:=md5(concat_ws('|',p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at));
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if; v_idem:=private.claim_user_command('driver_complete_trip_outbound',p_idempotency_key,v_hash); if v_idem.status='SUCCEEDED' then return v_idem.result; end if; select * into v_ride from public.rides where id=p_ride_id and driver_id=v_driver and trip_offering_id is not null for update; if not found then raise exception 'RIDE_NOT_FOUND'; end if;
 if v_ride.status='WAITING_FOR_RETURN' then v_result:=jsonb_build_object('ride_id',v_ride.id,'status','WAITING_FOR_RETURN','return_not_before',v_ride.return_not_before); return private.complete_user_command(v_idem.id,v_result); end if; if v_ride.status<>'OUTBOUND_IN_PROGRESS' then raise exception 'RIDE_TRANSITION_INVALID'; end if;
 select z.zone_id,z.distance_meters into v_zone,v_distance from private.verify_trip_rule_zone(v_ride.id,'destination',p_latitude,p_longitude,p_accuracy_meters,p_captured_at) z;
 if v_ride.return_not_before is null then raise exception 'TRIP_RETURN_TIME_INVALID'; end if;
 update public.rides set status='WAITING_FOR_RETURN',outbound_completed_at=now(),outbound_completion_zone_id=v_zone,outbound_completion_accuracy_meters=p_accuracy_meters where id=v_ride.id;
 insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata) values(v_ride.id,'OUTBOUND_COMPLETED','DRIVER',auth.uid(),'OUTBOUND_IN_PROGRESS','WAITING_FOR_RETURN',jsonb_build_object('zone_id',v_zone,'distance_meters',round(v_distance::numeric),'accuracy_meters',p_accuracy_meters,'return_not_before',v_ride.return_not_before));
 v_result:=jsonb_build_object('ride_id',v_ride.id,'status','WAITING_FOR_RETURN','return_not_before',v_ride.return_not_before); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_complete_trip_outbound(uuid,double precision,double precision,double precision,timestamptz,text) from public,anon,authenticated; grant execute on function private.driver_complete_trip_outbound(uuid,double precision,double precision,double precision,timestamptz,text) to authenticated;
create or replace function public.driver_complete_trip_outbound(p_ride_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision,p_captured_at timestamptz,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_complete_trip_outbound(p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at,p_idempotency_key); $$;
revoke all on function public.driver_complete_trip_outbound(uuid,double precision,double precision,double precision,timestamptz,text) from public,anon,authenticated; grant execute on function public.driver_complete_trip_outbound(uuid,double precision,double precision,double precision,timestamptz,text) to authenticated;