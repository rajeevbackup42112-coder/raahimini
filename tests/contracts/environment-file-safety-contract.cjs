const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
const example = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const envPath = path.join(root, '.env');
const must = (condition, message) => { if (!condition) throw new Error(message); };
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  const allowed = new Set(['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SITE_URL','RAAHI_TEST_AUTH_ENABLED']);
  const keys = env.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => line.split('=', 1)[0]);
  must(keys.every((key) => allowed.has(key)), 'Tracked Rocket .env may contain public bootstrap keys only');
  must(/NEXT_PUBLIC_SITE_URL\s*=\s*https:\/\/ride\.myraahi\.co\.in/i.test(env), 'Go-live candidate must use the new Raahi production hostname');
  must(/RAAHI_TEST_AUTH_ENABLED\s*=\s*false/i.test(env), 'Tracked Rocket .env must keep test auth disabled');
  must(!/SUPABASE_SERVICE_ROLE_KEY|RAAHI_TEST_AUTH_KEY|RAAHI_TEST_PERSONAS_JSON/i.test(env), 'Tracked Rocket .env must not contain server/test-auth secrets');
}
must(!fs.existsSync(path.join(root, '.env.local')), 'A real .env.local file must not be tracked in the repository');
must(gitignore.split(/\r?\n/).includes('.env'), '.gitignore must ignore .env');
must(gitignore.split(/\r?\n/).includes('.env.local'), '.gitignore must ignore .env.local');
must(gitignore.includes('!.env.example'), '.env.example must remain the explicit safe template');
must(example.includes('NEXT_PUBLIC_SUPABASE_URL='), '.env.example must document the Supabase URL');
must(example.includes('NEXT_PUBLIC_SITE_URL='), '.env.example must document the public site URL');
must(example.includes('RAAHI_TEST_AUTH_ENABLED=false'), 'test auth must be disabled by default in the environment template');
must(!/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!your-|<|$)[^\s]+/i.test(example), '.env.example must not contain a real service-role value');
console.log('Environment file safety contract: PASS');