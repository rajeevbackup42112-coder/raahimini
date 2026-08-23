-- Raahi V2 RC1 privilege audit.
-- Expected: both result sets are empty.
-- Read-only.

-- 1) Anonymous SECURITY DEFINER functions must be limited to deliberate public reads.
with allowed_anon(name, args) as (
  values
    ('get_active_locations'::text, ''::text),
    ('get_routes_for_location', 'p_location_id uuid'),
    ('get_public_active_car', 'p_route_id uuid'),
    ('get_route_demand_summary', 'p_route_id uuid'),
    ('get_shared_trip', 'p_token text')
), anon_executable as (
  select p.proname as name,
         pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE')
)
select 'unexpected_anon_security_definer' as violation, a.name, a.args
from anon_executable a
left join allowed_anon ok on ok.name=a.name and ok.args=a.args
where ok.name is null
order by a.name,a.args;

-- 2) Existing core operational tables must not be directly writable by client roles.
-- The wanted list intentionally includes historical names; retired tables are ignored.
with wanted(table_name) as (
  values
    ('trips'),
    ('trip_seats'),
    ('seat_requests'),
    ('driver_queue'),
    ('demand_intents'),
    ('passenger_queue'),
    ('trip_live_locations'),
    ('trip_share_links'),
    ('support_cases')
), core_tables as (
  select c.relname as table_name, c.oid
  from wanted w
  join pg_class c on c.relname=w.table_name and c.relkind='r'
  join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
), roles(role_name) as (
  values ('anon'),('authenticated')
)
select 'direct_core_table_write' as violation,
       r.role_name,
       c.table_name,
       concat_ws(',',
         case when has_table_privilege(r.role_name,c.oid,'INSERT') then 'INSERT' end,
         case when has_table_privilege(r.role_name,c.oid,'UPDATE') then 'UPDATE' end,
         case when has_table_privilege(r.role_name,c.oid,'DELETE') then 'DELETE' end
       ) as write_privileges
from core_tables c cross join roles r
where has_table_privilege(r.role_name,c.oid,'INSERT')
   or has_table_privilege(r.role_name,c.oid,'UPDATE')
   or has_table_privilege(r.role_name,c.oid,'DELETE')
order by c.table_name,r.role_name;
