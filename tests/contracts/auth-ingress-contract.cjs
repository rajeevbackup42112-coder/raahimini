const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const middleware = fs.readFileSync(path.join(root, 'src/middleware.ts'), 'utf8');
const testApi = fs.readFileSync(path.join(root, 'src/app/api/test-auth/route.ts'), 'utf8');

const must = (condition, message) => { if (!condition) throw new Error(message); };

must(middleware.includes('supabase.auth.getUser()'), 'middleware must refresh/validate the normal Supabase session');
must(!middleware.includes('x-sb-token'), 'middleware must not accept custom auth tokens through request headers');
must(!/auth-token[^\n]*request\.headers/i.test(middleware), 'middleware must not synthesize auth cookies from request headers');
must(testApi.includes('supabase.auth.verifyOtp'), 'staging test auth must use the normal Supabase OTP verification path');
must(testApi.includes("process.env.RAAHI_TEST_AUTH_ENABLED !== 'true'"), 'staging test auth must remain explicitly gated');

console.log('Auth ingress contract: PASS');
