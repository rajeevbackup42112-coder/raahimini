const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const migrationPath = path.join(root, 'supabase/migrations/20260822163000_v2_beta1_sequential_dispatch.sql');
const driverUiPath = path.join(root, 'src/app/driver-active-car-screen/components/DriverActiveCarContent.tsx');

const migration = fs.readFileSync(migrationPath, 'utf8');
const driverUi = fs.readFileSync(driverUiPath, 'utf8');

function section(start, end) {
  const from = migration.indexOf(start);
  const to = migration.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Missing migration section: ${start}`);
  return migration.slice(from, to);
}

const activation = section('CREATE OR REPLACE FUNCTION public.activate_next_driver', 'CREATE OR REPLACE FUNCTION public.start_trip');
const startTrip = section('CREATE OR REPLACE FUNCTION public.start_trip', 'CREATE OR REPLACE FUNCTION public.complete_trip');
const completeTrip = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.complete_trip'));

if (!activation.includes("status = 'IN_PROGRESS'")) throw new Error('activate_next_driver must block IN_PROGRESS routes');
if (!activation.includes('blocked_by_in_progress_trip')) throw new Error('activation guard result marker is missing');
if (startTrip.includes('activate_next_driver')) throw new Error('start_trip must not activate the next driver');
if (!completeTrip.includes('activate_next_driver(v_trip.route_id)')) throw new Error('complete_trip must activate the next driver');
if (driverUi.includes('If another driver is waiting, Raahi will activate that driver for passenger collection.')) throw new Error('Start Trip modal still describes pre-completion activation');
if (!driverUi.includes('stays in queue until your trip is complete')) throw new Error('Start Trip modal must describe sequential dispatch');

console.log('Sequential dispatch contract: PASS');
