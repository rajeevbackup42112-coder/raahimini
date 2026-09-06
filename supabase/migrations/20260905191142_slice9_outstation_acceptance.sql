-- Slice 9E: exact-revision Passenger acceptance and atomic shared commitment/Ride creation.

create or replace function private.passenger_accept_outstation_quote(
  p_request_id uuid,p_revision_id uuid,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_profile uuid:=auth.uid(); v_req public.outstation_requests%rowtype;
  v_quote public.outstation_quotes%rowtype; v_rev public.outstation_quote_revisions%rowtype;
  v_driver public.drivers%rowtype; v_vehicle public.vehicles%rowtype;
  v_driver_name text; v_origin_name text; v_window tstzrange;
  v_hash text; v_idem public.command_idempotency; v_terms jsonb;
  v_agreement_id uuid:=gen_random_uuid(); v_commitment_id uuid; v_ride_id uuid:=gen_random_uuid(); v_booking_id uuid;
  v_result jsonb;
begin
  if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
  v_hash:=md5(concat_ws('|',p_request_id,p_revision_id));
  v_idem:=private.claim_user_command('passenger_accept_outstation_quote',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  select * into v_req from public.outstation_requests
   where id=p_request_id and passenger_profile_id=v_profile for update;
  if v_req.id is null then raise exception 'OUTSTATION_REQUEST_NOT_FOUND'; end if;
  if v_req.status not in ('OPEN','REOPENED') or v_req.departure_at<=now() then raise exception 'OUTSTATION_REQUEST_NOT_ACCEPTING_QUOTES'; end if;

  select * into v_rev from public.outstation_quote_revisions where id=p_revision_id;
  if v_rev.id is null then raise exception 'OUTSTATION_QUOTE_REVISION_NOT_FOUND'; end if;
  select * into v_quote from public.outstation_quotes where id=v_rev.quote_id and request_id=v_req.id for update;
  if v_quote.id is null or v_quote.status<>'ACTIVE' then raise exception 'OUTSTATION_QUOTE_NOT_AVAILABLE'; end if;
  if v_quote.current_revision_no<>v_rev.revision_no then raise exception 'OUTSTATION_QUOTE_REVISION_STALE'; end if;
  if v_rev.valid_until<=now() then raise exception 'OUTSTATION_QUOTE_EXPIRED'; end if;
  if not private.outstation_driver_eligible(v_req.id,v_quote.driver_id,v_rev.vehicle_id) then raise exception 'OUTSTATION_DRIVER_NOT_ELIGIBLE'; end if;
  select * into v_driver from public.drivers where id=v_quote.driver_id;
  select * into v_vehicle from public.vehicles where id=v_rev.vehicle_id;
  select p.display_name into v_driver_name from public.profiles p where p.id=v_driver.profile_id;
  select coalesce(l.name,m.name) into v_origin_name
    from public.markets m left join public.locations l on l.id=v_req.origin_location_id
    where m.id=v_req.origin_market_id;
  v_window:=private.outstation_commitment_window(v_req.id);

  v_terms:=jsonb_build_object(
    'quote_revision_id',v_rev.id,'quote_revision_no',v_rev.revision_no,
    'total_price_inr',v_rev.total_price_inr,'includes_tolls',v_rev.includes_tolls,
    'includes_parking',v_rev.includes_parking,'commercial_note',v_rev.commercial_note,
    'valid_until',v_rev.valid_until,'travel_type',v_req.travel_type,
    'departure_at',v_req.departure_at,'return_at',v_req.return_at,
    'passenger_count',v_req.passenger_count,'destination_text',v_req.destination_text,
    'driver_display_name',v_driver_name,'vehicle_registration',v_vehicle.registration_number,
    'vehicle_model',v_vehicle.vehicle_model
  );

  insert into public.outstation_agreements(
    id,request_id,quote_id,quote_revision_id,driver_id,vehicle_id,total_price_inr,terms_snapshot
  ) values(v_agreement_id,v_req.id,v_quote.id,v_rev.id,v_quote.driver_id,v_rev.vehicle_id,v_rev.total_price_inr,v_terms);

  begin
    insert into public.mobility_commitments(
      driver_id,vehicle_id,product_id,origin_market_id,source_type,source_id,starts_at,ends_at,status
    ) values(
      v_quote.driver_id,v_rev.vehicle_id,v_req.product_id,v_req.origin_market_id,
      'OUTSTATION',v_agreement_id,lower(v_window),upper(v_window),'RESERVED'
    ) returning id into v_commitment_id;
  exception when exclusion_violation then
    raise exception 'OUTSTATION_COMMITMENT_CONFLICT';
  end;
  update public.outstation_agreements set commitment_id=v_commitment_id where id=v_agreement_id;

  insert into public.rides(
    id,product_id,product_rules_version,driver_id,vehicle_id,origin_market_id,
    origin_location_id,destination_location_id,commitment_id,capacity,booked_seat_count,
    fare_per_seat_inr,status,matched_at,driver_ack_deadline,commitment_ends_at,
    commercial_model,whole_car_total_inr,outstation_agreement_id,origin_text_snapshot,destination_text_snapshot
  ) values(
    v_ride_id,v_req.product_id,v_req.product_rules_version,v_quote.driver_id,v_rev.vehicle_id,v_req.origin_market_id,
    v_req.origin_location_id,v_req.destination_location_id,v_commitment_id,v_vehicle.bookable_passenger_capacity,v_req.passenger_count,
    null,'UPCOMING',now(),null,upper(v_window),
    'WHOLE_CAR',v_rev.total_price_inr,v_agreement_id,v_origin_name,v_req.destination_text
  );

  insert into public.ride_bookings(
    ride_id,passenger_request_id,outstation_request_id,passenger_profile_id,seat_count,
    fare_per_seat_inr,boarding_context,commercial_model,quoted_total_inr
  ) values(
    v_ride_id,null,v_req.id,v_req.passenger_profile_id,v_req.passenger_count,
    null,jsonb_build_object('service_type','OUTSTATION','travel_type',v_req.travel_type),'WHOLE_CAR',v_rev.total_price_inr
  ) returning id into v_booking_id;

  update public.outstation_requests
     set status='CONFIRMED',accepted_agreement_id=v_agreement_id
   where id=v_req.id;
  update public.outstation_quotes set status='NOT_SELECTED'
   where request_id=v_req.id and id<>v_quote.id and status='ACTIVE';
  update public.outstation_quotes set status='ACCEPTED' where id=v_quote.id;

  insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
  values(v_ride_id,'OUTSTATION_CONFIRMED','PASSENGER',v_profile,v_req.status,'UPCOMING',
    jsonb_build_object('agreement_id',v_agreement_id,'quote_revision_id',v_rev.id,'total_price_inr',v_rev.total_price_inr));
  v_result:=jsonb_build_object(
    'request_id',v_req.id,'agreement_id',v_agreement_id,'ride_id',v_ride_id,'booking_id',v_booking_id,
    'commitment_id',v_commitment_id,'quote_id',v_quote.id,'quote_revision_id',v_rev.id,
    'driver_id',v_quote.driver_id,'vehicle_id',v_rev.vehicle_id,'total_price_inr',v_rev.total_price_inr,
    'status','CONFIRMED','ride_status','UPCOMING'
  );
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.passenger_accept_outstation_quote(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.passenger_accept_outstation_quote(uuid,uuid,text) to authenticated;

create or replace function public.passenger_accept_outstation_quote(
  p_request_id uuid,p_revision_id uuid,p_idempotency_key text
) returns jsonb language sql security invoker set search_path=''
as $$ select private.passenger_accept_outstation_quote(p_request_id,p_revision_id,p_idempotency_key); $$;
revoke all on function public.passenger_accept_outstation_quote(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.passenger_accept_outstation_quote(uuid,uuid,text) to authenticated;