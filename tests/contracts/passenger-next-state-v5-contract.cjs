const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const file = fs.readFileSync(path.join(root, 'src/app/request-status-screen/components/RequestStatusContent.tsx'), 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

// V6 supersedes the first V5 passenger patch, but must preserve its core guarantee:
// a confirmed in-progress passenger sees the route destination, not intermediate stops.
must(file.includes("req.trip_status === 'IN_PROGRESS'"), 'Passenger in-progress state must be explicit');
must(file.includes("routeTo"), 'Passenger journey must retain the route destination');
must(file.includes("pickupLabel={isHeld ? req.pickup_stop_name : undefined}"), 'Pickup label must disappear after boarding');
must(!file.includes('Stop {req.current_stop_order} of {req.stops.length}'), 'Passenger must not expose legacy route-stop counters');
must(file.includes('Your destination') || file.includes("'Destination'"), 'Passenger must receive a destination-focused next state');

console.log('Passenger next-state Version 5 compatibility contract: PASS');