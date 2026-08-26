const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const file = fs.readFileSync(path.join(root, 'src/app/request-status-screen/components/RequestStatusContent.tsx'), 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

must(file.includes("const isOnTheWay = isConfirmed && req.trip_status === 'IN_PROGRESS'"), 'Passenger in-progress state must be explicit');
must(file.includes('On your way to ${routeTo}'), 'Passenger must see destination-focused next state after boarding');
must(file.includes('pickupLabel={isOnTheWay ? undefined : req.pickup_stop_name}'), 'Pickup label must not remain dominant after boarding');
must(file.includes('Your destination'), 'Passenger must receive a destination card during the trip');
must(file.includes('req.stops.length > 0 && !isOnTheWay'), 'Stop-by-stop progress must be hidden after confirmed trip start');
must(file.includes('You are travelling to ${routeTo}.'), 'Confirmed passenger copy must reflect travel toward destination');

console.log('Passenger next-state Version 5 contract: PASS');
