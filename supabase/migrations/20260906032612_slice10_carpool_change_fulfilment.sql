-- Slice 10C: material-change re-consent plus common Carpool fulfilment.

create or replace function private.resolve_carpool_change_if_ready(p_proposal_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_p public.carpool_change_proposals%rowtype; v_j public.carpool_journeys%rowtype; v_ride public.rides%rowtype;
 v_window tstzrange; v_destination text; v_next_status text; v_result jsonb;
begin
 select * into v_p from public.carpool_change_proposals where id=p_proposal_id for update;
 if not found then raise exception 'CARPOOL_CHANGE_NOT_FOUND'; end if;
 if v_p.status<>'PENDING' then return jsonb_build_object('proposal_id',v_p.id,'status',v_p.status); end if;
 if exists(select 1 from public.carpool_booking_change_consents c where c.proposal_id=v_p.id and c.status='PENDING') then
   return jsonb_build_object('proposal_id',v_p.id,'status','PENDING');
 end if;
 select * into v_j from public.carpool_journeys where id=v_p.journey_id for update;
 if v_j.status<>'CHANGE_PENDING' then raise exception 'CARPOOL_CHANGE_STATE_INVALID'; end if;
 select * into v_ride from public.rides where id=v_j.ride_id for update;
 if v_ride.id is null or v_ride.status<>'UPCOMING' then raise exception 'CARPOOL_ALREADY_IN_FULFILMENT'; end if;
 v_window:=private.carpool_window_values(v_j.product_id,v_j.product_rules_version,v_p.proposed_departure_at);
 begin
   update public.mobility_commitments set starts_at=lower(v_window),ends_at=upper(v_window)
   where id=v_j.commitment_id and status='RESERVED';
   if not found then raise exception 'CARPOOL_COMMITMENT_STATE_INVALID'; end if;
 exception when exclusion_violation then
   update public.carpool_change_proposals set status='CANCELLED',resolved_at=now() where id=v_p.id;
   v_next_status:=case when v_j.active_booked_seats=v_j.offered_seats then 'FULL' else 'PUBLISHED' end;
   update public.carpool_journeys set status=v_next_status where id=v_j.id;
   insert into public.ride_events(ride_id,event_type,actor_kind,previous_state,next_state,metadata)
   values(v_ride.id,'CARPOOL_CHANGE_CANCELLED_CONFLICT','SYSTEM','UPCOMING','UPCOMING',jsonb_build_object('proposal_id',v_p.id));
   return jsonb_build_object('proposal_id',v_p.id,'status','CANCELLED','reason','COMMITMENT_CONFLICT');
 end;
 select l.name into v_destination from public.locations l where l.id=v_p.proposed_destination_location_id;
 v_next_status:=case when v_j.active_booked_seats=v_j.offered_seats then 'FULL' else 'PUBLISHED' end;
 update public.carpool_journeys set destination_location_id=v_p.proposed_destination_location_id,
   departure_at=v_p.proposed_departure_at,status=v_next_status,current_change_version=v_p.version_no where id=v_j.id;
 update public.rides set destination_location_id=v_p.proposed_destination_location_id,
   destination_text_snapshot=v_destination,commitment_ends_at=upper(v_window) where id=v_ride.id;
 update public.carpool_change_proposals set status='APPLIED',resolved_at=now() where id=v_p.id;
 insert into public.ride_events(ride_id,event_type,actor_kind,previous_state,next_state,metadata)
 values(v_ride.id,'CARPOOL_CHANGE_APPLIED','SYSTEM','UPCOMING','UPCOMING',jsonb_build_object('proposal_id',v_p.id,'version_no',v_p.version_no,'departure_at',v_p.proposed_departure_at,'destination_location_id',v_p.proposed_destination_location_id));
 v_result:=jsonb_build_object('proposal_id',v_p.id,'status','APPLIED','journey_status',v_next_status,'departure_at',v_p.proposed_departure_at,'destination_location_id',v_p.proposed_destination_location_id);
 return v_result;
end; $$;
revoke all on function private.resolve_carpool_change_if_ready(uuid) from public,anon,authenticated;

create or replace function private.propose_material_carpool_change(
 p_journey_id uuid,p_destination_location_id uuid,p_departure_at timestamptz,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_driver uuid:=private.current_driver_id(); v_j public.carpool_journeys%rowtype; v_ride public.rides%rowtype; v_rules jsonb;
 v_hash text; v_idem public.command_idempotency; v_version int; v_id uuid; v_window tstzrange; v_min_lead int; v_horizon int; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
 v_hash:=md5(concat_ws('|',p_journey_id,p_destination_location_id,p_departure_at));
 v_idem:=private.claim_user_command('propose_material_carpool_change',p_idempotency_key,v_hash);
 if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_j from public.carpool_journeys where id=p_journey_id and driver_id=v_driver for update;
 if not found then raise exception 'CARPOOL_JOURNEY_NOT_FOUND'; end if;
 if v_j.status not in ('PUBLISHED','FULL') or v_j.commitment_id is null or v_j.active_booked_seats<=0 then raise exception 'CARPOOL_CHANGE_REQUIRES_COMMITTED_BOOKINGS'; end if;
 select * into v_ride from public.rides where id=v_j.ride_id for update;
 if v_ride.id is null or v_ride.status<>'UPCOMING' then raise exception 'CARPOOL_ALREADY_IN_FULFILMENT'; end if;
 if p_destination_location_id=v_j.origin_location_id or not exists(select 1 from public.locations l join public.market_presence_zones z on z.market_id=l.market_id and z.is_active where l.id=p_destination_location_id and l.is_active) then raise exception 'CARPOOL_DESTINATION_INVALID'; end if;
 if p_destination_location_id=v_j.destination_location_id and p_departure_at=v_j.departure_at then raise exception 'CARPOOL_CHANGE_NOT_MATERIAL'; end if;
 select rv.rules into v_rules from public.service_product_rule_versions rv where rv.product_id=v_j.product_id and rv.version_no=v_j.product_rules_version;
 v_min_lead:=coalesce((v_rules->>'min_departure_lead_minutes')::int,30); v_horizon:=coalesce((v_rules->>'max_publish_horizon_days')::int,30);
 if p_departure_at<now()+make_interval(mins=>v_min_lead) or p_departure_at>now()+make_interval(days=>v_horizon) then raise exception 'CARPOOL_DEPARTURE_INVALID'; end if;
 v_window:=private.carpool_window_values(v_j.product_id,v_j.product_rules_version,p_departure_at);
 if exists(select 1 from public.mobility_commitments c where c.id<>v_j.commitment_id and (c.driver_id=v_j.driver_id or c.vehicle_id=v_j.vehicle_id) and c.status in ('RESERVED','ACTIVE') and c.starts_at<upper(v_window) and c.ends_at>lower(v_window)) then raise exception 'CARPOOL_COMMITMENT_CONFLICT'; end if;
 perform 1 from public.carpool_bookings b where b.journey_id=v_j.id and b.status='ACTIVE' for update;
 v_version:=v_j.current_change_version+1;
 insert into public.carpool_change_proposals(journey_id,version_no,proposed_destination_location_id,proposed_departure_at)
 values(v_j.id,v_version,p_destination_location_id,p_departure_at) returning id into v_id;
 insert into public.carpool_booking_change_consents(proposal_id,carpool_booking_id)
 select v_id,b.id from public.carpool_bookings b where b.journey_id=v_j.id and b.status='ACTIVE';
 update public.carpool_journeys set status='CHANGE_PENDING',current_change_version=v_version where id=v_j.id;
 insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
 values(v_ride.id,'CARPOOL_CHANGE_PROPOSED','DRIVER',auth.uid(),'UPCOMING','UPCOMING',jsonb_build_object('proposal_id',v_id,'version_no',v_version,'proposed_departure_at',p_departure_at,'proposed_destination_location_id',p_destination_location_id));
 v_result:=jsonb_build_object('proposal_id',v_id,'journey_id',v_j.id,'version_no',v_version,'status','PENDING');
 return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.propose_material_carpool_change(uuid,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function private.propose_material_carpool_change(uuid,uuid,timestamptz,text) to authenticated;
create or replace function public.propose_material_carpool_change(p_journey_id uuid,p_destination_location_id uuid,p_departure_at timestamptz,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.propose_material_carpool_change(p_journey_id,p_destination_location_id,p_departure_at,p_idempotency_key); $$;
revoke all on function public.propose_material_carpool_change(uuid,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.propose_material_carpool_change(uuid,uuid,timestamptz,text) to authenticated;

create or replace function private.accept_or_reject_material_change(p_proposal_id uuid,p_accept boolean,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_profile uuid:=auth.uid(); v_p public.carpool_change_proposals%rowtype; v_b public.carpool_bookings%rowtype; v_c public.carpool_booking_change_consents%rowtype;
 v_j public.carpool_journeys%rowtype; v_ride public.rides%rowtype; v_hash text; v_idem public.command_idempotency; v_resolution jsonb; v_result jsonb;
begin
 if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
 v_hash:=md5(concat_ws('|',p_proposal_id,p_accept)); v_idem:=private.claim_user_command('accept_or_reject_material_change',p_idempotency_key,v_hash);
 if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_p from public.carpool_change_proposals where id=p_proposal_id and status='PENDING' for update;
 if not found then raise exception 'CARPOOL_CHANGE_NOT_AVAILABLE'; end if;
 select b.* into v_b from public.carpool_bookings b join public.carpool_booking_change_consents c on c.carpool_booking_id=b.id and c.proposal_id=v_p.id where b.passenger_profile_id=v_profile and b.status='ACTIVE' for update of b;
 if not found then raise exception 'CARPOOL_BOOKING_NOT_FOUND'; end if;
 select * into v_c from public.carpool_booking_change_consents where proposal_id=v_p.id and carpool_booking_id=v_b.id for update;
 if v_c.status<>'PENDING' then raise exception 'CARPOOL_CHANGE_ALREADY_RESPONDED'; end if;
 update public.carpool_booking_change_consents set status=case when p_accept then 'ACCEPTED' else 'REJECTED' end,responded_at=now() where proposal_id=v_p.id and carpool_booking_id=v_b.id;
 if not p_accept then
   select * into v_j from public.carpool_journeys where id=v_b.journey_id for update;
   select * into v_ride from public.rides where id=v_j.ride_id for update;
   if v_ride.id is null or v_ride.status<>'UPCOMING' then raise exception 'CARPOOL_ALREADY_IN_FULFILMENT'; end if;
   update public.carpool_bookings set status='CANCELLED',cancelled_at=now() where id=v_b.id;
   update public.ride_bookings set status='CANCELLED' where id=v_b.ride_booking_id and status='ASSIGNED';
   update public.carpool_journeys set active_booked_seats=active_booked_seats-v_b.seat_count where id=v_j.id;
   update public.rides set booked_seat_count=booked_seat_count-v_b.seat_count where id=v_ride.id and booked_seat_count>=v_b.seat_count;
   insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
   values(v_ride.id,'CARPOOL_CHANGE_REJECTED_EXIT','PASSENGER',v_profile,'UPCOMING','UPCOMING',jsonb_build_object('proposal_id',v_p.id,'carpool_booking_id',v_b.id,'penalty_free',true));
 end if;
 v_resolution:=private.resolve_carpool_change_if_ready(v_p.id);
 v_result:=jsonb_build_object('proposal_id',v_p.id,'carpool_booking_id',v_b.id,'response',case when p_accept then 'ACCEPTED' else 'REJECTED' end,'resolution',v_resolution);
 return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.accept_or_reject_material_change(uuid,boolean,text) from public,anon,authenticated;
grant execute on function private.accept_or_reject_material_change(uuid,boolean,text) to authenticated;
create or replace function public.accept_or_reject_material_change(p_proposal_id uuid,p_accept boolean,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.accept_or_reject_material_change(p_proposal_id,p_accept,p_idempotency_key); $$;
revoke all on function public.accept_or_reject_material_change(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.accept_or_reject_material_change(uuid,boolean,text) to authenticated;

-- Normal Passenger cancellation during a pending change is also a penalty-free rejection and can resolve the proposal.
create or replace function private.cancel_carpool_booking(p_carpool_booking_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_profile uuid:=auth.uid(); v_b public.carpool_bookings%rowtype; v_j public.carpool_journeys%rowtype; v_ride public.rides%rowtype; v_proposal uuid;
 v_hash text; v_idem public.command_idempotency; v_resolution jsonb; v_result jsonb;
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
 select c.proposal_id into v_proposal from public.carpool_booking_change_consents c join public.carpool_change_proposals p on p.id=c.proposal_id and p.status='PENDING' where c.carpool_booking_id=v_b.id and c.status='PENDING';
 update public.carpool_bookings set status='CANCELLED',cancelled_at=now() where id=v_b.id;
 update public.ride_bookings set status='CANCELLED' where id=v_b.ride_booking_id and status='ASSIGNED';
 update public.carpool_journeys set active_booked_seats=active_booked_seats-v_b.seat_count,status=case when status='CHANGE_PENDING' then status else 'PUBLISHED' end where id=v_j.id;
 update public.rides set booked_seat_count=booked_seat_count-v_b.seat_count where id=v_ride.id and booked_seat_count>=v_b.seat_count;
 if v_proposal is not null then update public.carpool_booking_change_consents set status='REJECTED',responded_at=now() where proposal_id=v_proposal and carpool_booking_id=v_b.id; end if;
 insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
 values(v_ride.id,'CARPOOL_BOOKING_CANCELLED','PASSENGER',v_profile,'UPCOMING','UPCOMING',jsonb_build_object('carpool_booking_id',v_b.id,'seat_count',v_b.seat_count,'penalty_free',v_proposal is not null));
 if v_proposal is not null then v_resolution:=private.resolve_carpool_change_if_ready(v_proposal); end if;
 v_result:=jsonb_build_object('carpool_booking_id',v_b.id,'journey_id',v_j.id,'status','CANCELLED','change_resolution',v_resolution);
 return private.complete_user_command(v_idem.id,v_result);
end; $$;

create or replace function private.driver_begin_carpool_approach(p_ride_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_ride public.rides%rowtype; v_j public.carpool_journeys%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
 v_idem:=private.claim_user_command('driver_begin_carpool_approach',p_idempotency_key,md5(p_ride_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_ride from public.rides where id=p_ride_id and driver_id=v_driver and carpool_journey_id is not null for update;
 if not found then raise exception 'RIDE_NOT_FOUND'; end if;
 select * into v_j from public.carpool_journeys where id=v_ride.carpool_journey_id for update;
 if v_ride.status='DRIVER_EN_ROUTE' then v_result:=jsonb_build_object('ride_id',v_ride.id,'status','DRIVER_EN_ROUTE');
 elsif v_ride.status<>'UPCOMING' or v_j.status not in ('PUBLISHED','FULL') then raise exception 'RIDE_TRANSITION_INVALID';
 else
   update public.rides set status='DRIVER_EN_ROUTE',en_route_at=now() where id=v_ride.id;
   update public.mobility_commitments set status='ACTIVE' where id=v_ride.commitment_id and status='RESERVED';
   update public.carpool_journeys set status='IN_FULFILMENT' where id=v_j.id;
   insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state) values(v_ride.id,'DRIVER_EN_ROUTE','DRIVER',auth.uid(),'UPCOMING','DRIVER_EN_ROUTE');
   v_result:=jsonb_build_object('ride_id',v_ride.id,'status','DRIVER_EN_ROUTE','en_route_at',now());
 end if;
 return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_begin_carpool_approach(uuid,text) from public,anon,authenticated;
grant execute on function private.driver_begin_carpool_approach(uuid,text) to authenticated;
create or replace function public.driver_begin_carpool_approach(p_ride_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_begin_carpool_approach(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_begin_carpool_approach(uuid,text) from public,anon,authenticated; grant execute on function public.driver_begin_carpool_approach(uuid,text) to authenticated;

create or replace function public.driver_arrive_carpool_ride(p_ride_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision,p_captured_at timestamptz,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.driver_arrive_fixed_ride(p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at,p_idempotency_key); $$;
revoke all on function public.driver_arrive_carpool_ride(uuid,double precision,double precision,double precision,timestamptz,text) from public,anon,authenticated; grant execute on function public.driver_arrive_carpool_ride(uuid,double precision,double precision,double precision,timestamptz,text) to authenticated;
create or replace function public.driver_start_carpool_boarding(p_ride_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_start_fixed_boarding(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_start_carpool_boarding(uuid,text) from public,anon,authenticated; grant execute on function public.driver_start_carpool_boarding(uuid,text) to authenticated;
create or replace function public.driver_mark_carpool_boarded(p_booking_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_mark_fixed_boarded(p_booking_id,p_idempotency_key); $$;
revoke all on function public.driver_mark_carpool_boarded(uuid,text) from public,anon,authenticated; grant execute on function public.driver_mark_carpool_boarded(uuid,text) to authenticated;

create or replace function private.driver_report_carpool_no_show(p_booking_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_result jsonb; v_carpool uuid; v_journey uuid; v_seats int;
begin
 v_result:=private.driver_report_fixed_no_show(p_booking_id,p_idempotency_key);
 update public.carpool_bookings cb set status='NO_SHOW'
 from public.ride_bookings rb where rb.id=p_booking_id and cb.id=rb.carpool_booking_id and cb.status='ACTIVE'
 returning cb.id,cb.journey_id,cb.seat_count into v_carpool,v_journey,v_seats;
 if v_carpool is not null then update public.carpool_journeys set active_booked_seats=greatest(0,active_booked_seats-v_seats) where id=v_journey; end if;
 return v_result;
end; $$;
revoke all on function private.driver_report_carpool_no_show(uuid,text) from public,anon,authenticated; grant execute on function private.driver_report_carpool_no_show(uuid,text) to authenticated;
create or replace function public.driver_report_carpool_no_show(p_booking_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_report_carpool_no_show(p_booking_id,p_idempotency_key); $$;
revoke all on function public.driver_report_carpool_no_show(uuid,text) from public,anon,authenticated; grant execute on function public.driver_report_carpool_no_show(uuid,text) to authenticated;
create or replace function public.driver_depart_carpool_ride(p_ride_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_depart_fixed_ride(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_depart_carpool_ride(uuid,text) from public,anon,authenticated; grant execute on function public.driver_depart_carpool_ride(uuid,text) to authenticated;

create or replace function private.driver_complete_carpool_ride(
 p_ride_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision,p_captured_at timestamptz,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_driver uuid:=private.current_driver_id(); v_ride public.rides%rowtype; v_j public.carpool_journeys%rowtype; v_rules jsonb; v_zone public.market_presence_zones%rowtype;
 v_distance double precision; v_max_age int; v_max_accuracy double precision; v_radius double precision; v_hash text; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
 v_hash:=md5(concat_ws('|',p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at)); v_idem:=private.claim_user_command('driver_complete_carpool_ride',p_idempotency_key,v_hash);
 if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_ride from public.rides where id=p_ride_id and driver_id=v_driver and carpool_journey_id is not null for update;
 if not found then raise exception 'RIDE_NOT_FOUND'; end if;
 select * into v_j from public.carpool_journeys where id=v_ride.carpool_journey_id for update;
 if v_ride.status='COMPLETED' then v_result:=jsonb_build_object('ride_id',v_ride.id,'status','COMPLETED','completed_at',v_ride.completed_at); return private.complete_user_command(v_idem.id,v_result); end if;
 if v_ride.status<>'IN_PROGRESS' then raise exception 'RIDE_TRANSITION_INVALID'; end if;
 select rv.rules into v_rules from public.service_product_rule_versions rv where rv.product_id=v_ride.product_id and rv.version_no=v_ride.product_rules_version;
 v_max_age:=(v_rules->>'completion_max_location_age_seconds')::int; v_max_accuracy:=(v_rules->>'completion_max_accuracy_meters')::double precision; v_radius:=(v_rules->>'completion_radius_meters')::double precision;
 if v_max_age is null or v_max_accuracy is null or v_radius is null then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;
 if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 or p_accuracy_meters<=0 or p_accuracy_meters>v_max_accuracy or p_captured_at<now()-make_interval(secs=>v_max_age) or p_captured_at>now()+interval '30 seconds' then raise exception 'COMPLETION_LOCATION_NOT_VERIFIED'; end if;
 select z.* into v_zone from public.locations l join public.market_presence_zones z on z.market_id=l.market_id and z.is_active where l.id=v_j.destination_location_id order by z.radius_meters asc limit 1;
 if not found then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;
 v_distance:=private.distance_meters(p_latitude,p_longitude,v_zone.latitude,v_zone.longitude); if v_distance>v_radius then raise exception 'COMPLETION_LOCATION_NOT_VERIFIED'; end if;
 update public.rides set status='COMPLETED',completed_at=now(),completion_zone_id=v_zone.id,completion_accuracy_meters=p_accuracy_meters where id=v_ride.id;
 update public.ride_bookings set status='COMPLETED' where ride_id=v_ride.id and status='BOARDED';
 update public.carpool_bookings cb set status='COMPLETED',completed_at=now() from public.ride_bookings rb where rb.ride_id=v_ride.id and rb.carpool_booking_id=cb.id and rb.status='COMPLETED' and cb.status='ACTIVE';
 update public.mobility_commitments set status='COMPLETED' where id=v_ride.commitment_id and status in ('RESERVED','ACTIVE');
 update public.carpool_journeys set status='COMPLETED',completed_at=now() where id=v_j.id;
 insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata) values(v_ride.id,'CARPOOL_COMPLETED','DRIVER',auth.uid(),'IN_PROGRESS','COMPLETED',jsonb_build_object('completion_zone_id',v_zone.id,'distance_meters',round(v_distance::numeric),'accuracy_meters',p_accuracy_meters));
 v_result:=jsonb_build_object('ride_id',v_ride.id,'journey_id',v_j.id,'status','COMPLETED','completed_at',now()); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_complete_carpool_ride(uuid,double precision,double precision,double precision,timestamptz,text) from public,anon,authenticated; grant execute on function private.driver_complete_carpool_ride(uuid,double precision,double precision,double precision,timestamptz,text) to authenticated;
create or replace function public.driver_complete_carpool_ride(p_ride_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision,p_captured_at timestamptz,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_complete_carpool_ride(p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at,p_idempotency_key); $$;
revoke all on function public.driver_complete_carpool_ride(uuid,double precision,double precision,double precision,timestamptz,text) from public,anon,authenticated; grant execute on function public.driver_complete_carpool_ride(uuid,double precision,double precision,double precision,timestamptz,text) to authenticated;