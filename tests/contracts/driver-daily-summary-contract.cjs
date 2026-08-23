const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260822215500_v2_beta2_driver_daily_summary.sql'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'src/app/driver-route-selection/components/DriverDailySummary.tsx'), 'utf8');

const must = (condition, message) => { if (!condition) throw new Error(message); };

must(migration.includes('create or replace function public.get_driver_daily_summary'), 'daily summary RPC missing');
must(migration.includes("t.status='COMPLETED'"), 'daily summary must use completed trips only');
must(migration.includes("time zone 'Asia/Kolkata'"), 'daily summary day boundary must use the operating timezone');
must(migration.includes('t.confirmed_count*t.fare_per_seat'), 'fare estimate must come from trip fare snapshots');
for (const forbidden of ['update public.', 'insert into public.', 'delete from public.']) must(!migration.toLowerCase().includes(forbidden), `daily summary must remain read-only: ${forbidden}`);
must(migration.includes('revoke execute on function public.get_driver_daily_summary() from public, anon, service_role'), 'daily summary grants must stay narrow');
must(ui.includes('Completed trips only · fare shown is the in-app fare estimate.'), 'driver summary must not overstate revenue/profit');
must(ui.includes('Avg fill time'), 'fill-time signal missing');

console.log('Driver daily summary contract: PASS');
