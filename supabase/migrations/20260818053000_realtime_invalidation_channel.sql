-- RAAHI MINI — PROJECTION-SAFE REALTIME INVALIDATION
-- Clients subscribe only to this deliberately minimal event stream, then refetch
-- canonical RPC projections. Authoritative operational rows remain non-public.

create table if not exists public.raahi_invalidation_events (
  id bigint generated always as identity primary key,
  route_id uuid null references public.routes(id) on delete cascade,
  source_table text not null,
  event_kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_raahi_invalidation_events_route_created
  on public.raahi_invalidation_events(route_id,created_at desc);

alter table public.raahi_invalidation_events enable row level security;

drop policy if exists raahi_invalidation_public_read on public.raahi_invalidation_events;
create policy raahi_invalidation_public_read
  on public.raahi_invalidation_events
  for select
  to anon,authenticated
  using (true);

revoke all on table public.raahi_invalidation_events from public,anon,authenticated;
grant select on table public.raahi_invalidation_events to anon,authenticated;

create or replace function public.emit_raahi_invalidation()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_payload jsonb;
  v_route_id uuid;
  v_trip_id uuid;
begin
  v_payload:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;

  if tg_table_name in ('trips','driver_queue','route_stops','route_locations') then
    v_route_id:=nullif(v_payload->>'route_id','')::uuid;
  elsif tg_table_name='routes' then
    v_route_id:=nullif(v_payload->>'id','')::uuid;
  elsif tg_table_name in ('seat_requests','trip_progress','trip_seats') then
    v_trip_id:=nullif(v_payload->>'trip_id','')::uuid;
    if v_trip_id is not null then
      select t.route_id into v_route_id from public.trips t where t.id=v_trip_id;
    end if;
  else
    v_route_id:=null;
  end if;

  insert into public.raahi_invalidation_events(route_id,source_table,event_kind)
  values(v_route_id,tg_table_name,tg_op);

  -- Keep the stream lightweight without requiring a scheduler.
  delete from public.raahi_invalidation_events
  where created_at<now()-interval '2 days';

  return case when tg_op='DELETE' then old else new end;
end;
$$;

revoke all on function public.emit_raahi_invalidation() from public,anon,authenticated;

do $$
declare v_table text;
begin
  foreach v_table in array array['trips','seat_requests','trip_progress','trip_seats','driver_queue','routes','route_stops','route_locations','locations'] loop
    execute format('drop trigger if exists trg_raahi_invalidation on public.%I',v_table);
    execute format('create trigger trg_raahi_invalidation after insert or update or delete on public.%I for each row execute function public.emit_raahi_invalidation()',v_table);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='raahi_invalidation_events'
  ) then
    alter publication supabase_realtime add table public.raahi_invalidation_events;
  end if;
end $$;
