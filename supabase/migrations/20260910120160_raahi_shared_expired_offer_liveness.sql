-- Expired Driver offers must not block a Passenger Shared request from being
-- matched to another eligible trip. Match creation is serialized by the
-- travel_intents row lock inside match_shared_requests_to_trip, so the previous
-- status-only unique index is both over-restrictive and unnecessary: an OFFERED
-- row can remain physically unexpired until its owning offering is next touched,
-- even after expires_at has passed.

drop index if exists public.uq_shared_trip_matches_live_intent;
create index if not exists idx_shared_trip_matches_intent_status_expiry
  on public.shared_trip_matches(travel_intent_id,status,expires_at);

create or replace function private.match_shared_requests_to_trip(p_offering_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_o public.trip_offerings%rowtype;
  v_i public.travel_intents%rowtype;
  v_rules jsonb;
  v_driver_profile uuid;
  v_available integer;
  v_hold_minutes integer;
  v_max_booking integer;
  v_expiry timestamptz;
  v_match_id uuid;
  v_created integer:=0;
  v_held integer:=0;
begin
  select * into v_o from public.trip_offerings where id=p_offering_id for update;
  if not found then raise exception 'TRIP_OFFERING_NOT_FOUND'; end if;

  -- This offering is already locked, so its expired holds can be released
  -- without acquiring another offering out of order.
  perform private.release_expired_shared_trip_holds(v_o.id);
  select * into v_o from public.trip_offerings where id=v_o.id;

  if v_o.status<>'FILLING' or v_o.departure_at<=now() or v_o.confirmation_deadline<=now() then
    return jsonb_build_object('offering_id',v_o.id,'matched_requests',0,'held_seats',v_o.held_seats);
  end if;
  if not private.product_feature_enabled(v_o.product_id) then
    return jsonb_build_object('offering_id',v_o.id,'matched_requests',0,'held_seats',v_o.held_seats,'reason','PRODUCT_DISABLED');
  end if;

  select rv.rules into v_rules
    from public.service_product_rule_versions rv
   where rv.product_id=v_o.product_id and rv.version_no=v_o.product_rules_version;
  v_hold_minutes:=greatest(5,least(120,coalesce((v_rules->>'shared_match_hold_minutes')::integer,20)));
  v_max_booking:=coalesce((v_rules->>'max_seats_per_booking')::integer,4);
  v_expiry:=least(v_o.confirmation_deadline,v_o.departure_at,now()+make_interval(mins=>v_hold_minutes));
  if v_expiry<=now() then
    return jsonb_build_object('offering_id',v_o.id,'matched_requests',0,'held_seats',v_o.held_seats);
  end if;

  select d.profile_id into v_driver_profile from public.drivers d where d.id=v_o.driver_id;
  v_available:=v_o.offered_seats-v_o.active_booked_seats-v_o.held_seats;
  if v_available<=0 then
    return jsonb_build_object('offering_id',v_o.id,'matched_requests',0,'held_seats',v_o.held_seats);
  end if;

  for v_i in
    select t.*
      from public.travel_intents t
     where t.intent_kind='SHARED_REQUEST'
       and t.status='ACTIVE'
       and t.acceptable_service_type in ('ANY','RAAHI_TRIP')
       and t.origin_market_id=v_o.origin_market_id
       and t.origin_location_id=v_o.origin_location_id
       and t.destination_location_id=v_o.destination_location_id
       and t.desired_departure_at is not null
       and t.desired_window_end_at is not null
       and v_o.departure_at between t.desired_departure_at and t.desired_window_end_at
       and t.passenger_profile_id<>v_driver_profile
       and t.seat_count<=v_max_booking
       and not exists(
         select 1 from public.trip_bookings b
          where b.offering_id=v_o.id and b.passenger_profile_id=t.passenger_profile_id
            and b.status in ('FILLING','CONFIRMED')
       )
       -- Only an unexpired Driver offer is live. A stale OFFERED row from a
       -- different offering must not strand this Passenger request.
       and not exists(
         select 1 from public.shared_trip_matches sm
          where sm.travel_intent_id=t.id
            and sm.status='OFFERED'
            and sm.expires_at>now()
       )
       -- Do not churn the same request back to the same Driver trip after the
       -- Passenger declined it or let its offer expire.
       and not exists(
         select 1 from public.shared_trip_matches sm
          where sm.travel_intent_id=t.id and sm.offering_id=v_o.id
       )
     order by t.created_at,t.id
     for update of t skip locked
  loop
    exit when v_available<=0;
    if v_i.seat_count<=v_available then
      insert into public.shared_trip_matches(
        travel_intent_id,offering_id,passenger_profile_id,seat_count,price_per_seat_inr,status,expires_at
      ) values(
        v_i.id,v_o.id,v_i.passenger_profile_id,v_i.seat_count,v_o.price_per_seat_inr,'OFFERED',v_expiry
      ) returning id into v_match_id;

      update public.trip_offerings
         set held_seats=held_seats+v_i.seat_count,updated_at=now()
       where id=v_o.id
         and active_booked_seats+held_seats+v_i.seat_count<=offered_seats;
      if not found then raise exception 'SHARED_HOLD_CAPACITY_CONFLICT'; end if;

      v_available:=v_available-v_i.seat_count;
      v_created:=v_created+1;
      v_held:=v_held+v_i.seat_count;
    end if;
  end loop;

  return jsonb_build_object(
    'offering_id',v_o.id,
    'matched_requests',v_created,
    'newly_held_seats',v_held,
    'held_seats',(select held_seats from public.trip_offerings where id=v_o.id)
  );
end; $$;
revoke all on function private.match_shared_requests_to_trip(uuid) from public,anon,authenticated;

create or replace function private.match_shared_request(p_intent_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_i public.travel_intents%rowtype;
  v_o record;
  v_match uuid;
begin
  -- Read only here. The offering-side matcher locks Offering -> Intent and
  -- rechecks ACTIVE while holding the intent lock.
  select * into v_i from public.travel_intents t where t.id=p_intent_id;
  if not found then raise exception 'TRAVEL_INTENT_NOT_FOUND'; end if;
  if v_i.intent_kind<>'SHARED_REQUEST' or v_i.status<>'ACTIVE' then
    return jsonb_build_object('intent_id',v_i.id,'matched',false);
  end if;

  select sm.id into v_match from public.shared_trip_matches sm
   where sm.travel_intent_id=v_i.id
     and sm.status='OFFERED'
     and sm.expires_at>now()
   order by sm.offered_at desc,sm.id
   limit 1;
  if v_match is not null then
    return jsonb_build_object('intent_id',v_i.id,'matched',true,'match_id',v_match);
  end if;

  -- Do not clean an expired hold on some other offering while matching this
  -- request: that would acquire multiple offering locks in a Passenger
  -- transaction. Stale holds are lazily released whenever their own offering is
  -- touched; projections use only unexpired holds for visible availability.
  for v_o in
    select t.id
      from public.trip_offerings t
     where t.origin_market_id=v_i.origin_market_id
       and t.origin_location_id=v_i.origin_location_id
       and t.destination_location_id=v_i.destination_location_id
       and t.status='FILLING'
       and t.departure_at>now()
       and t.confirmation_deadline>now()
       and v_i.desired_departure_at is not null
       and v_i.desired_window_end_at is not null
       and t.departure_at between v_i.desired_departure_at and v_i.desired_window_end_at
       and private.product_feature_enabled(t.product_id)
     order by t.departure_at,t.published_at,t.id
  loop
    perform private.match_shared_requests_to_trip(v_o.id);
    select sm.id into v_match from public.shared_trip_matches sm
     where sm.travel_intent_id=v_i.id
       and sm.status='OFFERED'
       and sm.expires_at>now()
     order by sm.offered_at desc,sm.id
     limit 1;
    exit when v_match is not null;
  end loop;

  return jsonb_build_object('intent_id',v_i.id,'matched',v_match is not null,'match_id',v_match);
end; $$;
revoke all on function private.match_shared_request(uuid) from public,anon,authenticated;
