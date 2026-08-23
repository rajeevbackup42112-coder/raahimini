const fs = require('node:fs');
const migration = fs.readFileSync('supabase/migrations/20260823071332_v2_rc1_pipelined_dispatch.sql', 'utf8');
const driverUi = fs.readFileSync('src/app/driver-active-car-screen/components/DriverActiveCarContent.tsx', 'utf8');
function section(start, end) {
  const from = migration.indexOf(start);
  const to = migration.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Missing migration section: ${start}`);
  return migration.slice(from, to);
}
const activation = section('create or replace function public.activate_next_driver', 'create or replace function public.start_trip');
const startTrip = section('create or replace function public.start_trip', 'create or replace function public.complete_trip');
const completeTrip = migration.slice(migration.indexOf('create or replace function public.complete_trip'));
if (activation.includes('blocked_by_in_progress_trip')) throw new Error('IN_PROGRESS must not block the next collecting driver');
if (!activation.includes("status='ACTIVE_COLLECTING'")) throw new Error('activation must enforce one collecting driver per route');
if (!startTrip.includes('activate_next_driver(v_trip.route_id)')) throw new Error('Start Trip must hand off to next FIFO driver');
if (completeTrip.includes('activate_next_driver(v_trip.route_id)')) throw new Error('completion must not be the dispatch handoff');
if (!migration.includes('PIPELINED_PER_DIRECTION')) throw new Error('canonical per-direction dispatch marker missing');
if (!driverUi.includes('next FIFO driver for this direction can begin collecting')) throw new Error('Start Trip copy must explain pipelined handoff');
console.log('Pipelined per-direction dispatch contract: PASS');
