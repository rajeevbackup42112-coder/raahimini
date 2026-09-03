const fs=require('fs');
function read(p){return fs.readFileSync(p,'utf8');}
function expect(s,f,m){if(!s.includes(f))throw new Error(m);}
const page=read('src/app/demo/page.tsx');
const demo=read('src/app/demo/DemoExperience.tsx');
const guard=read('src/components/RoleRouteGuard.tsx');
const layout=read('src/app/layout.tsx');
const middleware=read('src/middleware.ts');
const env=read('.env.example');

expect(page,"robots: { index: false, follow: false",'demo page must remain noindex');
expect(page,"process.env.RAAHI_DEMO_ENABLED !== 'true'",'demo route must fail closed unless explicitly enabled');
expect(env,'RAAHI_DEMO_ENABLED=false','demo must be disabled by default in environment guidance');
expect(layout,"const demoSite = process.env.RAAHI_DEMO_ENABLED === 'true'",'root layout must recognize dedicated demo mode');
expect(layout,'demoSite ? children : <AuthProvider>','demo mode must not initialize normal live auth');
expect(middleware,"if (process.env.RAAHI_DEMO_ENABLED === 'true')",'middleware must recognize demo mode before Supabase auth refresh');
expect(middleware,"demoUrl.pathname = '/demo'",'dedicated demo mode must redirect non-demo application routes to /demo');

expect(demo,'RAAHI DEMO · SIMULATED MARKETPLACE','demo must carry a permanent simulated-marketplace banner');
expect(demo,'UI PROTOTYPE · BROWSER ONLY','UI-first phase must be explicit');
expect(demo,'SAFE DEMO · NO LIVE CHANGES','demo must state that it cannot change live data');
expect(demo,'Build a Raahi Area','demo must be one continuous marketplace-building experience');
expect(demo,'One continuous marketplace story','demo must not frame the experience as disconnected scenarios');
expect(demo,'See what changed for everyone','Admin, Driver and Passenger views must share one story state');

for(const phrase of [
  'Start with an empty Raahi Area',
  'Publish the first mobility network',
  'A Driver joins Raahi himself',
  'One-time plain-language acceptance',
  'Driver submits identity, car and origin area',
  'Admin verifies; Admin does not create',
  'Passenger simply enters From and To',
  'A flexible trip becomes Outstation automatically',
  'Passenger chooses with trust, not just price',
  'Useful local information before paid ads',
  'Demand tells Raahi what to launch next',
]) expect(demo,phrase,`continuous demo step missing: ${phrase}`);

expect(demo,'Dhanbad ⇄ Gomoh','fixed Shared Ride corridor must be present');
expect(demo,'Parasnath → Madhuban','second launch Shared Ride corridor must be present');
expect(demo,'Fixed origin + destination. Repeated seat pooling. FIFO Driver rotation.','Shared Ride must stay density-oriented');
expect(demo,'Flexible destination. Round trip only for this launch model. Drivers subscribe by origin area.','Outstation launch model must be origin-area + round-trip only');
expect(demo,'No fixed corridor matches this journey','Passenger search must automatically fall back to Outstation');
expect(demo,'Round trip','Outstation must not expose one-way in this prototype');
expect(demo,'Why you received this','Driver lead screen must explain origin-area eligibility');
expect(demo,'Your Shared Ride preferences do not affect this lead.','Outstation and Shared Ride preferences must remain independent');

expect(demo,'Continue with Google','Driver self-onboarding must start from the public Driver journey');
expect(demo,'Verify mobile by OTP','Driver phone verification must remain part of onboarding');
expect(demo,'I accept & continue','one-time plain-language acceptance must be visible');
for(const doc of ['Driving licence','Vehicle RC','Driver photo','Car · front','Car · rear','Car · interior']) expect(demo,doc,`Driver trust artifact missing: ${doc}`);
expect(demo,'Submit for verification','Driver must submit his own verification package');
expect(demo,'Approve Driver','Admin must review/approve rather than create the Driver');

expect(demo,'DL VERIFIED','Passenger trust card must show DL verification result');
expect(demo,'RC VERIFIED','Passenger trust card must show RC verification result');
expect(demo,'Phone/contact details stay private until you accept.','Outstation privacy boundary must be visible before acceptance');
expect(demo,'Passenger contact unlocked','contact must unlock only after acceptance');

expect(demo,'Around your trip','local information surface must support the travel context');
expect(demo,'Festival traffic note','early local surface should support community information');
expect(demo,'Have a suggestion?','early local surface should support feedback/support');
expect(demo,'clearly marked Sponsored','future paid promotions must remain transparently labeled');
expect(demo,'Corridor opportunity','Admin must be able to see demand-derived corridor opportunities');
expect(demo,'Add origin area → onboard Drivers → serve Outstation → observe demand → promote proven corridors → densify.','expansion loop must be explicit');

expect(guard,"const isDemoPath = (path: string) => path === '/demo'",'role guard must explicitly exempt the synthetic demo route');
expect(guard,'if (isDemoPath(pathname)) return;','authenticated roles must be able to view the demo without redirect');
if(demo.includes('@supabase')||demo.includes('createClient(')||demo.includes('.rpc(')||demo.includes('.from('))throw new Error('UI prototype must not directly call Supabase or production RPC/table APIs');
console.log('Raahi living-area UI demo contract: PASS');
