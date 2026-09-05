begin;
select plan(14);

select has_table('public', 'account_capabilities',
  'capability table exists');

select ok(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
), 'profiles has no exclusive role column');

select has_table('public', 'driver_operating_markets',
  'Driver Operating Market is first-class state');

select has_table('public', 'admin_scope_assignments',
  'scoped Admin assignment table exists');

select has_table('public', 'service_product_rule_versions',
  'immutable Product rule versions exist');

select ok(not exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'service_product_rules'
), 'mutable Product rules table has been retired');

select ok(not has_table_privilege('anon', 'public.service_product_rule_versions', 'SELECT'),
  'anon cannot read internal Product rules');
select has_table('public', 'command_idempotency',
  'retry-safe command identity store exists');

select ok(not has_table_privilege('authenticated', 'public.command_idempotency', 'INSERT'),
  'browser-authenticated callers cannot write idempotency state directly');

select is((
  select count(*)::integer
  from pg_constraint
  where conrelid = 'public.mobility_commitments'::regclass
    and contype = 'x'
), 2, 'Driver and Vehicle overlap exclusion constraints both exist');

select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.driver_active_vehicles'::regclass
    and conname = 'driver_active_vehicle_access_fk'
), 'active Vehicle must reference Driver Vehicle access');

select is((select status from public.markets where code = 'GOMOH'),
  'PILOT', 'Gomoh seed starts as PILOT');

select is((select status from public.markets where code = 'DHANBAD'),
  'PREPARING', 'Dhanbad seed exists without pretending it is live');

select is((
  select status from public.service_products where code = 'DHANBAD_GOMOH_FIXED_OW'
), 'DRAFT', 'reverse Dhanbad product exists but is not launched');

select * from finish();
rollback;
