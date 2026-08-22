const fs = require('fs');

function read(path) { return fs.readFileSync(path, 'utf8'); }
function expect(source, fragment, message) { if (!source.includes(fragment)) throw new Error(message); }

const migration = read('supabase/migrations/20260822183000_v2_beta1_driver_economics_projection.sql');
const card = read('src/app/driver-route-selection/components/DriverRouteCard.tsx');
const api = read('src/lib/raahiApi.ts');

expect(migration, 'fare_per_seat integer', 'driver route projection must expose fare per seat');
expect(migration, 'vehicle_capacity integer', 'driver route projection must expose the driver vehicle capacity');
expect(migration, 'join public.drivers d on d.profile_id=auth.uid()', 'economics must use the authenticated driver vehicle');
expect(migration, 'r.fare_per_seat', 'economics must use the canonical route fare');
if (/update\s+public\.driver_queue/i.test(migration) || /insert\s+into\s+public\.driver_queue/i.test(migration)) {
  throw new Error('driver economics projection must not mutate FIFO');
}
expect(api, 'fare_per_seat: number; vehicle_capacity: number;', 'driver route client contract must include economics fields');
expect(card, 'Current fare', 'Driver Home must show the current fare');
expect(card, 'Full {capacity}-seat car', 'Driver Home must show the full-car value');
expect(card, 'Likely fill:', 'Driver Home must translate return demand into an understandable signal');
expect(card, 'Advisory only — FIFO is unchanged.', 'Driver Home must explicitly preserve FIFO semantics');

console.log('driver economics contract: PASS');
