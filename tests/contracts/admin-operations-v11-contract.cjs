const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const migration = read('supabase/migrations/20260827194500_v2_prod_v11_admin_operations.sql');
const page = read('src/app/admin-panel/operations/page.tsx');
const api = read('src/lib/adminControlApi.ts');
const nav = read('src/app/admin-panel/components/AdminPrimaryNav.tsx');
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

assert(migration.includes('admin_get_live_trip_operations'), 'V11 live-operations projection missing');
assert(migration.includes('public.is_admin()'), 'V11 projection must enforce Admin access');
for (const state of ['PICKUP_NOW','DRIVE_TO_PICKUP','READY_TO_START','WAIT_OR_CLOSE_SEATS','GET_READY','DRIVE_TO_DESTINATION','COMPLETE_TRIP']) {
  assert(migration.includes(`'${state}'`), `Missing next-action state ${state}`);
}
for (const gps of ['FRESH','STALE','POOR_ACCURACY','MISSING']) {
  assert(migration.includes(`'${gps}'`), `Missing GPS state ${gps}`);
}
assert(!/create or replace function public\.(start_trip|activate_next_driver|join_driver_queue|request_seats)/i.test(migration), 'V11 must not redefine ride-engine commands');
assert(!/\binsert\s+into\b|\bupdate\s+public\.|\bdelete\s+from\b/i.test(migration), 'V11 projection migration must remain read-only');
assert(page.includes('Live transport & safe intervention'), 'Operations page must be live-operations first');
assert(page.includes('GPS attention') && page.includes('Driver queue') && page.includes('Driver recovery'), 'Operations sections missing');
assert(page.includes('<AdminSupportInbox />'), 'Support inbox must be consolidated into Operations');
assert(page.includes("admin_deactivate_driver") && page.includes("admin_reorder_queue") && page.includes("admin_remove_from_queue"), 'Existing guarded mutation RPCs must remain canonical');
assert(!page.includes(".from('trips')") && !page.includes(".from('driver_queue')"), 'Operations UI must not mutate/read core tables directly');assert(api.includes('adminGetLiveTripOperations'), 'V11 Admin API wrapper missing');
assert(nav.includes('href="/profile"') && nav.includes('Account · Admin access'), 'Admin header must expose account/profile access');
for (const oldFile of ['AdminPanelContent.tsx','AdminQuickActions.tsx','AdminDemandOverview.tsx','AdminEntryLink.tsx']) {
  assert(!fs.existsSync(path.join(root, 'src/app/admin-panel/components', oldFile)), `Legacy Admin component should be removed: ${oldFile}`);
}
console.log('Admin Operations Version 11 contract: PASS');