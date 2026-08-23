const fs = require('fs');
function read(path) { return fs.readFileSync(path, 'utf8'); }
function expect(source, fragment, message) { if (!source.includes(fragment)) throw new Error(message); }
const migration = read('supabase/migrations/20260822183000_v2_beta1_driver_economics_projection.sql');
const home = read('src/app/driver-route-selection/components/DriverRouteCard.tsx');
const active = read('src/app/driver-active-car-screen/components/DriverActiveCarContent.tsx');
const api = read('src/lib/raahiApi.ts');
expect(migration, 'fare_per_seat integer', 'driver route projection must expose fare per seat');
expect(migration, 'vehicle_capacity integer', 'driver route projection must expose vehicle capacity');
expect(migration, 'join public.drivers d on d.profile_id=auth.uid()', 'economics must use authenticated driver vehicle');
expect(migration, 'r.fare_per_seat', 'economics must use canonical route fare');
if (/update\s+public\.driver_queue/i.test(migration) || /insert\s+into\s+public\.driver_queue/i.test(migration)) throw new Error('driver economics projection must not mutate FIFO');
expect(api, 'fare_per_seat: number; vehicle_capacity: number;', 'driver route client contract must include economics fields');
expect(home, 'Current fare', 'Driver Home must show current fare');
expect(home, 'Full {capacity}-seat car', 'Driver Home must show full-car value');
if (home.includes('Return demand') || home.includes('Likely fill')) throw new Error('Driver Home must not expose return demand before trip start');
expect(active, "trip.status === 'IN_PROGRESS' && returnDemandLevel", 'return-demand signal must only render after trip starts');
expect(active, 'Return demand after arrival', 'active-trip screen must show coarse return-demand context');
expect(active, "'Low'|'Medium'|'High'", 'return-demand signal must be coarse Low/Medium/High');
expect(active, 'never changes FIFO', 'return-demand signal must explicitly remain advisory');
console.log('driver economics / post-start return-demand contract: PASS');
