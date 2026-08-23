const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
const example = fs.readFileSync(path.join(root, '.env.example'), 'utf8');

const must = (condition, message) => { if (!condition) throw new Error(message); };

must(!fs.existsSync(path.join(root, '.env')), 'A real .env file must not be tracked in the repository');
must(!fs.existsSync(path.join(root, '.env.local')), 'A real .env.local file must not be tracked in the repository');
must(gitignore.split(/\r?\n/).includes('.env'), '.gitignore must ignore .env');
must(gitignore.split(/\r?\n/).includes('.env.local'), '.gitignore must ignore .env.local');
must(gitignore.includes('!.env.example'), '.env.example must remain the explicit safe template');
must(example.includes('NEXT_PUBLIC_SUPABASE_URL='), '.env.example must document the Supabase URL');
must(example.includes('RAAHI_TEST_AUTH_ENABLED=false'), 'test auth must be disabled by default in the environment template');
must(!/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!your-|<|$)[^\s]+/i.test(example), '.env.example must not contain a real service-role value');

console.log('Environment file safety contract: PASS');
