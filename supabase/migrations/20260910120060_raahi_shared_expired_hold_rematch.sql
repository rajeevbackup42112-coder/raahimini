-- A stale OFFERED row cannot remain behind the one-live-offer unique index.
-- Passenger-side rematching first releases its own expired hold, then searches again.

create or replace function private.match_shared_request(p_intent_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_i public.travel_intents%rowtype;
  v_o record;
  v_match uuid;
  v_expired_offering uuid;
begin
  select * into v_i from public.travel_intents t where t.id=p_intent_id for update;
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

  select * into v_i from public.travel_intents
   where id=p_intent_id and passenger_profile_id=v_profile for update;
  if not found then raise exception 'SHARED_REQUEST_NOT_FOUND'; end if;
  if v_i.intent_kind<>'SHARED_REQUEST' or v_i.status<>'ACTIVE' then raise exception 'SHARED_REQUEST_NOT_ACTIVE'; end if;

  v_match:=private.match_shared_request(v_i.id);
  v_result:=jsonb_build_object(
    'intent_id',v_i.id,'status',v_i.status,
    'driver_offer_ready',coalesce((v_match->>'matched')::boolean,false),
    'match_id',v_match->'match_id'
  );
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.refresh_shared_ride(uuid,text) from public,anon,authenticated;
grant execute on function private.refresh_shared_ride(uuid,text) to authenticated;

create or replace function public.refresh_shared_ride(p_intent_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.refresh_shared_ride(p_intent_id,p_idempotency_key); $$;
revoke all on function public.refresh_shared_ride(uuid,text) from public,anon,authenticated;
grant execute on function public.refresh_shared_ride(uuid,text) to authenticated;
