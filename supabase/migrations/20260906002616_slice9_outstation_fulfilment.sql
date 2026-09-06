-- Slice 9I: Outstation fulfilment on the shared Ride kernel.

insert into public.service_product_rule_versions(product_id,version_no,rules)
select p.id,2,rv.rules || jsonb_build_object(
  'arrival_zone_code','GOMOH_CORE',
  'arrival_radius_meters',1000,
  'arrival_max_accuracy_meters',200,
  'arrival_max_location_age_seconds',60,
  'return_boarding_wait_minutes',10,
  'return_completion_zone_code','GOMOH_CORE',
  'return_completion_radius_meters',1000,
  'return_completion_max_accuracy_meters',200,
  'return_completion_max_location_age_seconds',60
)
from public.service_products p
join public.service_product_rule_versions rv on rv.product_id=p.id and rv.version_no=1
where p.code='GOMOH_OUTSTATION'
on conflict(product_id,version_no) do nothing;

update public.service_products set current_rules_version=2 where code='GOMOH_OUTSTATION';

create or replace function private.initialize_round_trip_booking_return_status()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists (
    select 1 from public.rides r join public.service_products p on p.id=r.product_id
    where r.id=new.ride_id and (
      p.service_type='FIXED_ROUND_TRIP'
      or (p.service_type='OUTSTATION' and exists(
        select 1 from public.outstation_requests os
        where os.id=new.outstation_request_id and os.travel_type='ROUND_TRIP'
      ))
    )
  ) then new.return_status:='PENDING'; else new.return_status:='NOT_APPLICABLE'; end if;
  return new;
