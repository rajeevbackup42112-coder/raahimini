create or replace function private.fixed_driver_match_eligible(
  p_driver_id uuid,
  p_vehicle_id uuid,
  p_product_id uuid,
  p_commitment_end timestamptz
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.drivers d
    join public.service_products p on p.id = p_product_id
    join public.markets m on m.id = p.market_id
    join public.driver_operating_markets om on om.driver_id = d.id and om.market_id = p.market_id
    join public.driver_product_preferences pref on pref.driver_id = d.id and pref.product_id = p.id and pref.is_enabled
    join public.driver_active_vehicles av on av.driver_id = d.id and av.vehicle_id = p_vehicle_id
    join public.driver_vehicle_access dva on dva.driver_id = d.id and dva.vehicle_id = p_vehicle_id and dva.revoked_at is null
    join public.vehicles v on v.id = p_vehicle_id and v.status = 'ELIGIBLE'
    where d.id = p_driver_id
      and d.standing = 'ACTIVE'
      and p.service_type = 'FIXED_ONE_WAY'
      and p.status in ('PILOT','ACTIVE')
      and m.status in ('PILOT','ACTIVE','SCALING')
      and not exists (
        select 1 from (values ('PHONE'),('DRIVING_LICENCE'),('DRIVER_PHOTO')) req(t)
        where not exists (
          select 1 from public.verification_records vr
          where vr.driver_id = d.id
            and vr.verification_type = req.t
            and vr.status = 'VERIFIED'
            and (vr.expires_at is null or vr.expires_at > now())
        )
      )
      and not exists (
        select 1 from (values ('VEHICLE_RC'),('VEHICLE_PHOTOS')) req(t)
        where not exists (
          select 1 from public.verification_records vr
          where vr.vehicle_id = p_vehicle_id
            and vr.verification_type = req.t
            and vr.status = 'VERIFIED'
            and (vr.expires_at is null or vr.expires_at > now())
        )
      )
      and not exists (
        select 1 from public.mobility_commitments c
        where (c.driver_id = d.id or c.vehicle_id = p_vehicle_id)
          and c.status in ('RESERVED','ACTIVE')
          and c.starts_at < p_commitment_end
          and c.ends_at > now()
      )
  );
$$;

revoke all on function private.fixed_driver_match_eligible(uuid, uuid, uuid, timestamptz)
from public, anon, authenticated;
grant execute on function private.fixed_driver_match_eligible(uuid, uuid, uuid, timestamptz)
to service_role;

