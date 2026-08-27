const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const map = fs.readFileSync(path.join(root, 'src/app/request-status-screen/components/PassengerLiveLocationStatus.tsx'), 'utf8');
const status = fs.readFileSync(path.join(root, 'src/app/request-status-screen/components/RequestStatusContent.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/lib/raahiApi.ts'), 'utf8');

const must = (condition, message) => { if (!condition) throw new Error(message); };

must(api.includes('latitude?: number') && api.includes('longitude?: number'), 'live location coordinates must remain in the typed contract');
must(map.includes('window.setInterval') && map.includes('15000'), 'passenger live location must refresh about every 15 seconds');
must(map.includes('openstreetmap.org/export/embed.html'), 'V8 must render a real map without a billable map API key');
must(map.includes('marker: `${lat},${lon}`'), 'map must place the current driver marker');
must(map.includes('Last known location'), 'stale-location label missing');
must(map.includes('Live map temporarily unavailable'), 'no-location fallback missing');
must(map.includes('referrerPolicy="no-referrer"'), 'map embed should not send the Raahi page referrer');
must(map.includes('Boarded at') && map.includes('Destination'), 'pickup/destination context missing from live map card');
must(status.includes('pickupName={req.pickup_stop_name}') && status.includes('destinationName={routeTo}'), 'Passenger journey context must be passed into the live map');
must(status.includes('isConfirmed && !isTripInProgress'), 'active trip must not duplicate the old confirmation card under the live map');
must(status.includes('!isTripCompleted && !isTripInProgress'), 'active trip must not duplicate the standalone destination card under the live map');

console.log('Passenger live map Version 8 contract: PASS');
