const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/e2e-staging.yml'), 'utf8');
const config = fs.readFileSync(path.join(root, 'playwright.staging.config.mjs'), 'utf8');

const must = (condition, message) => { if (!condition) throw new Error(message); };

must(workflow.includes('RAAHI_STAGING_URL: ${{ vars.RAAHI_STAGING_URL }}'), 'staging workflow must use an explicit repository variable');
must(workflow.includes('Validate staging target'), 'staging workflow must fail closed on missing target');
must(config.includes("if (!baseURL)"), 'Playwright staging config must reject a missing target');
must(config.includes("parsed.protocol !== 'https:'"), 'Playwright staging config must require HTTPS');
must(!/builtwithrocket\.new|vercel\.app/i.test(config), 'Playwright config must not contain a hardcoded hosting target');
must(!/builtwithrocket\.new|vercel\.app/i.test(workflow), 'staging workflow must not contain a hardcoded hosting target');
must(!/\b(vercel|rocket|deploy|supabase\s+db\s+push)\b/i.test(workflow), 'staging E2E workflow must test only and never deploy');

console.log('Staging target safety contract: PASS');