create or replace function private.match_fixed_product(
  p_product_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.service_products%rowtype;
  v_rules public.service_product_rule_versions%rowtype;
  v_availability public.driver_availability%rowtype;
  v_idem public.command_idempotency%rowtype;
  v_actor_scope text := 'system:fixed-match:' || p_product_id::text;
  v_hash text := md5(p_product_id::text);
  v_candidate_ids uuid[] := array[]::uuid[];
  v_selected_ids uuid[];
  v_origin_id uuid;
  v_destination_id uuid;
  v_capacity integer;
  v_fare integer;
  v_window integer;
  v_horizon integer;
  v_ack_seconds integer;
  v_commitment_end timestamptz;
  v_ride_id uuid;
  v_commitment_id uuid;
  v_max_selected_pos integer;
  v_driver_found boolean := false;
  v_result jsonb;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  insert into public.command_idempotency(
    actor_kind, actor_profile_id, actor_scope, command_name,
    idempotency_key, request_hash
  ) values (
    'SYSTEM', null, v_actor_scope, 'match_fixed_product',
    p_idempotency_key, v_hash
  ) on conflict (actor_scope, command_name, idempotency_key) do nothing;

  select * into v_idem
  from public.command_idempotency i
  where i.actor_scope = v_actor_scope
    and i.command_name = 'match_fixed_product'
    and i.idempotency_key = p_idempotency_key
  for update;

  if v_idem.request_hash <> v_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if v_idem.status = 'SUCCEEDED' then return v_idem.result; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_product_id::text, 0));

  select * into v_product
  from public.service_products p
  where p.id = p_product_id
    and p.service_type = 'FIXED_ONE_WAY'
    and p.status in ('PILOT','ACTIVE')
    and exists (
      select 1 from public.markets m
      where m.id = p.market_id and m.status in ('PILOT','ACTIVE','SCALING')
    );
  if not found then raise exception 'FIXED_PRODUCT_NOT_AVAILABLE'; end if;

  select * into v_rules
  from public.service_product_rule_versions r
  where r.product_id = v_product.id
    and r.version_no = v_product.current_rules_version;
  if not found then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;

  if coalesce(v_rules.rules ->> 'capacity_policy', '') <> 'FULL_CAPACITY' then
    raise exception 'UNSUPPORTED_CAPACITY_POLICY';
  end if;

  v_fare := (v_rules.rules ->> 'fare_per_seat_inr')::integer;
  v_window := least(greatest((v_rules.rules ->> 'matcher_candidate_window')::integer, 4), 20);
  v_horizon := (v_rules.rules ->> 'commitment_horizon_minutes')::integer;
  v_ack_seconds := (v_rules.rules ->> 'driver_ack_seconds')::integer;
  if v_fare <= 0 or v_horizon <= 0 or v_ack_seconds <= 0 then
    raise exception 'PRODUCT_CONFIGURATION_INVALID';
  end if;

  select c.origin_location_id, c.destination_location_id
  into v_origin_id, v_destination_id
  from public.corridors c
  where c.id = v_product.corridor_id and c.is_active;
  if not found then raise exception 'PRODUCT_CONFIGURATION_INVALID'; end if;

  for v_availability in
    select a.*
    from public.driver_availability a
    where a.product_id = p_product_id and a.status = 'QUEUED'
    order by a.queued_at, a.id
    for update skip locked
  loop
    perform 1 from public.drivers d where d.id = v_availability.driver_id for update;
    perform 1 from public.vehicles v where v.id = v_availability.vehicle_id for update;

    select v.bookable_passenger_capacity into v_capacity
    from public.vehicles v where v.id = v_availability.vehicle_id;
    v_commitment_end := now() + make_interval(mins => v_horizon);

    if private.fixed_driver_match_eligible(
      v_availability.driver_id,
      v_availability.vehicle_id,
      p_product_id,
      v_commitment_end
    ) then
      v_driver_found := true;
      exit;
    end if;

    update public.driver_availability
    set status = 'INELIGIBLE', exited_at = now(), exit_reason = 'MATCH_RECHECK_FAILED'
    where id = v_availability.id;
  end loop;

  if not v_driver_found then
    v_result := jsonb_build_object('matched', false, 'reason', 'NO_ELIGIBLE_DRIVER');
    update public.command_idempotency
    set status = 'SUCCEEDED', result = v_result, completed_at = now()
    where id = v_idem.id;
    return v_result;
  end if;

  select coalesce(
    array_agg(q.id order by q.match_skip_count desc, q.queued_at, q.id),
    array[]::uuid[]
  )
  into v_candidate_ids
  from (
    select r.id, r.match_skip_count, r.queued_at
    from public.fixed_passenger_requests r
    where r.product_id = p_product_id and r.status = 'QUEUED'
    order by r.match_skip_count desc, r.queued_at, r.id
    limit v_window
    for update skip locked
  ) q;

  with recursive ordered as (
    select r.id, r.seat_count, r.match_skip_count,
           array_position(v_candidate_ids, r.id) as rn
    from public.fixed_passenger_requests r
    where r.id = any(v_candidate_ids) and r.status = 'QUEUED'
  ), combos(ids, total_seats, last_rn, skip_sum, rank_sum) as (
    select array[o.id]::uuid[], o.seat_count, o.rn,
           o.match_skip_count, o.rn::bigint
    from ordered o
    where o.seat_count <= v_capacity
    union all
    select c.ids || o.id,
           c.total_seats + o.seat_count,
           o.rn,
           c.skip_sum + o.match_skip_count,
           c.rank_sum + o.rn
    from combos c
    join ordered o on o.rn > c.last_rn
    where c.total_seats + o.seat_count <= v_capacity
  )
  select c.ids into v_selected_ids
  from combos c
  where c.total_seats = v_capacity
  order by c.skip_sum desc,
           c.rank_sum asc,
           cardinality(c.ids) asc,
           c.ids::text
  limit 1;

  if v_selected_ids is null then
    v_result := jsonb_build_object('matched', false, 'reason', 'NO_FULL_BATCH');
    update public.command_idempotency
    set status = 'SUCCEEDED', result = v_result, completed_at = now()
    where id = v_idem.id;
    return v_result;
  end if;

  select max(array_position(v_candidate_ids, x.id))
  into v_max_selected_pos
  from unnest(v_selected_ids) as x(id);

  update public.fixed_passenger_requests r
  set match_skip_count = least(r.match_skip_count + 1, 1000),
      last_skipped_at = now()
  where r.id = any(v_candidate_ids)
    and not (r.id = any(v_selected_ids))
    and array_position(v_candidate_ids, r.id) < v_max_selected_pos
    and r.status = 'QUEUED';

  update public.driver_availability
  set status = 'RESERVED', reserved_at = now()
  where id = v_availability.id and status = 'QUEUED';
  if not found then raise exception 'DRIVER_AVAILABILITY_CHANGED'; end if;

  update public.fixed_passenger_requests
  set status = 'RESERVED', reserved_at = now()
  where id = any(v_selected_ids) and status = 'QUEUED';
  if not found then raise exception 'PASSENGER_QUEUE_CHANGED'; end if;

  v_ride_id := gen_random_uuid();

  insert into public.rides(
    id, product_id, product_rules_version, driver_id, vehicle_id,
    origin_market_id, origin_location_id, destination_location_id,
    capacity, booked_seat_count, fare_per_seat_inr,
    status, matched_at, driver_ack_deadline, commitment_ends_at
  ) values (
    v_ride_id, v_product.id, v_rules.version_no,
    v_availability.driver_id, v_availability.vehicle_id,
    v_product.market_id, v_origin_id, v_destination_id,
    v_capacity, v_capacity, v_fare,
    'MATCHED', now(), now() + make_interval(secs => v_ack_seconds), v_commitment_end
  );

  insert into public.mobility_commitments(
    driver_id, vehicle_id, product_id, origin_market_id,
    source_type, source_id, starts_at, ends_at, status
  ) values (
    v_availability.driver_id, v_availability.vehicle_id,
    v_product.id, v_product.market_id,
    'FIXED_RIDE', v_ride_id, now(), v_commitment_end, 'RESERVED'
  ) returning id into v_commitment_id;

  update public.rides set commitment_id = v_commitment_id where id = v_ride_id;

  insert into public.ride_bookings(
    ride_id, passenger_request_id, passenger_profile_id,
    seat_count, fare_per_seat_inr, boarding_context
  )
  select v_ride_id, r.id, r.passenger_profile_id,
         r.seat_count, r.fare_per_seat_inr, r.boarding_context
  from public.fixed_passenger_requests r
  where r.id = any(v_selected_ids);

  update public.fixed_passenger_requests
  set status = 'ASSIGNED', assigned_at = now()
  where id = any(v_selected_ids) and status = 'RESERVED';

  if (select count(*) from public.fixed_passenger_requests where id = any(v_selected_ids) and status = 'ASSIGNED')
     <> cardinality(v_selected_ids) then
    raise exception 'PASSENGER_ASSIGNMENT_INCOMPLETE';
  end if;

  update public.driver_availability
  set status = 'ASSIGNED', assigned_at = now()
  where id = v_availability.id and status = 'RESERVED';
  if not found then raise exception 'DRIVER_ASSIGNMENT_INCOMPLETE'; end if;

  insert into public.ride_events(
    ride_id, event_type, actor_kind, previous_state, next_state, metadata
  ) values (
    v_ride_id, 'RIDE_MATCHED', 'SYSTEM', null, 'MATCHED',
    jsonb_build_object(
      'product_id', v_product.id,
      'driver_availability_id', v_availability.id,
      'passenger_request_ids', to_jsonb(v_selected_ids),
      'capacity', v_capacity,
      'rules_version', v_rules.version_no
    )
  );

  v_result := jsonb_build_object(
    'matched', true,
    'ride_id', v_ride_id,
    'commitment_id', v_commitment_id,
    'driver_id', v_availability.driver_id,
    'vehicle_id', v_availability.vehicle_id,
    'passenger_request_ids', to_jsonb(v_selected_ids),
    'capacity', v_capacity,
    'status', 'MATCHED'
  );

  update public.command_idempotency
  set status = 'SUCCEEDED', result = v_result, completed_at = now()
  where id = v_idem.id;

  return v_result;
end;
$$;

revoke all on function private.match_fixed_product(uuid, text)
from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.match_fixed_product(uuid, text) to service_role;

create or replace function public.match_fixed_product(
  p_product_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.match_fixed_product(p_product_id, p_idempotency_key);
$$;

revoke all on function public.match_fixed_product(uuid, text)
from public, anon, authenticated;
grant execute on function public.match_fixed_product(uuid, text) to service_role;
