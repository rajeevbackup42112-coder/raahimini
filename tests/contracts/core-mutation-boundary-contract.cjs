const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const src = path.join(root, 'src');
const coreTables = [
  'trips',
  'trip_seats',
  'seat_requests',
  'driver_queue',
  'demand_intents',
  'passenger_queue',
  'trip_live_locations',
  'trip_share_links',
  'support_cases',
];

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
  }
}
walk(src);

const violations = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const table of coreTables) {
    const directMutation = new RegExp(`\\.from\\(\\s*['\"]${table}['\"]\\s*\\)[\\s\\S]{0,160}?\\.(insert|update|upsert|delete)\\s*\\(`, 'i');
    if (directMutation.test(text)) violations.push(`${path.relative(root, file)} -> ${table}`);
  }
}

if (violations.length) {
  throw new Error(`Core operational tables must mutate only through canonical RPCs:\n${violations.join('\n')}`);
}

console.log('Core mutation boundary contract: PASS');
