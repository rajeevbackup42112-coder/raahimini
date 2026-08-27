const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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

// Temporary V12 CI fan-out: the base workflow invokes this contract, so run every
// other contract here to validate the full current production-train suite.
const contractDir = path.join(root, 'tests', 'contracts');
const current = path.basename(__filename);
for (const name of fs.readdirSync(contractDir).filter((n) => n.endsWith('-contract.cjs') && n !== current).sort()) {
  const result = spawnSync(process.execPath, [path.join(contractDir, name)], { encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`Contract failed: ${name}`);
}
