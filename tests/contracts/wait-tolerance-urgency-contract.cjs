const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260823014000_v2_beta2_wait_tolerance_urgency.sql'), 'utf8');
const demandPage = fs.readFileSync(path.join(root, 'src/app/active-car-screen/components/ActiveCarContent.tsx'), 'utf8');
const driverCard = fs.readFileSync(path.join(root, 'src/app/driver-route-selection/components/DriverRouteCard.tsx'), 'utf8');

const must = (condition, message) => { if (!condition) throw new Error(message); };

must(migration.includes('min_wait_tolerance_minutes'), 'route urgency projection missing');
must(migration.includes("'wait_tolerance_minutes',v_intent.wait_tolerance_minutes"), 'passenger demand restore must include wait tolerance');
must(!/update\s+public\.(driver_queue|trips|trip_seats)/i.test(migration), 'wait-tolerance projection must never mutate operational state');
must(!/activate_next_driver|join_driver_queue|request_seats|book/i.test(migration), 'wait-tolerance projection must not invoke allocation or booking');
must(demandPage.includes('const WAIT_OPTIONS = [15, 30, 60]'), 'passenger wait choices missing');
must(demandPage.includes('createNowDemandIntent(routeId, waitTolerance)'), 'chosen wait must reach the existing demand RPC');
must(demandPage.includes('It never changes FIFO'), 'passenger FIFO-neutral copy missing');
must(driverCard.includes('Shortest stated wait:'), 'driver urgency signal missing');
must(driverCard.includes('Advisory only — FIFO is unchanged.'), 'driver FIFO-neutral copy missing');

console.log('Wait-tolerance urgency contract: PASS');
