const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const page = fs.readFileSync(path.join(root, 'src/app/test-login/page.tsx'), 'utf8');
const form = fs.readFileSync(path.join(root, 'src/app/test-login/TestLoginForm.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/app/api/test-auth/route.ts'), 'utf8');

const must = (condition, message) => { if (!condition) throw new Error(message); };

must(page.includes("process.env.RAAHI_TEST_AUTH_ENABLED !== 'true'"), 'test-login page must be disabled unless staging test auth is explicitly enabled');
must(page.includes('notFound()'), 'disabled test-login page must return not found');

must(api.includes("process.env.RAAHI_TEST_AUTH_ENABLED !== 'true'"), 'test-auth API must require explicit enable flag');
must(api.includes('RAAHI_TEST_AUTH_ALLOWED_HOSTS'), 'test-auth API must require an allowlisted host');
must(api.includes('allowedHosts.size === 0'), 'empty host allowlist must fail closed');
must(api.includes('HARD_BLOCKED_HOSTS'), 'test-auth API must retain hard production-host blocks');
must(api.includes('timingSafeEqual'), 'test-auth key comparison must be timing safe');
must(api.includes('RAAHI_TEST_AUTH_KEY'), 'test-auth API must require a dedicated test key');
must(api.includes('SUPABASE_SERVICE_ROLE_KEY'), 'test-auth admin operation must use server-only service credentials');

must(api.includes("admin.auth.admin.getUserById"), 'admin client may locate only the configured synthetic Auth user');
must(api.includes("admin.auth.admin.generateLink"), 'staging login must use a genuine Supabase magic-link session');
must(api.includes("supabase.auth.verifyOtp"), 'staging login must establish a genuine user session');
must(/supabase\s*\.from\(\s*['"]profiles['"]\s*\)/.test(api), 'trusted role must be checked through the authenticated session');
must(!/admin\s*\.from\(\s*['"]profiles['"]\s*\)/.test(api), 'service-role client must not bypass profile table privileges for persona validation');
must(api.includes('session.user.id !== target.userId'), 'authenticated user id must match the configured persona');
must(api.includes('await supabase.auth.signOut()'), 'persona mismatch must invalidate the staging test session');

must(!form.includes('SUPABASE_SERVICE_ROLE_KEY'), 'client test-login form must never reference the service role key');
must(!/value=\{['"][^'"]+['"]\}/.test(form.match(/name="password"[\s\S]*?\/>/)?.[0] || ''), 'test password must never be prefilled in the client form');

console.log('Test auth safety contract: PASS');
