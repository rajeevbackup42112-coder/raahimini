-- Raahi Shared passenger-originated demand bridge.
-- Customer-facing product language remains "Raahi Shared"; RAAHI_TRIP is an internal mechanism.

alter table public.travel_intents
  add column intent_kind text not null default 'INTEREST'
  check (intent_kind in ('INTEREST','SHARED_REQUEST'));

-- Preserve Slice 12 exact-active dedupe semantics while allowing an ordinary
-- market-interest signal and an explicit Shared request to coexist.
drop index if exists public.uq_travel_intents_active_exact;
create unique index uq_travel_intents_active_exact
on public.travel_intents(
  passenger_profile_id,
  origin_location_id,
  destination_location_id,
  coalesce(desired_departure_at,'infinity'::timestamptz),
  acceptable_service_type,
  intent_kind
)
where status='ACTIVE';

alter table public.trip_offerings
  add column held_seats integer not null default 0 check (held_seats >= 0);

alter table public.trip_offerings
  add constraint trip_offerings_booked_plus_held_capacity_check
  check (active_booked_seats + held_seats <= offered_seats);

create table public.shared_trip_matches(
  id uuid primary key default gen_random_uuid(),
  travel_intent_id uuid not null references public.travel_intents(id) on delete restrict,
  offering_id uuid not null references public.trip_offerings(id) on delete restrict,
  passenger_profile_id uuid not null references public.profiles(id),
  seat_count integer not null check (seat_count between 1 and 12),
  price_per_seat_inr integer not null check (price_per_seat_inr > 0),
  status text not null default 'OFFERED' check (status in ('OFFERED','ACCEPTED','DECLINED','EXPIRED','CANCELLED')),
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  declined_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  trip_booking_id uuid references public.trip_bookings(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(travel_intent_id,offering_id),
  check (expires_at > offered_at),
  check ((status='ACCEPTED' and accepted_at is not null and trip_booking_id is not null) or status<>'ACCEPTED'),
  check ((status='DECLINED' and declined_at is not null) or status<>'DECLINED'),
  check ((status='EXPIRED' and expired_at is not null) or status<>'EXPIRED'),
  check ((status='CANCELLED' and cancelled_at is not null) or status<>'CANCELLED')
);

create unique index uq_shared_trip_matches_live_intent
  on public.shared_trip_matches(travel_intent_id)
  where status='OFFERED';
create index idx_shared_trip_matches_offering_status
  on public.shared_trip_matches(offering_id,status,expires_at);
create index idx_shared_trip_matches_passenger_status
  on public.shared_trip_matches(passenger_profile_id,status,offered_at desc);
create index idx_shared_trip_matches_booking
  on public.shared_trip_matches(trip_booking_id) where trip_booking_id is not null;

alter table public.shared_trip_matches enable row level security;
create policy shared_trip_matches_no_direct_client_access
  on public.shared_trip_matches for all to anon,authenticated
  using(false) with check(false);
revoke all on table public.shared_trip_matches from anon,authenticated;

create or replace function private.release_expired_shared_trip_holds(p_offering_id uuid)
returns integer language plpgsql security definer set search_path=''
as $$
declare
  v_match public.shared_trip_matches%rowtype;
  v_released integer:=0;
begin
  -- Lock order for every Shared hold mutation is Offering -> Match -> Intent.
  perform 1 from public.trip_offerings where id=p_offering_id for update;
  if not found then raise exception 'TRIP_OFFERING_NOT_FOUND'; end if;

  for v_match in
    select * from public.shared_trip_matches m
    where m.offering_id=p_offering_id and m.status='OFFERED' and m.expires_at<=now()
    order by m.expires_at,m.id
    for update
  loop
    update public.trip_offerings
       set held_seats=held_seats-v_match.seat_count,updated_at=now()
     where id=p_offering_id and held_seats>=v_match.seat_count;
    if not found then raise exception 'SHARED_HOLD_STATE_INVALID'; end if;

    update public.shared_trip_matches
       set status='EXPIRED',expired_at=now(),updated_at=now()
     where id=v_match.id and status='OFFERED';
    if found then v_released:=v_released+v_match.seat_count; end if;
  end loop;
  return v_released;
end; $$;
revoke all on function private.release_expired_shared_trip_holds(uuid) from public,anon,authenticated;

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
       and not exists(
         select 1 from public.shared_trip_matches sm
          where sm.travel_intent_id=t.id and sm.status='OFFERED'
       )
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
  select * into v_i from public.travel_intents t where t.id=p_intent_id for update;
  if not found then raise exception 'TRAVEL_INTENT_NOT_FOUND'; end if;
  if v_i.intent_kind<>'SHARED_REQUEST' or v_i.status<>'ACTIVE' then
    return jsonb_build_object('intent_id',v_i.id,'matched',false);
  end if;

  select sm.id into v_match from public.shared_trip_matches sm
   where sm.travel_intent_id=v_i.id and sm.status='OFFERED' and sm.expires_at>now()
   limit 1;
  if v_match is not null then return jsonb_build_object('intent_id',v_i.id,'matched',true,'match_id',v_match); end if;

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

create or replace function private.trigger_match_shared_requests_on_trip_publish()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.status='FILLING' and old.status is distinct from 'FILLING' then
    perform private.match_shared_requests_to_trip(new.id);
  end if;
  return new;
end; $$;
revoke all on function private.trigger_match_shared_requests_on_trip_publish() from public,anon,authenticated;

drop trigger if exists match_shared_requests_on_trip_publish on public.trip_offerings;
create trigger match_shared_requests_on_trip_publish
after update of status on public.trip_offerings
for each row execute function private.trigger_match_shared_requests_on_trip_publish();

create or replace function private.trigger_release_shared_holds_on_intent_close()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_m public.shared_trip_matches%rowtype;
begin
  if old.status='ACTIVE' and new.status<>'ACTIVE' then
    for v_m in
      select * from public.shared_trip_matches m
       where m.travel_intent_id=new.id and m.status='OFFERED'
       order by m.offered_at,m.id
       for update
    loop
      perform 1 from public.trip_offerings where id=v_m.offering_id for update;
      update public.trip_offerings
         set held_seats=held_seats-v_m.seat_count,updated_at=now()
       where id=v_m.offering_id and held_seats>=v_m.seat_count;
      if not found then raise exception 'SHARED_HOLD_STATE_INVALID'; end if;
      update public.shared_trip_matches
         set status='CANCELLED',cancelled_at=now(),updated_at=now()
       where id=v_m.id and status='OFFERED';
    end loop;
  end if;
  return new;
end; $$;
revoke all on function private.trigger_release_shared_holds_on_intent_close() from public,anon,authenticated;

drop trigger if exists release_shared_holds_on_intent_close on public.travel_intents;
create trigger release_shared_holds_on_intent_close
after update of status on public.travel_intents
for each row execute function private.trigger_release_shared_holds_on_intent_close();

create or replace function private.trigger_release_shared_holds_on_trip_close()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_m public.shared_trip_matches%rowtype;
begin
  if new.status in ('NOT_CONFIRMED','DRIVER_CANCELLED','EXPIRED','IN_FULFILMENT','COMPLETED')
     and old.status is distinct from new.status then
    for v_m in
      select * from public.shared_trip_matches m
       where m.offering_id=new.id and m.status='OFFERED'
       order by m.offered_at,m.id
       for update
    loop
      update public.trip_offerings
         set held_seats=held_seats-v_m.seat_count,updated_at=now()
       where id=new.id and held_seats>=v_m.seat_count;
      if not found then raise exception 'SHARED_HOLD_STATE_INVALID'; end if;
      update public.shared_trip_matches
         set status='CANCELLED',cancelled_at=now(),updated_at=now()
       where id=v_m.id and status='OFFERED';
    end loop;
  end if;
  return new;
end; $$;
revoke all on function private.trigger_release_shared_holds_on_trip_close() from public,anon,authenticated;

drop trigger if exists release_shared_holds_on_trip_close on public.trip_offerings;
create trigger release_shared_holds_on_trip_close
after update of status on public.trip_offerings
for each row execute function private.trigger_release_shared_holds_on_trip_close();
