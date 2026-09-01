const fs=require('fs');
function read(p){return fs.readFileSync(p,'utf8');}
function expect(s,f,m){if(!s.includes(f))throw new Error(m);}
const logo=read('src/components/ui/AppLogo.tsx');
const lockup=read('src/components/ui/BrandLockup.tsx');
const header=read('src/components/AppHeader.tsx');
const login=read('src/app/login/page.tsx');
const manifest=read('public/manifest.json');
const layout=read('src/app/layout.tsx');
const robots=read('src/app/robots.ts');
expect(logo,'/assets/images/app_logo.png','AppLogo must use the Raahi brand asset');
expect(logo,'aria-label="Raahi"','accessible product brand label missing');
expect(lockup,'Raahi','master brand missing from lockup');
expect(header,'<BrandLockup size={34}/>','header brand lockup missing');
expect(login,'<BrandLockup size={34}/>','login brand lockup missing');
expect(manifest,'"name": "Raahi"','PWA must be branded Raahi');
if(manifest.includes('Raahi Mini'))throw new Error('legacy Raahi Mini PWA name must not remain');
expect(manifest,'/icon-maskable-512.png','PWA maskable launch icon missing');
expect(layout,'Raahi — Shared rides and outstation travel','page metadata brand title missing');
expect(layout,"metadataBase: new URL(siteUrl)",'canonical metadata base must use configured site URL');
expect(layout,"'/og-raahi.png'",'OpenGraph/Twitter share image missing');
expect(layout,'apple-touch-icon.png','Apple launch icon missing');
expect(layout,'NEXT_PUBLIC_PUBLIC_DISCOVERY_ENABLED','pilot discovery flag missing');
expect(robots,'disallow','controlled pilot robots must fail closed');
for(const p of ['public/icon-32.png','public/icon-192.png','public/icon-512.png','public/icon-maskable-512.png','public/apple-touch-icon.png','public/og-raahi.png'])if(!fs.existsSync(p))throw new Error(`launch brand asset missing: ${p}`);
console.log('Raahi branding Demo Ready contract: PASS');