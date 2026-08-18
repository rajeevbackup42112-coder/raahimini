import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { baseUrl, personas, profileDir } from './config.mjs';

const persona = process.argv[2];
if (!persona || !personas[persona]) {
  console.error(`Usage: node src/setup-auth.mjs <${Object.keys(personas).join('|')}>`);
  process.exit(1);
}

const candidates = [
  process.env.CHROME_PATH,
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
].filter(Boolean);

const chrome = candidates.find((p) => fs.existsSync(p));
if (!chrome) {
  console.error('Google Chrome was not found. Set CHROME_PATH to chrome.exe and run again.');
  process.exit(1);
}

const dir = profileDir(persona);
fs.mkdirSync(dir, { recursive: true });

console.log(`\nRaahi auth setup: ${persona}`);
console.log('This opens NORMAL Chrome, not Playwright. Google sign-in is therefore not automated.');
console.log('1. Click "Sign in with Google" on the Raahi page.');
console.log(`2. Use the Google account intended for ${persona}.`);
console.log('3. When Raahi finishes signing in, close this Chrome window completely.');
console.log('The saved Raahi/Supabase session will then be reused by Playwright without visiting Google.\n');

const child = spawn(chrome, [
  `--user-data-dir=${dir}`,
  '--no-first-run',
  '--no-default-browser-check',
  `${baseUrl}/admin-login`,
], { stdio: 'inherit' });

child.on('exit', (code) => {
  console.log(code === 0 ? `Saved session profile for ${persona}.` : `Chrome exited with code ${code}.`);
});
