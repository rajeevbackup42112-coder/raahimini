const fs = require('fs');

function read(path) { return fs.readFileSync(path, 'utf8'); }
function expect(source, fragment, message) { if (!source.includes(fragment)) throw new Error(message); }

const migration = read('supabase/migrations/20260822184500_v2_beta1_admin_route_health.sql');
const overview = read('src/app/admin-panel/components/AdminRouteHealthOverview.tsx');
const page = read('src/app/admin-panel/page.tsx');

expect(migration, 'admin_get_route_health', 'Admin Home must use the route-health read model');
expect(migration, 'if not public.is_admin()', 'route health must remain admin-only');
expect(migration, "NO_DRIVER_WITH_DEMAND", 'route health must surface no-supply demand');
expect(migration, "NO_NEXT_DRIVER_WITH_DEMAND", 'route health must surface missing next-driver supply');
expect(migration, "WAITING_DRIVER_NOT_ACTIVATED", 'route health must detect a stuck waiting driver');
if (/\b(update|insert|delete)\s+public\./i.test(migration)) throw new Error('admin route health must be read-only');
expect(overview, 'Operations now', 'Admin Home must answer current operational health first');
expect(overview, 'Needs attention', 'Admin Home must show an exception inbox');
expect(overview, 'Route health', 'Admin Home must show route-level operational cards');
expect(overview, 'Passenger demand', 'route cards must include demand context');
expect(overview, 'Next driver', 'route cards must include the next waiting driver');
expect(page, '<AdminRouteHealthOverview />', 'route health must appear on Admin Home');
expect(page, 'Detailed management', 'table/detail views must be secondary to the overview');

console.log('admin route health contract: PASS');
