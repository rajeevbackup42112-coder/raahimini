-- Beta1 in-app demand notification state and dedup.
-- Advisory only: never allocates seats, creates trips, or changes driver FIFO.

create table if not exists public.demand_notification_state (
  route_id uuid primary key references public.routes(id) on delete cascade,
  demand_label text not null default 'NONE'
    check (demand_label in ('NONE','LOW','MEDIUM','HIGH')),
  supply_present boolean not null default false,
  min_wait_tolerance_minutes integer,
  updated_at timestamptz not null default now()
);

alter table public.demand_notification_state enable row level security;
revoke all on public.demand_notification_state from public, anon, authenticated;

create or replace function public.demand_label_rank(p_label text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case upper(coalesce(p_label, 'NONE'))
    when 'LOW' then 1
    when 'MEDIUM' then 2
    when 'HIGH' then 3
    else 0
  end;
$$;

revoke all on function public.demand_label_rank(text) from public, anon, authenticated;
create or replace function public.refresh_demand_notification_state(
  p_route_id uuid,
  p_urgency_increased boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.demand_notification_state%rowtype;
  v_now_count integer := 0;
  v_label text := 'NONE';
  v_supply boolean := false;
  v_min_wait integer;
  v_event text;
begin
  if p_route_id is null then return; end if;

  insert into public.demand_notification_state(route_id)
  values (p_route_id)
  on conflict (route_id) do nothing;

  select * into v_state
  from public.demand_notification_state
  where route_id = p_route_id
  for update;

  select count(*)::integer, min(wait_tolerance_minutes)
  into v_now_count, v_min_wait
  from public.demand_intents
  where route_id = p_route_id
    and intent_kind = 'NOW'
    and status = 'ACTIVE'
    and earliest_at <= now()
    and latest_at >= now();

  v_label := case
    when v_now_count >= 4 then 'HIGH'
    when v_now_count >= 2 then 'MEDIUM'
    when v_now_count = 1 then 'LOW'
    else 'NONE'
  end;

  select exists (
    select 1
    from public.trips
    where route_id = p_route_id
      and status = 'ACTIVE_COLLECTING'
  ) into v_supply;

  if v_supply then
    if not v_state.supply_present and v_label <> 'NONE' then
      v_event := 'SUPPLY_AVAILABLE';
    end if;
  elsif v_label <> 'NONE' then
    if v_state.supply_present then
      v_event := 'DEMAND_' || v_label;
    elsif public.demand_label_rank(v_label) > public.demand_label_rank(v_state.demand_label) then
      v_event := 'DEMAND_' || v_label;
    elsif p_urgency_increased then
      v_event := 'DEMAND_URGENCY';
    end if;
  end if;
  if v_event is not null then
    insert into public.raahi_invalidation_events(route_id, source_table, event_kind)
    values (p_route_id, 'demand_notification', v_event);
  end if;

  update public.demand_notification_state
  set demand_label = v_label,
      supply_present = v_supply,
      min_wait_tolerance_minutes = v_min_wait,
      updated_at = now()
  where route_id = p_route_id;
end;
$$;

revoke all on function public.refresh_demand_notification_state(uuid,boolean)
  from public, anon, authenticated;

create or replace function public.handle_demand_intent_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_route_id uuid;
  v_urgency_increased boolean := false;
begin
  v_route_id := case when tg_op = 'DELETE' then old.route_id else new.route_id end;

  if tg_op = 'UPDATE' then
    v_urgency_increased :=
      old.intent_kind = 'NOW'
      and new.intent_kind = 'NOW'
      and old.status = 'ACTIVE'
      and new.status = 'ACTIVE'
      and new.wait_tolerance_minutes is not null
      and old.wait_tolerance_minutes is not null
      and new.wait_tolerance_minutes < old.wait_tolerance_minutes;
  end if;

  insert into public.raahi_invalidation_events(route_id, source_table, event_kind)
  values (v_route_id, 'demand_intents', tg_op);

  perform public.refresh_demand_notification_state(v_route_id, v_urgency_increased);

  delete from public.raahi_invalidation_events
  where created_at < now() - interval '2 days';

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.handle_demand_intent_notification()
  from public, anon, authenticated;

drop trigger if exists trg_demand_invalidation_and_notifications on public.demand_intents;
create trigger trg_demand_invalidation_and_notifications
after insert or update or delete on public.demand_intents
for each row execute function public.handle_demand_intent_notification();
create or replace function public.handle_trip_demand_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_route_id uuid;
begin
  v_route_id := case when tg_op = 'DELETE' then old.route_id else new.route_id end;
  perform public.refresh_demand_notification_state(v_route_id, false);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.handle_trip_demand_notification()
  from public, anon, authenticated;

drop trigger if exists trg_trip_demand_notification on public.trips;
create trigger trg_trip_demand_notification
after insert or delete or update of status on public.trips
for each row execute function public.handle_trip_demand_notification();

insert into public.demand_notification_state(route_id)
select id from public.routes
on conflict (route_id) do nothing;

do $$
declare v_route_id uuid;
begin
  for v_route_id in select id from public.routes loop
    perform public.refresh_demand_notification_state(v_route_id, false);
  end loop;
end $$;
