-- Raahi V2 RC1 release invariant sweep.
-- Expected result: every count is zero.
-- Read-only: this file must never mutate operational state.

with client_tables as (
  select c.oid, c.relname as table_name, c.relrowsecurity,
         has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as anon_any,
         has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as auth_any
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'
), bad_rls as (
  select table_name from client_tables
  where (anon_any or auth_any) and not relrowsecurity
), trip_mismatch as (
  select t.id
  from public.trips t
  left join lateral (
    select count(*) filter(where ts.state='HELD') held,
           count(*) filter(where ts.state='CONFIRMED') confirmed,
           count(*) filter(where ts.state='DRIVER_CLOSED') closed,
           count(*) total
    from public.trip_seats ts where ts.trip_id=t.id
  ) s on true
  where coalesce(t.held_count,0)<>coalesce(s.held,0)
     or coalesce(t.confirmed_count,0)<>coalesce(s.confirmed,0)
     or coalesce(t.driver_closed_count,0)<>coalesce(s.closed,0)
     or coalesce(s.total,0)>coalesce(t.capacity,0)
), duplicate_queue as (
  select driver_id, route_id
  from public.driver_queue
  where status in ('WAITING','ACTIVE_COLLECTING','IN_PROGRESS')
  group by driver_id,route_id
  having count(*)>1
), request_mismatch as (
  select sr.id
  from public.seat_requests sr
  left join lateral (
    select count(*) n
    from public.trip_seats ts
    where ts.request_id=sr.id and ts.state::text=sr.status::text
  ) s on true
  where sr.status::text in ('HELD','CONFIRMED')
    and coalesce(s.n,0)<>sr.seat_count
), booked_active_demand as (
  select di.id
  from public.demand_intents di
  where di.intent_kind='NOW'
    and di.status='ACTIVE'
    and di.latest_at>now()
    and exists (
      select 1
      from public.seat_requests sr
      join public.trips t on t.id=sr.trip_id
      where sr.passenger_id=di.passenger_id
        and t.route_id=di.route_id
        and sr.status::text in ('HELD','CONFIRMED')
    )
)
select
  (select count(*) from bad_rls) as client_tables_without_rls,
  (select count(*) from trip_mismatch) as trip_seat_aggregate_mismatches,
  (select count(*) from duplicate_queue) as duplicate_active_driver_route_queue,
  (select count(*) from request_mismatch) as held_confirmed_request_ledger_mismatches,
  (select count(*) from booked_active_demand) as booked_passengers_still_active_now_demand;
