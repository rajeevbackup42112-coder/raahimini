const fs = require('fs');
const read = (p) => fs.readFileSync(p, 'utf8');
const migration = read('supabase/migrations/20260829162500_demo_ready_admin_role_accounts_type_fix.sql');
const page = read('src/app/admin-panel/admins/page.tsx');
const must = (ok, msg) => { if (!ok) throw new Error(msg); };

must(migration.includes('admin_list_role_accounts'), 'Admin role-account projection repair missing');
must(migration.includes('p.role::text'), 'user_role enum must be cast to declared text result');
must(migration.includes("p.role='admin' and not p.is_restricted"), 'Admin read guard must remain');
must(!migration.includes('admin_grant_admin') && !migration.includes('admin_revoke_admin'), 'read repair must not redefine delegation mutations');
must(!/\b(update|insert|delete)\s+public\./i.test(migration), 'Admin read repair must remain read-only');
must(page.includes("useMemo(()=>createClient(),[])"), 'Admin access Supabase client must be stable across renders');
must(page.includes("rpc('admin_grant_admin'") && page.includes("rpc('admin_revoke_admin'"), 'canonical delegation RPCs must remain');
must(page.includes('Driver accounts cannot also become admins'), 'Driver/Admin role boundary must stay visible');
must(page.includes('final active admin'), 'final-admin safeguard must stay visible');
must(page.includes('Current Admin access is self-protected'), 'self-revocation protection must be visible');
console.log('Admin Role Access Demo Ready contract: PASS');
