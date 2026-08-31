const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const middleware = fs.readFileSync(path.join(root, 'src/middleware.ts'), 'utf8');
const testApi = fs.readFileSync(path.join(root, 'src/app/api/test-auth/route.ts'), 'utf8');
const authContext = fs.readFileSync(path.join(root, 'src/contexts/AuthContext.tsx'), 'utf8');
const callback = fs.readFileSync(path.join(root, 'src/app/auth/callback/route.ts'), 'utf8');
const login = fs.readFileSync(path.join(root, 'src/app/login/page.tsx'), 'utf8');

const must = (condition, message) => { if (!condition) throw new Error(message); };

must(middleware.includes('supabase.auth.getUser()'), 'middleware must refresh/validate the normal Supabase session');
must(!middleware.includes('x-sb-token'), 'middleware must not accept custom auth tokens through request headers');
must(!/auth-token[^\n]*request\.headers/i.test(middleware), 'middleware must not synthesize auth cookies from request headers');
must(testApi.includes('supabase.auth.verifyOtp'), 'staging test auth must use the normal Supabase OTP verification path');
must(testApi.includes("process.env.RAAHI_TEST_AUTH_ENABLED !== 'true'"), 'staging test auth must remain explicitly gated');
must(authContext.includes("const callbackUrl = `${window.location.origin}/auth/callback`;"), 'Google OAuth must use the exact callback URL without query parameters');
must(authContext.includes('raahi_oauth_next='), 'contextual OAuth return paths must use the short-lived same-site cookie');
must(!authContext.includes('/auth/callback${redirectTo'), 'OAuth callback allow-list must not depend on query-bearing redirect URLs');
must(callback.includes("request.cookies.get('raahi_oauth_next')"), 'OAuth callback must read the stored contextual return path');
must(callback.includes("response.cookies.set('raahi_oauth_next', '', { path: '/', maxAge: 0"), 'OAuth callback must clear the return-path cookie after exchange');
must(login.includes("signInWithGoogle('/login')"), 'generic Google login must return through /login so role routing runs after OAuth');

console.log('Auth ingress contract: PASS');
