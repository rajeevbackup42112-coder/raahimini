const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/e2e-staging.yml'), 'utf8');
const config = fs.readFileSync(path.join(root, 'playwright.staging.config.mjs'), 'utf8');
const safetyRoute = fs.readFileSync(path.join(root, 'src/app/api/staging-safety/route.ts'), 'utf8');

const must = (condition, message) => { if (!condition) throw new Error(message); };
const v2DevRef = 'euqonxznewasaymdzach';

must(workflow.includes('RAAHI_STAGING_URL: ${{ vars.RAAHI_STAGING_URL }}'), 'staging workflow must use an explicit repository variable');
must(workflow.includes('Validate staging target'), 'staging workflow must fail closed on missing target');
must(workflow.includes('Verify isolated V2 backend'), 'staging workflow must verify backend identity before E2E');
must(workflow.includes('/api/staging-safety'), 'staging workflow must call the safety attestation endpoint');
must(workflow.includes(v2DevRef), 'staging workflow must pin the isolated V2 Dev project ref');
must(config.includes("if (!baseURL)"), 'Playwright staging config must reject a missing target');
must(config.includes("parsed.protocol !== 'https:'"), 'Playwright staging config must require HTTPS');
must(!/builtwithrocket\.new|vercel\.app/i.test(config), 'Playwright config must not contain a hardcoded hosting target');
must(!/builtwithrocket\.new|vercel\.app/i.test(workflow), 'staging workflow must not contain a hardcoded hosting target');
must(!/\b(vercel|rocket|deploy|supabase\s+db\s+push)\b/i.test(workflow), 'staging E2E workflow must test only and never deploy');

must(safetyRoute.includes(`const V2_DEV_PROJECT_REF = '${v2DevRef}'`), 'safety endpoint must pin the isolated V2 Dev project');
must(safetyRoute.includes("process.env.RAAHI_TEST_AUTH_ENABLED !== 'true'"), 'safety endpoint must be unavailable outside test-enabled environments');
must(safetyRoute.includes('RAAHI_TEST_AUTH_ALLOWED_HOSTS'), 'safety endpoint must require an allowed staging host');
must(safetyRoute.includes('HARD_BLOCKED_HOSTS'), 'safety endpoint must retain hard production-host blocks');
must(safetyRoute.includes('projectRef === V2_DEV_PROJECT_REF'), 'safety endpoint must compare the actual Supabase project ref');
must(safetyRoute.includes("'Cache-Control': 'no-store'"), 'safety attestation must not be cached');

console.log('Staging target safety contract: PASS');
