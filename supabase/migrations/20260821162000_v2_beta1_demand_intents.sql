-- Raahi V2 Beta1 demand activation
-- Demand intent is advisory only. It never owns seats, creates trips, or changes driver FIFO.

create table if not exists public.demand_intents (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.profiles(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade,
  intent_kind text not null check (intent_kind in ('NOW','SCHEDULED')),
  earliest_at timestamptz not null,
  latest_at timestamptz not null,
  wait_tolerance_minutes integer,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SATISFIED','CANCELLED','EXPIRED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  satisfied_at timestamptz,
  cancelled_at timestamptz,
  constraint demand_window_valid check (latest_at >= earliest_at),
  constraint demand_wait_bounds check (wait_tolerance_minutes is null or wait_tolerance_minutes between 5 and 180),
  constraint demand_kind_wait_consistency check (
    (intent_kind = 'NOW' and wait_tolerance_minutes is not null)
    or (intent_kind = 'SCHEDULED' and wait_tolerance_minutes is null)
  )
);

create index if not exists idx_demand_intents_route_status
  on public.demand_intents(route_id, status, earliest_at, latest_at);
create index if not exists idx_demand_intents_passenger_status
  on public.demand_intents(passenger_id, status, created_at desc);
create unique index if not exists uq_demand_now_active_passenger_route
  on public.demand_intents(passenger_id, route_id)
  where intent_kind = 'NOW' and status = 'ACTIVE';

alter table public.demand_intents enable row level security;

drop policy if exists demand_intents_read_own on public.demand_intents;
create policy demand_intents_read_own
  on public.demand_intents
  for select
  to authenticated
  using (passenger_id = auth.uid() or public.is_admin());

revoke all on public.demand_intents from anon, authenticated;
grant select on public.demand_intents to authenticated;

create or replace function public.create_demand_intent(
  p_route_id uuid,
  p_intent_kind text,
  p_earliest_at timestamptz,
  p_latest_at timestamptz default null,
  p_wait_tolerance_minutes integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_route public.routes%rowtype;
  v_kind text := upper(coalesce(p_intent_kind,''));
  v_earliest timestamptz;
  v_latest timestamptz;
  v_wait integer;
  v_existing uuid;
  v_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.id is null or v_profile.role <> 'passenger' then
    return jsonb_build_object('success', false, 'error', 'Passenger account required');
  end if;
  if v_profile.is_restricted then
    return jsonb_build_object('success', false, 'error', 'Account is restricted');
  end if;

  select * into v_route from public.routes where id = p_route_id and is_active = true;
  if v_route.id is null then
    return jsonb_build_object('success', false, 'error', 'Route is not active');
  end if;

  if v_kind not in ('NOW','SCHEDULED') then
    return jsonb_build_object('success', false, 'error', 'Invalid demand intent type');
  end if;

  if v_kind = 'NOW' then
    v_wait := coalesce(p_wait_tolerance_minutes, 30);
    if v_wait < 5 or v_wait > 180 then
      return jsonb_build_object('success', false, 'error', 'Wait tolerance must be between 5 and 180 minutes');
    end if;
    v_earliest := greatest(coalesce(p_earliest_at, now()), now());
    v_latest := v_earliest + make_interval(mins => v_wait);

    select id into v_existing
    from public.demand_intents
    where passenger_id = v_uid
      and route_id = p_route_id
      and intent_kind = 'NOW'
      and status = 'ACTIVE'
    order by created_at desc
    limit 1
    for update;

    if v_existing is not null then
      update public.demand_intents
      set earliest_at = v_earliest,
          latest_at = v_latest,
          wait_tolerance_minutes = v_wait,
          updated_at = now()
      where id = v_existing;
      return jsonb_build_object('success', true, 'intent_id', v_existing, 'deduplicated', true);
    end if;
  else
    if p_earliest_at is null or p_latest_at is null then
      return jsonb_build_object('success', false, 'error', 'Scheduled travel requires a start and end time');
    end if;
    v_earliest := p_earliest_at;
    v_latest := p_latest_at;
    if v_earliest <= now() then
      return jsonb_build_object('success', false, 'error', 'Scheduled travel must be in the future');
    end if;
    if v_latest <= v_earliest then
      return jsonb_build_object('success', false, 'error', 'Travel window must end after it starts');
    end if;
    if v_latest - v_earliest > interval '24 hours' then
      return jsonb_build_object('success', false, 'error', 'Travel window cannot exceed 24 hours');
    end if;
    if v_earliest > now() + interval '30 days' then
      return jsonb_build_object('success', false, 'error', 'Travel plans can be created up to 30 days ahead');
    end if;
    v_wait := null;
  end if;

  insert into public.demand_intents (
    passenger_id, route_id, intent_kind, earliest_at, latest_at, wait_tolerance_minutes
  ) values (
    v_uid, p_route_id, v_kind, v_earliest, v_latest, v_wait
  ) returning id into v_id;

  insert into public.audit_log(actor_id, action, table_name, record_id, new_data)
  values (
    v_uid,
    'create_demand_intent',
    'demand_intents',
    v_id,
    jsonb_build_object('route_id', p_route_id, 'intent_kind', v_kind, 'earliest_at', v_earliest, 'latest_at', v_latest)
  );

  return jsonb_build_object('success', true, 'intent_id', v_id, 'deduplicated', false);
end;
$$;

create or replace function public.cancel_my_demand_intent(p_intent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.demand_intents%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  select * into v_row
  from public.demand_intents
  where id = p_intent_id and passenger_id = v_uid
  for update;

  if v_row.id is null then
    return jsonb_build_object('success', false, 'error', 'Demand intent not found');
  end if;

  if v_row.status <> 'ACTIVE' then
    return jsonb_build_object('success', true, 'intent_id', v_row.id, 'already_inactive', true);
  end if;

  update public.demand_intents
  set status = 'CANCELLED', cancelled_at = now(), updated_at = now()
  where id = v_row.id;

  insert into public.audit_log(actor_id, action, table_name, record_id)
  values (v_uid, 'cancel_demand_intent', 'demand_intents', v_row.id);

  return jsonb_build_object('success', true, 'intent_id', v_row.id, 'already_inactive', false);
end;
$$;

create or replace function public.expire_demand_intents()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.demand_intents
  set status = 'EXPIRED', updated_at = now()
  where status = 'ACTIVE' and latest_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.get_route_demand_summary(p_route_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with counts as (
    select
      count(*) filter (
        where intent_kind = 'NOW'
          and status = 'ACTIVE'
          and earliest_at <= now()
          and latest_at >= now()
      )::integer as now_count,
      count(*) filter (
        where intent_kind = 'SCHEDULED'
          and status = 'ACTIVE'
          and latest_at >= now()
          and earliest_at <= now() + interval '7 days'
      )::integer as scheduled_count
    from public.demand_intents
    where route_id = p_route_id
  )
  select jsonb_build_object(
    'route_id', p_route_id,
    'now_count', now_count,
    'scheduled_count', scheduled_count,
    'demand_label', case
      when now_count >= 4 then 'HIGH'
      when now_count >= 2 then 'MEDIUM'
      when now_count = 1 then 'LOW'
      else 'NONE'
    end
  )
  from counts;
$$;

revoke all on function public.create_demand_intent(uuid,text,timestamptz,timestamptz,integer) from public, anon;
revoke all on function public.cancel_my_demand_intent(uuid) from public, anon;
revoke all on function public.expire_demand_intents() from public, anon, authenticated;
revoke all on function public.get_route_demand_summary(uuid) from public;

grant execute on function public.create_demand_intent(uuid,text,timestamptz,timestamptz,integer) to authenticated;
grant execute on function public.cancel_my_demand_intent(uuid) to authenticated;
grant execute on function public.get_route_demand_summary(uuid) to anon, authenticated;
