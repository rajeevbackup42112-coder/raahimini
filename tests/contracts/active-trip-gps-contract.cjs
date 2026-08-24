const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260822204500_v2_beta2_active_trip_location_boundary.sql'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'src/app/driver-active-car-screen/components/DriverTripLocationPanel.tsx'), 'utf8');
const content = fs.readFileSync(path.join(root, 'src/app/driver-active-car-screen/components/DriverActiveCarContent.tsx'), 'utf8');
const experience = fs.readFileSync(path.join(root, 'src/app/driver-active-car-screen/components/DriverActiveCarExperience.tsx'), 'utf8');

const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

must(migration.includes('create table if not exists public.trip_live_locations'), 'latest trip location table missing');
must(migration.includes('alter table public.trip_live_locations enable row level security'), 'location RLS missing');
must(migration.includes('revoke all on table public.trip_live_locations from public, anon, authenticated, service_role'), 'direct location-table access must remain revoked');
must(migration.includes("v_trip.status not in ('ACTIVE_COLLECTING','IN_PROGRESS')"), 'driver writes must be restricted to live trips');
must(migration.includes("v_trip.status<>'IN_PROGRESS'"), 'passenger/admin location reads must require IN_PROGRESS');
must(migration.includes("sr.status in ('HELD','CONFIRMED')"), 'passenger live-location authorization missing');
must(migration.includes("v_location.captured_at<now()-interval '60 seconds'"), 'Start Trip recent-fix gate missing');
must(migration.includes('v_location.accuracy_meters>200'), 'Start Trip usable-accuracy gate missing');
must(migration.includes("new.status in ('COMPLETED','CANCELLED')"), 'terminal-state cleanup missing');

const start = migration.slice(migration.indexOf('create or replace function public.start_trip'), migration.indexOf('create or replace function public.cleanup_trip_live_location_on_terminal_state'));
must(!start.includes('activate_next_driver'), 'GPS migration must not regress sequential dispatch by activating the next driver at start');

must(panel.includes('SEND_INTERVAL_MS = 15000'), 'active trip location update interval must remain explicit');
must(panel.includes("trip?.status !== 'IN_PROGRESS'"), 'continuous tracking must run only while IN_PROGRESS');
must(panel.includes('Tracking stops automatically when the trip ends.'), 'driver privacy copy missing');
must(panel.includes('Raahi does not track you merely for waiting or using Driver Home.'), 'pre-start privacy copy missing');
must(experience.includes('onReadyChange={setLocationReady}'), 'location readiness must be shared with the Start Trip UI');
must(content.includes("(trip.departure_eligible ?? false) && locationReady"), 'Start Trip UI must require both departure eligibility and usable location');

console.log('Active-trip GPS contract: PASS');
