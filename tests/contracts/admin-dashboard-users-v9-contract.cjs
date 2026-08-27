const fs = require('node:fs');
const migration = fs.readFileSync('supabase/migrations/20260827164000_v2_prod_v9_admin_dashboard_users.sql','utf8');
const dashboard = fs.readFileSync('src/app/admin-panel/components/AdminDashboardOverview.tsx','utf8');
const users = fs.readFileSync('src/app/admin-panel/components/AdminUsersDirectory.tsx','utf8');
const nav = fs.readFileSync('src/app/admin-panel/components/AdminPrimaryNav.tsx','utf8');
const onboarding = fs.readFileSync('src/app/admin-driver-onboarding/page.tsx','utf8');
const must = (ok,msg) => { if(!ok) throw new Error(msg); };

must(migration.includes('admin_get_dashboard_summary'), 'V9 dashboard summary RPC missing');
must(migration.includes('admin_list_registered_users'), 'V9 registered users RPC missing');
must(migration.includes('admin_get_recent_activity'), 'V9 recent activity RPC missing');
must((migration.match(/if not public\.is_admin\(\)/g)||[]).length >= 3, 'every V9 read projection must be admin guarded');
must(migration.includes('join auth.users u on u.id=p.id'), 'registered users must include authoritative auth identity');
must(migration.includes('u.phone_confirmed_at is not null'), 'phone verified state must come from Auth confirmation');
must(migration.includes('revoke all on function public.admin_list_registered_users() from public, anon'), 'registered users RPC must not be public/anon');
must(!/\b(update|insert|delete)\s+public\./i.test(migration), 'V9 Admin projections must remain read-only');

for (const label of ['Dashboard','Users','Routes','Operations']) must(nav.includes(label), `Admin primary nav missing ${label}`);
for (const label of ['Passengers','Drivers','Admins','Unverified','Restricted']) must(users.includes(label), `Users filter missing ${label}`);
must(users.includes('Make Driver'), 'eligible Passenger must expose integrated Driver onboarding');
must(users.includes('/admin-driver-onboarding?profile='), 'Driver onboarding must deep-link the selected user');
must(onboarding.includes("new URLSearchParams(window.location.search).get('profile')"), 'Driver onboarding must honor selected user deep-link');
must(dashboard.includes('What is happening now'), 'Dashboard must answer current operational state first');
must(dashboard.includes('Recent activity'), 'Dashboard recent activity missing');
console.log('Admin Dashboard + Users Version 9 contract: PASS');
