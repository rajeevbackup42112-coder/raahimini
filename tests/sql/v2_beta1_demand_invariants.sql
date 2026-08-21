-- Raahi V2 Beta1 demand-intent invariant regression
-- ISOLATED DEV ONLY. Wraps all fixture changes in a transaction and rolls back.
-- Assumes canonical V10 + Alpha1 + Beta1 migrations have already been applied.

begin;

-- Deterministic fixture identities. These are test-only IDs, not migration data.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, is_anonymous)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'beta1-passenger-a@example.invalid', '', now(), now(), now(), '{}', '{"display_name":"Beta1 Passenger A"}', false, false, false),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'beta1-passenger-b@example.invalid', '', now(), now(), now(), '{}', '{"display_name":"Beta1 Passenger B"}', false, false, false)
on conflict (id) do nothing;

insert into public.profiles (id, display_name, role)
values
  ('11111111-1111-4111-8111-111111111111', 'Beta1 Passenger A', 'passenger'),
  ('22222222-2222-4222-8222-222222222222', 'Beta1 Passenger B', 'passenger')
on conflict (id) do update set display_name = excluded.display_name, role = excluded.role;

do $$
declare
  v_route uuid;
  v_before_trips bigint;
  v_before_queue bigint;
  v_before_requests bigint;
  v_before_seats bigint;
  v_first jsonb;
  v_second jsonb;
  v_intent uuid;
  v_summary jsonb;
  v_cross_cancel jsonb;
  v_owner_cancel jsonb;
  v_owner_cancel_again jsonb;
  v_scheduled jsonb;
  v_bad_past jsonb;
  v_bad_reverse jsonb;
  v_expire_candidate jsonb;
  v_expired integer;
begin
  select id into v_route from public.routes where code = 'GD-01' limit 1;
  if v_route is null then
    raise exception 'Fixture route GD-01 not found';
  end if;

  select count(*) into v_before_trips from public.trips;
  select count(*) into v_before_queue from public.driver_queue;
  select count(*) into v_before_requests from public.seat_requests;
  select count(*) into v_before_seats from public.trip_seats;

  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select public.create_demand_intent(v_route, 'NOW', null, null, 30) into v_first;
  if coalesce((v_first->>'success')::boolean, false) is not true then
    raise exception 'NOW create failed: %', v_first;
  end if;

  select public.create_demand_intent(v_route, 'NOW', null, null, 30) into v_second;
  if coalesce((v_second->>'success')::boolean, false) is not true
     or coalesce((v_second->>'deduplicated')::boolean, false) is not true
     or v_second->>'intent_id' <> v_first->>'intent_id' then
    raise exception 'NOW dedupe failed: first=%, second=%', v_first, v_second;
  end if;

  v_intent := (v_first->>'intent_id')::uuid;

  select public.get_route_demand_summary(v_route) into v_summary;
  if coalesce((v_summary->>'now_count')::integer, 0) < 1 then
    raise exception 'Aggregate summary did not count active NOW demand: %', v_summary;
  end if;
  if v_summary ? 'passenger_id' then
    raise exception 'Public aggregate leaked passenger identity: %', v_summary;
  end if;

  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  select public.cancel_my_demand_intent(v_intent) into v_cross_cancel;
  if coalesce((v_cross_cancel->>'success')::boolean, false) is true then
    raise exception 'Cross-passenger cancellation unexpectedly succeeded: %', v_cross_cancel;
  end if;

  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  select public.cancel_my_demand_intent(v_intent) into v_owner_cancel;
  if coalesce((v_owner_cancel->>'success')::boolean, false) is not true then
    raise exception 'Owner cancellation failed: %', v_owner_cancel;
  end if;

  select public.cancel_my_demand_intent(v_intent) into v_owner_cancel_again;
  if coalesce((v_owner_cancel_again->>'success')::boolean, false) is not true
     or coalesce((v_owner_cancel_again->>'already_inactive')::boolean, false) is not true then
    raise exception 'Idempotent cancellation failed: %', v_owner_cancel_again;
  end if;

  select public.create_demand_intent(v_route, 'SCHEDULED', now() + interval '1 day', now() + interval '1 day 1 hour', null) into v_scheduled;
  if coalesce((v_scheduled->>'success')::boolean, false) is not true then
    raise exception 'Valid scheduled intent failed: %', v_scheduled;
  end if;

  select public.create_demand_intent(v_route, 'SCHEDULED', now() - interval '1 hour', now() + interval '1 hour', null) into v_bad_past;
  if coalesce((v_bad_past->>'success')::boolean, false) is true then
    raise exception 'Past scheduled window unexpectedly succeeded: %', v_bad_past;
  end if;

  select public.create_demand_intent(v_route, 'SCHEDULED', now() + interval '2 hours', now() + interval '1 hour', null) into v_bad_reverse;
  if coalesce((v_bad_reverse->>'success')::boolean, false) is true then
    raise exception 'Reversed scheduled window unexpectedly succeeded: %', v_bad_reverse;
  end if;

  select public.create_demand_intent(v_route, 'NOW', null, null, 5) into v_expire_candidate;
  if coalesce((v_expire_candidate->>'success')::boolean, false) is not true then
    raise exception 'Expiry fixture create failed: %', v_expire_candidate;
  end if;

  update public.demand_intents
  set latest_at = now() - interval '1 minute'
  where id = (v_expire_candidate->>'intent_id')::uuid;

  select public.expire_demand_intents() into v_expired;
  if v_expired < 1 then
    raise exception 'Expiry function did not expire stale demand';
  end if;

  -- Critical isolation assertion: demand lifecycle must not mutate the proven engine.
  if (select count(*) from public.trips) <> v_before_trips then
    raise exception 'Demand flow mutated trips';
  end if;
  if (select count(*) from public.driver_queue) <> v_before_queue then
    raise exception 'Demand flow mutated driver_queue';
  end if;
  if (select count(*) from public.seat_requests) <> v_before_requests then
    raise exception 'Demand flow mutated seat_requests';
  end if;
  if (select count(*) from public.trip_seats) <> v_before_seats then
    raise exception 'Demand flow mutated trip_seats';
  end if;

  raise notice 'PASS: Beta1 demand invariants';
end $$;

rollback;
