const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const driver = read('src/app/driver-active-car-screen/components/DriverActiveCarContent.tsx');
const api = read('src/lib/raahiApi.ts');
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

assert(driver.includes("trip.next_action !== 'COMPLETE_TRIP'"), 'V12 must wait for backend destination-arrival state');
assert(driver.includes('autoCompleteAttemptRef'), 'V12 needs exactly-once client attempt guard');
assert(driver.includes('void completeTrip(trip.trip_id)'), 'V12 must reuse canonical completeTrip command');
assert(driver.includes('Arrived at destination - completing trip automatically'), 'V12 automatic completion status copy missing');
assert(driver.includes('Retry finalization'), 'V12 must provide a safe retry for transient completion failure');
assert(!driver.includes('showCompleteTripModal'), 'Manual Complete Trip modal must be removed');
assert(!driver.includes("'Completing...' : 'Complete Trip'"), 'Manual Complete Trip button must be removed');
assert(api.includes("rpc('complete_trip',{p_trip_id:tripId})"), 'Client completeTrip wrapper must remain canonical RPC call');
console.log('Automatic Complete Trip Version 12 contract: PASS');
