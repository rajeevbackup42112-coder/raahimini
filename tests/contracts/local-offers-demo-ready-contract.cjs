const fs=require('fs');
function read(p){return fs.readFileSync(p,'utf8');}
function expect(s,f,m){if(!s.includes(f))throw new Error(m);}
const db=read('supabase/migrations/20260830140000_demo_ready_local_promotions.sql');
const api=read('src/lib/localOffersApi.ts');
const card=read('src/components/SponsoredLocalOffer.tsx');
const offers=read('src/app/offers/LocalOffersContent.tsx');
const admin=read('src/app/admin-panel/promotions/AdminLocalPromotions.tsx');
const dashboard=read('src/app/admin-panel/components/AdminDashboardSecondary.tsx');
const home=read('src/app/page.tsx');
expect(db,'create table if not exists public.local_promotions','local promotions table missing');
expect(db,"p.status='ACTIVE' and p.starts_at<=now() and p.ends_at>now()",'public promotion read must enforce active time window');
expect(db,'amount_collected integer','commercial amount field missing');
expect(db,'public.is_admin()','promotion writes/uploads must remain Admin guarded');
expect(db,"grant execute on function public.get_active_local_promotions(integer) to anon,authenticated",'active offers should be publicly readable');
if(/(?:insert into|update|delete from) public\.(driver_queue|trips|seat_requests|trip_seats|trip_live_locations)/i.test(db))throw new Error('promotions must not mutate transport state');
if(/create table[^;]*(?:impression|click_tracking|ad_profile)/i.test(db))throw new Error('behavioral ad tracking table must not be introduced');
expect(api,".rpc('admin_save_local_promotion'",'Admin save must use canonical RPC');
expect(api,".rpc('get_active_local_promotions'",'public offer read RPC missing');
if(/\.from\(['\"]local_promotions['\"]\).*\.(insert|update|delete)/s.test(api+admin))throw new Error('UI must not mutate local_promotions directly');
expect(card,'Sponsored · Local offer','home sponsorship label missing');
expect(offers,'Sponsored · Local promotion','offers page sponsorship label missing');
expect(offers,'does not build advertising profiles or track which offer you open','transparency copy missing');
expect(admin,'Amount collected ₹','Admin amount-collected field missing');
expect(dashboard,"href: '/admin-panel/promotions'",'Admin promotion route link missing');
expect(home,'<SponsoredLocalOffer />','Passenger Home sponsored placement missing');
console.log('Local Offers Demo Ready contract: PASS');
