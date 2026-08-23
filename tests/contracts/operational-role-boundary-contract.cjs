const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const gate = fs.readFileSync(path.join(root, 'src/components/DriverRoleGate.tsx'), 'utf8');
const driverHome = fs.readFileSync(path.join(root, 'src/app/driver-route-selection/page.tsx'), 'utf8');
const driverTrip = fs.readFileSync(path.join(root, 'src/app/driver-active-car-screen/page.tsx'), 'utf8');
const roleDoc = fs.readFileSync(path.join(root, 'docs/RAAHI_ROLE_BOUNDARY_2026-08-18.md'), 'utf8');

const must = (condition, message) => { if (!condition) throw new Error(message); };

must(roleDoc.includes('exactly one operational role'), 'canonical role-boundary decision missing');
must(roleDoc.includes('Admin: administration only'), 'Admin-only operational rule missing');
must(gate.includes("profile?.role !== 'driver'"), 'driver gate must reject every non-driver role');
must(!gate.includes("profile?.role === 'admin'"), 'driver gate must not grant Admin a driver exception');
must(driverHome.includes('<DriverRoleGate>'), 'Driver Home must be wrapped in driver-only gate');
must(driverTrip.includes('<DriverRoleGate>'), 'Driver Active Car must be wrapped in driver-only gate');

console.log('Operational role boundary contract: PASS');