end; $$;
revoke all on function private.initialize_round_trip_booking_return_status() from public,anon,authenticated;
create or replace function private.driver_begin_outstation_approach(p_ride_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_driver uuid:=private.current_driver_id(); v_ride public.rides%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem:=private.claim_user_command('driver_begin_outstation_approach',p_idempotency_key,md5(p_ride_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_ride from public.rides r where r.id=p_ride_id and r.driver_id=v_driver and r.outstation_agreement_id is not null for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  if v_ride.status='DRIVER_EN_ROUTE' then
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status',v_ride.status,'en_route_at',v_ride.en_route_at);
  elsif v_ride.status<>'UPCOMING' then raise exception 'RIDE_TRANSITION_INVALID';
  else
    update public.rides set status='DRIVER_EN_ROUTE',en_route_at=now() where id=v_ride.id;
    update public.mobility_commitments set status='ACTIVE' where id=v_ride.commitment_id and status='RESERVED';
    insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state)
    values(v_ride.id,'DRIVER_EN_ROUTE','DRIVER',auth.uid(),'UPCOMING','DRIVER_EN_ROUTE');
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status','DRIVER_EN_ROUTE','en_route_at',now());
  end if;
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_begin_outstation_approach(uuid,text) from public,anon,authenticated;
grant execute on function private.driver_begin_outstation_approach(uuid,text) to authenticated;
create or replace function public.driver_begin_outstation_approach(p_ride_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.driver_begin_outstation_approach(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_begin_outstation_approach(uuid,text) from public,anon,authenticated;
grant execute on function public.driver_begin_outstation_approach(uuid,text) to authenticated;
create or replace function public.driver_arrive_outstation_ride(
  p_ride_id uuid,p_latitude double precision,p_longitude double precision,
  p_accuracy_meters double precision,p_captured_at timestamptz,p_idempotency_key text
) returns jsonb language sql security invoker set search_path='' as $$
  select private.driver_arrive_fixed_ride(p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at,p_idempotency_key);
$$;
revoke all on function public.driver_arrive_outstation_ride(uuid,double precision,double precision,double precision,timestamptz,text) from public,anon,authenticated;
grant execute on function public.driver_arrive_outstation_ride(uuid,double precision,double precision,double precision,timestamptz,text) to authenticated;

create or replace function public.driver_start_outstation_boarding(p_ride_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.driver_start_fixed_boarding(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_start_outstation_boarding(uuid,text) from public,anon,authenticated;
grant execute on function public.driver_start_outstation_boarding(uuid,text) to authenticated;

create or replace function public.driver_mark_outstation_boarded(p_booking_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.driver_mark_fixed_boarded(p_booking_id,p_idempotency_key); $$;
revoke all on function public.driver_mark_outstation_boarded(uuid,text) from public,anon,authenticated;
grant execute on function public.driver_mark_outstation_boarded(uuid,text) to authenticated;

create or replace function public.driver_depart_outstation_ride(p_ride_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.driver_depart_fixed_ride(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_depart_outstation_ride(uuid,text) from public,anon,authenticated;
grant execute on function public.driver_depart_outstation_ride(uuid,text) to authenticated;
create or replace function private.driver_reach_outstation_destination(p_ride_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_driver uuid:=private.current_driver_id(); v_ride public.rides%rowtype;
  v_agreement public.outstation_agreements%rowtype; v_req public.outstation_requests%rowtype;
  v_idem public.command_idempotency; v_result jsonb;
begin
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem:=private.claim_user_command('driver_reach_outstation_destination',p_idempotency_key,md5(p_ride_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_ride from public.rides r where r.id=p_ride_id and r.driver_id=v_driver and r.outstation_agreement_id is not null for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  select * into v_agreement from public.outstation_agreements where id=v_ride.outstation_agreement_id for update;
  select * into v_req from public.outstation_requests where id=v_agreement.request_id for update;
  if v_ride.status='COMPLETED' or v_ride.status='WAITING_FOR_RETURN' then
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status',v_ride.status,'return_not_before',v_ride.return_not_before);
  elsif v_ride.status<>'IN_PROGRESS' then raise exception 'RIDE_TRANSITION_INVALID';
  elsif v_req.travel_type='ROUND_TRIP' then
    update public.rides set status='WAITING_FOR_RETURN',outbound_completed_at=now(),return_not_before=v_req.return_at where id=v_ride.id;
    insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
    values(v_ride.id,'OUTSTATION_OUTBOUND_COMPLETED','DRIVER',auth.uid(),'IN_PROGRESS','WAITING_FOR_RETURN',jsonb_build_object('return_not_before',v_req.return_at));
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status','WAITING_FOR_RETURN','return_not_before',v_req.return_at);
  else
    update public.rides set status='COMPLETED',completed_at=now() where id=v_ride.id;
    update public.ride_bookings set status='COMPLETED' where ride_id=v_ride.id and status='BOARDED';
    update public.mobility_commitments set status='COMPLETED' where id=v_ride.commitment_id and status in ('RESERVED','ACTIVE');
    update public.outstation_agreements set status='COMPLETED',completed_at=now() where id=v_agreement.id;
    update public.outstation_requests set status='COMPLETED',completed_at=now() where id=v_req.id;
    insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state)
    values(v_ride.id,'OUTSTATION_COMPLETED','DRIVER',auth.uid(),'IN_PROGRESS','COMPLETED');
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status','COMPLETED','completed_at',now());
  end if;
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_reach_outstation_destination(uuid,text) from public,anon,authenticated;
grant execute on function private.driver_reach_outstation_destination(uuid,text) to authenticated;
create or replace function public.driver_reach_outstation_destination(p_ride_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.driver_reach_outstation_destination(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_reach_outstation_destination(uuid,text) from public,anon,authenticated;
grant execute on function public.driver_reach_outstation_destination(uuid,text) to authenticated;

create or replace function private.driver_start_outstation_return_boarding(p_ride_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_driver uuid:=private.current_driver_id(); v_ride public.rides%rowtype;
  v_agreement public.outstation_agreements%rowtype; v_req public.outstation_requests%rowtype;
  v_wait int; v_deadline timestamptz; v_idem public.command_idempotency; v_result jsonb;
begin
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem:=private.claim_user_command('driver_start_outstation_return_boarding',p_idempotency_key,md5(p_ride_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_ride from public.rides r where r.id=p_ride_id and r.driver_id=v_driver and r.outstation_agreement_id is not null for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  select * into v_agreement from public.outstation_agreements where id=v_ride.outstation_agreement_id;
  select * into v_req from public.outstation_requests where id=v_agreement.request_id;
  if v_req.travel_type<>'ROUND_TRIP' then raise exception 'RIDE_TRANSITION_INVALID'; end if;
  if v_ride.status='RETURN_BOARDING' then
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status',v_ride.status,'return_boarding_deadline',v_ride.return_boarding_deadline);
  elsif v_ride.status<>'WAITING_FOR_RETURN' then raise exception 'RIDE_TRANSITION_INVALID';
  elsif v_ride.return_not_before is null or now()<v_ride.return_not_before then raise exception 'RETURN_WAIT_NOT_FINISHED';
  else
    select (rv.rules->>'return_boarding_wait_minutes')::int into v_wait from public.service_product_rule_versions rv
      where rv.product_id=v_ride.product_id and rv.version_no=v_ride.product_rules_version;
    if v_wait is null or v_wait<1 or v_wait>120 then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;
    v_deadline:=now()+make_interval(mins=>v_wait);
    update public.rides set status='RETURN_BOARDING',return_boarding_started_at=now(),return_boarding_deadline=v_deadline where id=v_ride.id;
    insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
    values(v_ride.id,'RETURN_BOARDING_STARTED','DRIVER',auth.uid(),'WAITING_FOR_RETURN','RETURN_BOARDING',jsonb_build_object('deadline',v_deadline));
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status','RETURN_BOARDING','return_boarding_deadline',v_deadline);
  end if;
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_start_outstation_return_boarding(uuid,text) from public,anon,authenticated;
grant execute on function private.driver_start_outstation_return_boarding(uuid,text) to authenticated;
create or replace function public.driver_start_outstation_return_boarding(p_ride_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.driver_start_outstation_return_boarding(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_start_outstation_return_boarding(uuid,text) from public,anon,authenticated;
grant execute on function public.driver_start_outstation_return_boarding(uuid,text) to authenticated;

create or replace function public.driver_mark_outstation_return_boarded(p_booking_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.driver_mark_fixed_return_boarded(p_booking_id,p_idempotency_key); $$;
revoke all on function public.driver_mark_outstation_return_boarded(uuid,text) from public,anon,authenticated;
grant execute on function public.driver_mark_outstation_return_boarded(uuid,text) to authenticated;

create or replace function public.driver_report_outstation_return_no_show(p_booking_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.driver_report_fixed_return_no_show(p_booking_id,p_idempotency_key); $$;
revoke all on function public.driver_report_outstation_return_no_show(uuid,text) from public,anon,authenticated;
grant execute on function public.driver_report_outstation_return_no_show(uuid,text) to authenticated;

create or replace function private.driver_depart_outstation_return(p_ride_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_driver uuid:=private.current_driver_id(); v_ride public.rides%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem:=private.claim_user_command('driver_depart_outstation_return',p_idempotency_key,md5(p_ride_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_ride from public.rides r where r.id=p_ride_id and r.driver_id=v_driver and r.outstation_agreement_id is not null for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  if v_ride.status='RETURN_IN_PROGRESS' then
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status',v_ride.status,'return_departed_at',v_ride.return_departed_at);
  elsif v_ride.status<>'RETURN_BOARDING' then raise exception 'RIDE_TRANSITION_INVALID';
  elsif exists(select 1 from public.ride_bookings b where b.ride_id=v_ride.id and b.status='BOARDED' and b.return_status='PENDING') then
    raise exception 'RETURN_MANIFEST_UNRESOLVED';
  else
    update public.rides set status='RETURN_IN_PROGRESS',return_departed_at=now() where id=v_ride.id;
    insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state)
    values(v_ride.id,'RETURN_DEPARTED','DRIVER',auth.uid(),'RETURN_BOARDING','RETURN_IN_PROGRESS');
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status','RETURN_IN_PROGRESS','return_departed_at',now());
  end if;
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_depart_outstation_return(uuid,text) from public,anon,authenticated;
grant execute on function private.driver_depart_outstation_return(uuid,text) to authenticated;
create or replace function public.driver_depart_outstation_return(p_ride_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.driver_depart_outstation_return(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_depart_outstation_return(uuid,text) from public,anon,authenticated;
grant execute on function public.driver_depart_outstation_return(uuid,text) to authenticated;

create or replace function private.driver_complete_outstation_return(
  p_ride_id uuid,p_latitude double precision,p_longitude double precision,
  p_accuracy_meters double precision,p_captured_at timestamptz,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_driver uuid:=private.current_driver_id(); v_ride public.rides%rowtype;
  v_agreement public.outstation_agreements%rowtype; v_req public.outstation_requests%rowtype;
  v_zone_id uuid; v_distance double precision; v_hash text;
  v_idem public.command_idempotency; v_result jsonb;
begin
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_hash:=md5(concat_ws('|',p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at));
  v_idem:=private.claim_user_command('driver_complete_outstation_return',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_ride from public.rides r where r.id=p_ride_id and r.driver_id=v_driver and r.outstation_agreement_id is not null for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  select * into v_agreement from public.outstation_agreements where id=v_ride.outstation_agreement_id for update;
  select * into v_req from public.outstation_requests where id=v_agreement.request_id for update;
  if v_req.travel_type<>'ROUND_TRIP' then raise exception 'RIDE_TRANSITION_INVALID'; end if;
  if v_ride.status='COMPLETED' then
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status','COMPLETED','completed_at',v_ride.completed_at);
  elsif v_ride.status<>'RETURN_IN_PROGRESS' then raise exception 'RIDE_TRANSITION_INVALID';
  else
    select z.zone_id,z.distance_meters into v_zone_id,v_distance
      from private.verify_fixed_rule_zone(p_ride_id,'return_completion',p_latitude,p_longitude,p_accuracy_meters,p_captured_at) z;
    update public.rides set status='COMPLETED',completed_at=now(),return_completed_at=now(),
      return_completion_zone_id=v_zone_id,return_completion_accuracy_meters=p_accuracy_meters where id=v_ride.id;
    update public.ride_bookings set status='COMPLETED' where ride_id=v_ride.id and status='BOARDED';
    update public.mobility_commitments set status='COMPLETED' where id=v_ride.commitment_id and status in ('RESERVED','ACTIVE');
    update public.outstation_agreements set status='COMPLETED',completed_at=now() where id=v_agreement.id;
    update public.outstation_requests set status='COMPLETED',completed_at=now() where id=v_req.id;
    insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
    values(v_ride.id,'OUTSTATION_RETURN_COMPLETED','DRIVER',auth.uid(),'RETURN_IN_PROGRESS','COMPLETED',
      jsonb_build_object('zone_id',v_zone_id,'distance_meters',round(v_distance::numeric),'accuracy_meters',p_accuracy_meters));
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status','COMPLETED','completed_at',now());
  end if;
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_complete_outstation_return(uuid,double precision,double precision,double precision,timestamptz,text) from public,anon,authenticated;
grant execute on function private.driver_complete_outstation_return(uuid,double precision,double precision,double precision,timestamptz,text) to authenticated;
create or replace function public.driver_complete_outstation_return(
  p_ride_id uuid,p_latitude double precision,p_longitude double precision,
  p_accuracy_meters double precision,p_captured_at timestamptz,p_idempotency_key text
) returns jsonb language sql security invoker set search_path='' as $$
  select private.driver_complete_outstation_return(p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at,p_idempotency_key);
$$;
revoke all on function public.driver_complete_outstation_return(uuid,double precision,double precision,double precision,timestamptz,text) from public,anon,authenticated;
grant execute on function public.driver_complete_outstation_return(uuid,double precision,double precision,double precision,timestamptz,text) to authenticated;
