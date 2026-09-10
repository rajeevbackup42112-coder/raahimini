-- Raahi Shared concurrency hardening.
--
-- Publishing a Driver trip necessarily owns the trip_offerings row before matching.
-- Therefore request-side operations must never hold a travel_intents row and then
-- wait for an offering. Matching owns Offering -> Intent; acceptance owns
-- Offering -> Match -> Intent. Shared cancellation uses the same order when a
-- live offer exists and retries safely if a match appears while cancellation is
-- acquiring the intent row.

-- The earlier intent-close trigger starts after PostgreSQL has already locked the
-- intent row, so a trigger cannot enforce Offering -> Match -> Intent. Canonical
-- cancellation below releases the hold explicitly and atomically instead.
drop trigger if exists release_shared_holds_on_intent_close on public.travel_intents;

create or replace function private.match_shared_request(p_intent_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_i public.travel_intents%rowtype;
  v_o record;
  v_match uuid;
  v_expired_offering uuid;
begin
  -- Deliberately do not lock the intent here. The offering-side matcher takes
  -- Offering -> Intent and rechecks ACTIVE under the intent row lock.
  select * into v_i from public.travel_intents t where t.id=p_intent_id;
  if not found then raise exception 'TRAVEL_INTENT_NOT_FOUND'; end if;
  if v_i.intent_kind<>'SHARED_REQUEST' or v_i.status<>'ACTIVE' then
    return jsonb_build_object('intent_id',v_i.id,'matched',false);
  end if;

  select sm.offering_id into v_expired_offering
    from public.shared_trip_matches sm
   where sm.travel_intent_id=v_i.id and sm.status='OFFERED' and sm.expires_at<=now()
   order by sm.expires_at,sm.id
   limit 1;
  if v_expired_offering is not null then
    perform private.release_expired_shared_trip_holds(v_expired_offering);
  end if;

  select sm.id into v_match from public.shared_trip_matches sm
   where sm.travel_intent_id=v_i.id and sm.status='OFFERED' and sm.expires_at>now()
   limit 1;
  if v_match is not null then
    return jsonb_build_object('intent_id',v_i.id,'matched',true,'match_id',v_match);
  end if;

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
    -- This helper owns Offering -> Intent and rechecks request status/capacity.
    perform private.match_shared_requests_to_trip(v_o.id);
    select sm.id into v_match from public.shared_trip_matches sm
     where sm.travel_intent_id=v_i.id and sm.status='OFFERED' and sm.expires_at>now()
     limit 1;
    exit when v_match is not null;
  end loop;

  return jsonb_build_object('intent_id',v_i.id,'matched',v_match is not null,'match_id',v_match);
end; $$;
revoke all on function private.match_shared_request(uuid) from public,anon,authenticated;

create or replace function private.refresh_shared_ride(p_intent_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_profile uuid:=auth.uid();
  v_i public.travel_intents%rowtype;
  v_idem public.command_idempotency;
  v_match jsonb;
  v_result jsonb;
begin
  if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
  v_idem:=private.claim_user_command('refresh_shared_ride',p_idempotency_key,md5(p_intent_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  -- Read-only ownership check. Do not lock Intent before the matcher locks Offering.
  select * into v_i from public.travel_intents
   where id=p_intent_id and passenger_profile_id=v_profile;
  if not found then raise exception 'SHARED_REQUEST_NOT_FOUND'; end if;
  if v_i.intent_kind<>'SHARED_REQUEST' or v_i.status<>'ACTIVE' then raise exception 'SHARED_REQUEST_NOT_ACTIVE'; end if;

  v_match:=private.match_shared_request(v_i.id);

  -- A concurrent cancellation can win while refresh is looking. Report the
  -- authoritative post-match state rather than the stale pre-match snapshot.
  select * into v_i from public.travel_intents
   where id=p_intent_id and passenger_profile_id=v_profile;
  if not found then raise exception 'SHARED_REQUEST_NOT_FOUND'; end if;
  if v_i.status<>'ACTIVE' then raise exception 'SHARED_REQUEST_NOT_ACTIVE'; end if;

  v_result:=jsonb_build_object(
    'intent_id',v_i.id,'status',v_i.status,
    'driver_offer_ready',coalesce((v_match->>'matched')::boolean,false),
    'match_id',v_match->'match_id'
  );
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.refresh_shared_ride(uuid,text) from public,anon,authenticated;
grant execute on function private.refresh_shared_ride(uuid,text) to authenticated;

create or replace function private.start_shared_ride(
  p_origin_location_id uuid,
  p_destination_location_id uuid,
  p_desired_departure_at timestamptz,
  p_desired_window_end_at timestamptz,
  p_seat_count integer,
  p_notification_interest boolean,
  p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_profile uuid:=auth.uid();
  v_origin public.locations%rowtype;
  v_destination public.locations%rowtype;
  v_product public.service_products%rowtype;
  v_rules jsonb;
  v_max_booking integer;
  v_horizon integer;
  v_limit integer:=20;
  v_count integer;
  v_existing public.travel_intents%rowtype;
  v_idem public.command_idempotency;
  v_hash text;
  v_id uuid:=gen_random_uuid();
  v_inserted integer:=0;
  v_match jsonb;
  v_result jsonb;
begin
  if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;

  v_hash:=md5(concat_ws('|',p_origin_location_id,p_destination_location_id,p_desired_departure_at,p_desired_window_end_at,p_seat_count,p_notification_interest));
  v_idem:=private.claim_user_command('start_shared_ride',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  select * into v_origin from public.locations where id=p_origin_location_id and is_active;
  if not found or v_origin.market_id is null then raise exception 'SHARED_ORIGIN_INVALID'; end if;
  select * into v_destination from public.locations where id=p_destination_location_id and is_active;
  if not found then raise exception 'SHARED_DESTINATION_INVALID'; end if;
  if p_origin_location_id=p_destination_location_id then raise exception 'SHARED_SAME_LOCATION'; end if;

  select p.* into v_product
    from public.service_products p
    join public.markets m on m.id=p.market_id and m.status in ('PILOT','ACTIVE','SCALING')
   where p.market_id=v_origin.market_id
     and p.service_type='RAAHI_TRIP'
     and p.status in ('PILOT','ACTIVE')
     and private.product_feature_enabled(p.id)
   order by p.code,p.id
   limit 1;
  if not found then raise exception 'SHARED_PRODUCT_NOT_AVAILABLE'; end if;

  select rv.rules into v_rules from public.service_product_rule_versions rv
   where rv.product_id=v_product.id and rv.version_no=v_product.current_rules_version;
  v_max_booking:=coalesce((v_rules->>'max_seats_per_booking')::integer,4);
  v_horizon:=coalesce((v_rules->>'max_publish_horizon_days')::integer,60);

  if p_seat_count is null or p_seat_count<1 or p_seat_count>v_max_booking then raise exception 'SHARED_SEAT_COUNT_INVALID'; end if;
  if p_desired_departure_at is null or p_desired_departure_at<=now() then raise exception 'SHARED_DEPARTURE_INVALID'; end if;
  if p_desired_departure_at>now()+make_interval(days=>v_horizon) then raise exception 'SHARED_DEPARTURE_INVALID'; end if;
  if p_desired_window_end_at is null or p_desired_window_end_at<p_desired_departure_at then raise exception 'SHARED_WINDOW_INVALID'; end if;

  -- A read-only dedupe lookup avoids Intent -> Offering lock inversion. The
  -- partial unique index remains the final concurrent-dedupe authority.
  select * into v_existing
    from public.travel_intents t
   where t.passenger_profile_id=v_profile
     and t.origin_location_id=p_origin_location_id
     and t.destination_location_id=p_destination_location_id
     and t.desired_departure_at is not distinct from p_desired_departure_at
     and t.acceptable_service_type='RAAHI_TRIP'
     and t.intent_kind='SHARED_REQUEST'
     and t.status='ACTIVE'
   limit 1;

  if found then
    v_match:=private.match_shared_request(v_existing.id);
    v_result:=jsonb_build_object(
      'intent_id',v_existing.id,'status','ACTIVE','deduplicated',true,
      'intent_kind','SHARED_REQUEST','seat_count',v_existing.seat_count,
      'notification_interest',v_existing.notification_interest,
      'creates_booking',false,'driver_offer_ready',coalesce((v_match->>'matched')::boolean,false),
      'match_id',v_match->'match_id'
    );
    return private.complete_user_command(v_idem.id,v_result);
  end if;

  select greatest(1,least(100,coalesce(nullif(f.config->>'max_intents_per_user_24h','')::integer,20)))
    into v_limit
    from public.market_feature_flags f
   where f.market_id=v_origin.market_id and f.flag_key='travel_intent';
  v_limit:=coalesce(v_limit,20);
  select count(*) into v_count from public.travel_intents t
   where t.passenger_profile_id=v_profile and t.created_at>=now()-interval '24 hours';
  if v_count>=v_limit then raise exception 'TRAVEL_INTENT_RATE_LIMITED'; end if;

  insert into public.travel_intents(
    id,passenger_profile_id,origin_location_id,destination_location_id,origin_market_id,
    desired_departure_at,desired_window_end_at,seat_count,acceptable_service_type,
    notification_interest,status,intent_kind
  ) values(
    v_id,v_profile,p_origin_location_id,p_destination_location_id,v_origin.market_id,
    p_desired_departure_at,p_desired_window_end_at,p_seat_count,'RAAHI_TRIP',
    coalesce(p_notification_interest,false),'ACTIVE','SHARED_REQUEST'
  ) on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted=0 then
    select * into v_existing
      from public.travel_intents t
     where t.passenger_profile_id=v_profile
       and t.origin_location_id=p_origin_location_id
       and t.destination_location_id=p_destination_location_id
       and t.desired_departure_at is not distinct from p_desired_departure_at
       and t.acceptable_service_type='RAAHI_TRIP'
       and t.intent_kind='SHARED_REQUEST'
       and t.status='ACTIVE'
     limit 1;
    if not found then raise exception 'SHARED_REQUEST_CONCURRENT_STATE_CHANGED'; end if;
    v_id:=v_existing.id;
  else
    perform private.ensure_emerging_corridor_signal(v_origin.market_id,p_origin_location_id,p_destination_location_id);
  end if;

  v_match:=private.match_shared_request(v_id);
  if v_inserted=0 then
    select * into v_existing from public.travel_intents where id=v_id;
  else
    select * into v_existing from public.travel_intents where id=v_id;
  end if;

  v_result:=jsonb_build_object(
    'intent_id',v_id,'status',v_existing.status,'deduplicated',v_inserted=0,
    'origin_market_id',v_origin.market_id,'seat_count',v_existing.seat_count,
    'intent_kind','SHARED_REQUEST','notification_interest',v_existing.notification_interest,
    'creates_booking',false,'driver_offer_ready',coalesce((v_match->>'matched')::boolean,false),
    'match_id',v_match->'match_id'
  );
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.start_shared_ride(uuid,uuid,timestamptz,timestamptz,integer,boolean,text) from public,anon,authenticated;
grant execute on function private.start_shared_ride(uuid,uuid,timestamptz,timestamptz,integer,boolean,text) to authenticated;

create or replace function private.decline_shared_trip_match(p_match_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_profile uuid:=auth.uid();
  v_offering_id uuid;
  v_m public.shared_trip_matches%rowtype;
  v_idem public.command_idempotency;
  v_result jsonb;
begin
  if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
  v_idem:=private.claim_user_command('decline_shared_trip_match',p_idempotency_key,md5(p_match_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  select m.offering_id into v_offering_id from public.shared_trip_matches m
   where m.id=p_match_id and m.passenger_profile_id=v_profile;
  if v_offering_id is null then raise exception 'SHARED_MATCH_NOT_FOUND'; end if;

  perform 1 from public.trip_offerings where id=v_offering_id for update;
  if not found then raise exception 'TRIP_OFFERING_NOT_FOUND'; end if;
  perform private.release_expired_shared_trip_holds(v_offering_id);
  select * into v_m from public.shared_trip_matches
   where id=p_match_id and passenger_profile_id=v_profile for update;
  if not found then raise exception 'SHARED_MATCH_NOT_FOUND'; end if;

  if v_m.status='DECLINED' then
    v_result:=jsonb_build_object('match_id',v_m.id,'intent_id',v_m.travel_intent_id,'status','DECLINED','refresh_required',true);
    return private.complete_user_command(v_idem.id,v_result);
  end if;
  if v_m.status='EXPIRED' then
    v_result:=jsonb_build_object('match_id',v_m.id,'intent_id',v_m.travel_intent_id,'status','EXPIRED','refresh_required',true);
    return private.complete_user_command(v_idem.id,v_result);
  end if;
  if v_m.status<>'OFFERED' then raise exception 'SHARED_MATCH_NOT_DECLINABLE'; end if;

  update public.trip_offerings set held_seats=held_seats-v_m.seat_count,updated_at=now()
   where id=v_offering_id and held_seats>=v_m.seat_count;
  if not found then raise exception 'SHARED_HOLD_STATE_INVALID'; end if;
  update public.shared_trip_matches set status='DECLINED',declined_at=now(),updated_at=now()
   where id=v_m.id and status='OFFERED';
  if not found then raise exception 'SHARED_MATCH_STATE_CHANGED'; end if;

  -- Do not acquire a second offering while this transaction still owns the
  -- declined offering. Passenger refresh performs rematching in a new transaction.
  v_result:=jsonb_build_object(
    'match_id',v_m.id,'intent_id',v_m.travel_intent_id,'status','DECLINED',
    'next_offer_ready',false,'refresh_required',true
  );
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.decline_shared_trip_match(uuid,text) from public,anon,authenticated;
grant execute on function private.decline_shared_trip_match(uuid,text) to authenticated;

create or replace function private.cancel_travel_intent(p_intent_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_profile uuid:=auth.uid();
  v_i public.travel_intents%rowtype;
  v_m public.shared_trip_matches%rowtype;
  v_offering_id uuid;
  v_idem public.command_idempotency;
  v_result jsonb;
  v_attempt integer:=0;
begin
  if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
  v_idem:=private.claim_user_command('cancel_travel_intent',p_idempotency_key,md5(p_intent_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  <<cancel_retry>>
  loop
    v_attempt:=v_attempt+1;
    if v_attempt>4 then raise exception 'SHARED_REQUEST_BUSY_RETRY'; end if;

    -- Initial ownership/status read is intentionally not a row lock.
    select * into v_i from public.travel_intents
     where id=p_intent_id and passenger_profile_id=v_profile;
    if not found then raise exception 'TRAVEL_INTENT_NOT_FOUND'; end if;
    if v_i.status='CANCELLED' then
      v_result:=jsonb_build_object('intent_id',v_i.id,'status','CANCELLED');
      return private.complete_user_command(v_idem.id,v_result);
    end if;
    if v_i.status<>'ACTIVE' then raise exception 'TRAVEL_INTENT_NOT_CANCELLABLE'; end if;

    if v_i.intent_kind<>'SHARED_REQUEST' then
      select * into v_i from public.travel_intents
       where id=p_intent_id and passenger_profile_id=v_profile for update;
      if not found then raise exception 'TRAVEL_INTENT_NOT_FOUND'; end if;
      if v_i.status='CANCELLED' then
        v_result:=jsonb_build_object('intent_id',v_i.id,'status','CANCELLED');
        return private.complete_user_command(v_idem.id,v_result);
      end if;
      if v_i.status<>'ACTIVE' then raise exception 'TRAVEL_INTENT_NOT_CANCELLABLE'; end if;
      update public.travel_intents set status='CANCELLED',cancelled_at=now(),updated_at=now() where id=v_i.id;
      exit cancel_retry;
    end if;

    select m.offering_id into v_offering_id
      from public.shared_trip_matches m
     where m.travel_intent_id=v_i.id and m.status='OFFERED'
     order by m.offered_at,m.id
     limit 1;

    if v_offering_id is not null then
      -- Canonical Shared cancellation order: Offering -> Match -> Intent.
      perform 1 from public.trip_offerings where id=v_offering_id for update;
      if not found then raise exception 'TRIP_OFFERING_NOT_FOUND'; end if;
      select * into v_m from public.shared_trip_matches
       where travel_intent_id=v_i.id and offering_id=v_offering_id and status='OFFERED'
       for update;
      select * into v_i from public.travel_intents
       where id=p_intent_id and passenger_profile_id=v_profile for update;
      if not found then raise exception 'TRAVEL_INTENT_NOT_FOUND'; end if;
      if v_i.status='CANCELLED' then
        v_result:=jsonb_build_object('intent_id',v_i.id,'status','CANCELLED');
        return private.complete_user_command(v_idem.id,v_result);
      end if;
      if v_i.status<>'ACTIVE' then raise exception 'TRAVEL_INTENT_NOT_CANCELLABLE'; end if;

      if found and v_m.id is not null then
        update public.trip_offerings
           set held_seats=held_seats-v_m.seat_count,updated_at=now()
         where id=v_offering_id and held_seats>=v_m.seat_count;
        if not found then raise exception 'SHARED_HOLD_STATE_INVALID'; end if;
        update public.shared_trip_matches
           set status='CANCELLED',cancelled_at=now(),updated_at=now()
         where id=v_m.id and status='OFFERED';
      end if;
      update public.travel_intents set status='CANCELLED',cancelled_at=now(),updated_at=now() where id=v_i.id;
      exit cancel_retry;
    end if;

    -- No live match was visible. Lock Intent in a subtransaction, then recheck.
    -- If a matcher committed a hold while we were waiting, roll the subtransaction
    -- back to release the Intent lock and retry from Offering first.
    begin
      select * into v_i from public.travel_intents
       where id=p_intent_id and passenger_profile_id=v_profile for update;
      if not found then raise exception 'TRAVEL_INTENT_NOT_FOUND'; end if;
      if v_i.status='CANCELLED' then
        v_result:=jsonb_build_object('intent_id',v_i.id,'status','CANCELLED');
        exit cancel_retry;
      end if;
      if v_i.status<>'ACTIVE' then raise exception 'TRAVEL_INTENT_NOT_CANCELLABLE'; end if;

      if exists(
        select 1 from public.shared_trip_matches m
         where m.travel_intent_id=v_i.id and m.status='OFFERED'
      ) then
        raise exception 'SHARED_CANCEL_RETRY' using errcode='40001';
      end if;

      update public.travel_intents set status='CANCELLED',cancelled_at=now(),updated_at=now() where id=v_i.id;
      exit cancel_retry;
    exception when serialization_failure then
      -- Subtransaction rollback releases the Intent row lock before retrying.
      null;
    end;
  end loop;

  v_result:=jsonb_build_object('intent_id',p_intent_id,'status','CANCELLED');
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.cancel_travel_intent(uuid,text) from public,anon,authenticated;
grant execute on function private.cancel_travel_intent(uuid,text) to authenticated;
