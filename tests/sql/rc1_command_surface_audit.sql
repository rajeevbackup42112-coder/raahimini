-- Raahi V2 RC1 canonical command-surface audit.
-- Expected: no duplicate signatures; internal matcher helper remains client-inaccessible.
-- Read-only.

with commands(name) as (
  values
    ('request_seats'),
    ('withdraw_seat_request'),
    ('driver_confirm_payment'),
    ('driver_mark_passenger_absent'),
    ('driver_close_empty_seats'),
    ('start_trip'),
    ('complete_trip'),
    ('driver_cancel_trip'),
    ('join_driver_queue'),
    ('leave_driver_queue'),
    ('create_demand_intent'),
    ('cancel_my_demand_intent'),
    ('admin_remove_from_queue'),
    ('admin_reorder_queue'),
    ('admin_onboard_driver')
), live as (
  select p.proname, p.oid,
         pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join commands c on c.name=p.proname
  where n.nspname='public'
), duplicates as (
  select proname, count(*) as overloads,
         array_agg(args order by args) as signatures
  from live
  group by proname
  having count(*)<>1
)
select 'ambiguous_command_surface' as violation,
       proname, overloads, signatures
from duplicates
order by proname;

select 'internal_helper_exposed_to_client' as violation,
       p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_exec
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname='activate_next_driver'
  and (
    has_function_privilege('anon',p.oid,'EXECUTE')
    or has_function_privilege('authenticated',p.oid,'EXECUTE')
  );
