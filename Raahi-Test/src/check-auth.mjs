import fs from 'node:fs';
import { chromium } from 'playwright';
import { baseUrl, personas, profileDir } from './config.mjs';

const persona = process.argv[2];
if (!persona || !personas[persona]) {
  console.error(`Usage: node src/check-auth.mjs <${Object.keys(personas).join('|')}>`);
  process.exit(1);
}
const dir = profileDir(persona);
if (!fs.existsSync(dir)) {
  console.error(`No saved profile for ${persona}. Run setup-auth first.`);
  process.exit(2);
}

const context = await chromium.launchPersistentContext(dir, { channel: 'chrome', headless: false });
const page = context.pages()[0] || await context.newPage();
await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const pathname = new URL(page.url()).pathname;
const ok = personas[persona].expected.test(pathname);
console.log(`${ok ? 'PASS' : 'FAIL'} ${persona}: ${page.url()}`);
if (!ok) await page.screenshot({ path: `auth-fail-${persona}.png`, fullPage: true });
await context.close();
process.exit(ok ? 0 : 3);
