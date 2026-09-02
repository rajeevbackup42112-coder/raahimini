const fs = require('fs');
function read(path){return fs.readFileSync(path,'utf8');}
function expect(source,fragment,message){if(!source.includes(fragment)) throw new Error(message);}

const migration=read('supabase/migrations/20260830114500_demo_ready_contact_raahi.sql');
const contact=read('src/app/contact/ContactRaahiContent.tsx');
const login=read('src/app/login/page.tsx');
const layout=read('src/components/AppLayout.tsx');
const admin=read('src/app/admin-panel/contact/page.tsx');
const support=read('src/app/admin-panel/components/AdminSupportInbox.tsx');

expect(migration,'create table if not exists public.contact_messages','general contact table missing');
expect(migration,"'SUGGESTION','PROMOTION','DRIVER_PARTNER','GENERAL_HELP','OTHER'",'contact categories missing');
expect(migration,'create or replace function public.submit_contact_message','public contact RPC missing');
expect(migration,'grant execute on function public.submit_contact_message(text,text,text,text) to anon, authenticated','contact must work before and after login');
expect(migration,"created_at > now() - interval '10 minutes'",'basic duplicate/rate guard missing');
expect(migration,'create or replace function public.admin_list_open_contact_messages','Admin contact projection missing');
expect(migration,'create or replace function public.admin_resolve_contact_message','Admin contact resolution missing');
expect(migration,'if not public.is_admin()','Admin functions must be server-guarded');

expect(contact,".rpc('submit_contact_message'",'Contact form must use canonical RPC');
expect(contact,'Promote my business','promotion enquiry choice missing');
expect(contact,'Driver / partner enquiry','driver/partner enquiry choice missing');
expect(contact,'no platform fee for passengers or Drivers at launch','launch pricing message missing');
if(/\.from\(['\"]contact_messages['\"]\).*\.(insert|update|delete)/s.test(contact)) throw new Error('Contact UI must not mutate contact_messages directly');

expect(login,'Contact Raahi · Suggest an idea · Promote your business','pre-login contact link missing');
expect(layout,'Contact Raahi · Suggest an idea · Promote your business','authenticated footer contact link missing');
expect(admin,".rpc('admin_list_open_contact_messages'",'Admin inbox must use read RPC');
expect(admin,".rpc('admin_resolve_contact_message'",'Admin inbox must use resolve RPC');
expect(support,'/admin-panel/contact','Operations support area must link general contact inbox');

console.log('Contact Raahi contract: PASS');
