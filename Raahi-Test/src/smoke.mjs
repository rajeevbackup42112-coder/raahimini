import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { baseUrl, personas, profileDir, reportDir } from './config.mjs';

fs.mkdirSync(reportDir(), { recursive: true });
const results = [];
const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`); };

// Anonymous public browse: no saved session and no OAuth.
{
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Where are you?' }).waitFor({ timeout: 12000 });
    record('anonymous browse', true, page.url());
  } catch (e) {
    record('anonymous browse', false, String(e.message || e));
    await page.screenshot({ path: path.join(reportDir(), 'anonymous-fail.png'), fullPage: true });
  }
  await browser.close();
}

for (const [persona, cfg] of Object.entries(personas)) {
  const dir = profileDir(persona);
  if (!fs.existsSync(dir)) {
    record(`${persona} session`, false, 'profile missing — run setup-auth');
    continue;
  }
  const context = await chromium.launchPersistentContext(dir, { channel: 'chrome', headless: true });
  const page = context.pages()[0] || await context.newPage();
  try {
    if (cfg.role === 'passenger') {
      await page.goto(`${baseUrl}/admin-panel`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      const pathname = new URL(page.url()).pathname;
      record(`${persona} role boundary`, pathname === '/', page.url());
    } else {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      const pathname = new URL(page.url()).pathname;
      record(`${persona} role landing`, cfg.expected.test(pathname), page.url());
    }
  } catch (e) {
    record(`${persona} role smoke`, false, String(e.message || e));
    await page.screenshot({ path: path.join(reportDir(), `${persona}-fail.png`), fullPage: true });
  }
  await context.close();
}

const payload = { ran_at: new Date().toISOString(), base_url: baseUrl, results, passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length };
fs.writeFileSync(path.join(reportDir(), 'smoke-summary.json'), JSON.stringify(payload, null, 2));
fs.writeFileSync(path.join(reportDir(), 'smoke-summary.txt'), results.map(r => `${r.ok ? 'PASS' : 'FAIL'} ${r.name}: ${r.detail}`).join('\n') + '\n');
console.log(`\n${payload.passed} passed, ${payload.failed} failed. Reports: ${reportDir()}`);
process.exit(payload.failed ? 1 : 0);
