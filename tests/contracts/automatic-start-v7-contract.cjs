const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const content = fs.readFileSync(path.join(root, 'src/app/driver-active-car-screen/components/DriverActiveCarContent.tsx'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'src/app/driver-active-car-screen/components/DriverTripLocationPanel.tsx'), 'utf8');
const experience = fs.readFileSync(path.join(root, 'src/app/driver-active-car-screen/components/DriverActiveCarExperience.tsx'), 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

must(content.includes("trip.status !== 'ACTIVE_COLLECTING' || !trip.departure_eligible || !locationReady"), 'Auto-start must require collecting + departure eligibility + usable location');
must(content.includes('void startTrip(trip.trip_id)'), 'Auto-start must reuse canonical startTrip RPC');
must(content.includes("Everyone is aboard - trip started automatically"), 'Driver must receive automatic-departure feedback');
must(!content.includes('setShowStartTripModal'), 'Manual Start Trip modal state must be removed');
must(!content.includes('Start Trip to ${trip.to_location}'), 'Manual Start Trip button must be removed');
must(content.includes('driverCloseEmptySeats'), 'Driver must retain deliberate close-empty-seats action');
must(panel.includes('50000 - age'), 'Pre-departure GPS readiness must expire before backend 60-second freshness gate');
must(panel.includes('onReadyChange?.(false)'), 'Expired/refreshed GPS must clear shared readiness');
must(experience.includes('refreshToken={tripRevision}'), 'Location panel must refresh into IN_PROGRESS after automatic start');
must(content.includes('onTripStarted?.()'), 'Successful automatic start must refresh tracking state');

console.log('Automatic Start Trip Version 7 contract: PASS');