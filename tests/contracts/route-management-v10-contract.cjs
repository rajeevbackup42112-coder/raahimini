const fs = require('fs');
const read = (p) => fs.readFileSync(p, 'utf8');
const expect = (s, f, m) => { if (!s.includes(f)) throw new Error(m); };

const migration = read('supabase/migrations/20260827174500_v2_prod_v10_route_versioning.sql');
const ui = read('src/app/admin-panel/components/RouteManagementContent.tsx');
const api = read('src/lib/routeManagementApi.ts');
const passenger = read('src/app/components/LocationContent.tsx');
const raahiApi = read('src/lib/raahiApi.ts');

expect(migration, "version_status in ('DRAFT','PUBLISHED','ARCHIVED')", 'route versions need guarded lifecycle states');
expect(migration, "version_status<>'DRAFT' or (is_current=false and is_active=false)", 'draft routes must remain invisible/inactive');
expect(migration, "admin_create_route_draft", 'existing routes must edit through a draft');
expect(migration, "admin_create_new_route_draft", 'Admin must be able to prepare a new route');
expect(migration, "admin_duplicate_route_as_draft", 'Admin must be able to duplicate a route safely');
expect(migration, "admin_replace_route_draft_stops", 'stop edits must target drafts');
expect(migration, "Publish is blocked while this route has a live trip", 'publish must reject live trips');
expect(migration, "Publish is blocked while drivers are queued on this route", 'publish must reject a live queue');
expect(migration, "Publish is blocked while active passenger demand exists on this route", 'publish must reject active demand');
expect(migration, "admin_archive_route", 'archive must replace destructive delete for published routes');
expect(migration, "repeat_route_id", 'completed-trip repeat use must resolve to the current route version');
expect(migration, "where is_current=true and version_status='PUBLISHED'", 'route health must ignore drafts/history');
for (const name of ['start_trip','join_driver_queue','activate_next_driver','request_seats']) {
  if (migration.includes(`create or replace function public.${name}`)) throw new Error(`V10 must not redefine canonical ${name}`);
}
expect(ui, 'New Route', 'Routes UI must expose new-route draft creation');
expect(ui, 'Duplicate', 'Routes UI must expose safe duplication');
expect(ui, 'Save Draft', 'Routes UI must save without publishing');
expect(ui, 'Add Stop', 'Routes UI must support stop editing');
expect(ui, 'draggable', 'Routes UI must support drag reordering while retaining touch buttons');
expect(ui, 'Publish preview', 'Routes UI must preview the exact draft before publish');
expect(ui, 'Publish', 'Routes UI must expose explicit publish');
expect(ui, 'Archive', 'Routes UI must expose archive');
expect(api, "rpc('admin_publish_route_draft'", 'UI must publish through the guarded RPC');
expect(passenger, 'recentTrip?.repeat_route_id', 'Ride again must use the current route version');
if (passenger.includes('comingTo.length > 0')) throw new Error('Passenger Home must not surface incoming routes as current travel choices');
if (passenger.includes('Where are you now?')) throw new Error('Passenger Home must not reintroduce a second location chooser below the unified From/To planner');
expect(passenger, 'Current Shared Ride corridors', 'Passenger Home must keep a passive published-corridor browse surface');
expect(passenger, 'route.from_location_name === location.name', 'Published-corridor browse must keep only routes departing from each origin');
expect(raahiApi, ".eq('is_current',true).eq('version_status','PUBLISHED')", 'legacy Admin route reads must hide drafts/history');
console.log('Guarded Route Management Version 10 contract: PASS');
