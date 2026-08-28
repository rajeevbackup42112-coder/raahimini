const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

const auth = read('src/contexts/AuthContext.tsx');
const adminGate = read('src/components/AdminRoleGate.tsx');
const adminLayout = read('src/app/admin-panel/layout.tsx');
const users = read('src/app/admin-panel/components/AdminUsersDirectory.tsx');
const migration = read('supabase/migrations/20260828083000_v2_prod_v13_pre_go_live_hardening.sql');

assert(auth.includes('await loadProfile(session.user.id)'), 'Auth loading must wait for profile resolution');
assert(auth.includes("_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION'"), 'Auth must keep protected gates loading through profile resolution');
assert(adminGate.includes('Admin Sign In Required'), 'Anonymous Admin ingress must be gated');
assert(adminGate.includes("profile?.role !== 'admin'"), 'Non-Admin users must be gated from Admin tree');
assert(adminLayout.includes('<AdminRoleGate>{children}</AdminRoleGate>'), 'Entire /admin-panel tree must use AdminRoleGate');
assert(users.includes('grid min-w-0 gap-4'), 'Users grid must allow mobile shrink');
assert(users.includes('<section className="min-w-0 space-y-3">'), 'Users list track must allow mobile shrink');
assert((migration.match(/latest_at>=now\(\)/g) || []).length >= 3, 'Route list/publish/archive must ignore expired demand');
assert(!migration.includes('update public.demand_intents'), 'V13 route hardening must not rewrite demand state');
console.log('Pre-Go-Live Hardening Version 13 contract: PASS');
