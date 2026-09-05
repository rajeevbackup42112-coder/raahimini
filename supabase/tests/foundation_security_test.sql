begin;
select plan(10);

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

select ok((
  select relrowsecurity from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'service_product_rules'
), 'internal product rules have RLS enabled');

select ok(not has_table_privilege('anon', 'public.service_product_rules', 'SELECT'),
  'anon cannot read product rules');

select is((
  select count(*)::integer
  from pg_constraint
  where conrelid = 'public.mobility_commitments'::regclass
    and contype = 'x'
), 2, 'Driver and Vehicle overlap exclusion constraints both exist');

select is((select status from public.markets where code = 'GOMOH'),
  'PILOT', 'Gomoh seed starts as PILOT');

select is((select status from public.markets where code = 'DHANBAD'),
  'PREPARING', 'Dhanbad seed exists without pretending it is live');

select is((
  select status from public.service_products where code = 'DHANBAD_GOMOH_FIXED_OW'
), 'DRAFT', 'reverse Dhanbad product exists but is not launched');

select * from finish();
rollback;
