const fs = require('fs');

const migration = fs.readFileSync('supabase/migrations/20260822190000_v2_beta1_structured_support.sql', 'utf8');
const supportButton = fs.readFileSync('src/components/SupportIssueButton.tsx', 'utf8');
const adminInbox = fs.readFileSync('src/app/admin-panel/components/AdminSupportInbox.tsx', 'utf8');

const must = (condition, message) => {
  if (!condition) {
    console.error(`Structured support contract failed: ${message}`);
    process.exit(1);
  }
};

must(migration.includes('create table if not exists public.support_cases'), 'support_cases table missing');
must(migration.includes('alter table public.support_cases enable row level security'), 'support_cases RLS missing');
must(migration.includes('revoke all on table public.support_cases from public, anon, authenticated, service_role'), 'direct table access must stay revoked');
must(migration.includes('create or replace function public.create_support_case'), 'canonical create_support_case RPC missing');
must(migration.includes("v_profile.role='passenger'"), 'passenger reporter validation missing');
must(migration.includes("v_profile.role='driver'"), 'driver reporter validation missing');
must(migration.includes("sc.status='OPEN'"), 'open-case dedupe missing');
must(migration.includes('create or replace function public.admin_get_open_support_cases'), 'admin support inbox RPC missing');
must(migration.includes('create or replace function public.admin_resolve_support_case'), 'admin resolve RPC missing');

for (const forbidden of ['update public.trips', 'update public.driver_queue', 'update public.trip_seats', 'update public.seat_requests']) {
  must(!migration.toLowerCase().includes(forbidden), `support reporting must not mutate core operational state: ${forbidden}`);
}

must(supportButton.includes('It does not cancel or change your ride.'), 'support UI must preserve non-mutating promise');
must(supportButton.includes("supabase.rpc('create_support_case'"), 'support UI must use canonical RPC');
must(adminInbox.includes("supabase.rpc('admin_get_open_support_cases'"), 'admin inbox must use canonical read RPC');
must(adminInbox.includes("supabase.rpc('admin_resolve_support_case'"), 'admin resolve action must use canonical RPC');

console.log('Structured support contract passed');
