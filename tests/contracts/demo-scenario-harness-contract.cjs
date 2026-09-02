const fs=require('fs');
function read(p){return fs.readFileSync(p,'utf8');}
function expect(s,f,m){if(!s.includes(f))throw new Error(m);}
const page=read('src/app/demo/page.tsx');
const demo=read('src/app/demo/DemoExperience.tsx');
const guard=read('src/components/RoleRouteGuard.tsx');
const env=read('.env.example');
expect(page,"robots: { index: false, follow: false",'demo page must remain noindex');
expect(page,"process.env.RAAHI_DEMO_ENABLED !== 'true'",'demo route must fail closed unless explicitly enabled');
expect(env,'RAAHI_DEMO_ENABLED=false','demo must be disabled by default in environment guidance');
expect(demo,'RAAHI DEMO · SIMULATED DATA','demo must carry a permanent simulated-data banner');
expect(demo,'LIVE DATABASE WRITES · 0','demo must state the zero-write isolation contract');
expect(demo,'PUBLIC TRANSACTIONS · OFF','demo must preserve the launch gate message');
for(const persona of ['Rajeev1','Rajeev4','Naresh','Ajit'])expect(demo,persona,`demo persona missing: ${persona}`);
for(const scenario of ['Driver verification','Shared Ride FIFO','Exact-seat race','Bokaro Outstation','Trip lifecycle','Local Offers','Regulatory launch gate'])expect(demo,scenario,`demo scenario missing: ${scenario}`);
expect(guard,"const isDemoPath = (path: string) => path === '/demo'",'role guard must explicitly exempt the synthetic demo route');
expect(guard,'if (isDemoPath(pathname)) return;','authenticated roles must be able to view the demo without redirect');
if(demo.includes('@supabase')||demo.includes('createClient(')||demo.includes('.rpc(')||demo.includes('.from('))throw new Error('demo experience must not directly call Supabase or production RPC/table APIs');
console.log('Raahi scenario demo harness contract: PASS');
