const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'src/app/request-status-screen/components/RequestStatusContent.tsx'), 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

must(source.includes("const isTripInProgress = req.trip_status === 'IN_PROGRESS'"), 'Passenger screen must distinguish in-progress trips');
must(source.includes("? `You're on your way to ${routeTo}`"), 'In-progress passenger copy must point to destination');
must(source.includes("isTripInProgress ? 'Destination'"), 'Passenger next card must become Destination after trip start');
must(source.includes("isTripInProgress || isConfirmed ? routeTo : req.pickup_stop_name"), 'Passenger next place must use destination after boarding/start');
must(source.includes("pickupLabel={isHeld ? req.pickup_stop_name : undefined}"), 'Pickup label must disappear after boarding');
must(!source.includes('Driver Progress'), 'Passenger screen must not expose obsolete Driver Progress');
must(!source.includes('Stop {req.current_stop_order} of {req.stops.length}'), 'Passenger screen must not show route-stop counters');
must(source.includes("['Requested', 'Confirmed', 'On the way', 'Arrived']"), 'Passenger journey states must be simplified');

console.log('Passenger operational sync Version 6 contract: PASS');