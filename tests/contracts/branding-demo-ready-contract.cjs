const fs=require('fs');
function read(p){return fs.readFileSync(p,'utf8');}
function expect(s,f,m){if(!s.includes(f))throw new Error(m);}
const logo=read('src/components/ui/AppLogo.tsx');
const lockup=read('src/components/ui/BrandLockup.tsx');
const header=read('src/components/AppHeader.tsx');
const login=read('src/app/login/page.tsx');
const manifest=read('public/manifest.json');
const layout=read('src/app/layout.tsx');
expect(logo,'/assets/images/app_logo.png','AppLogo must use the Raahi brand asset');
expect(logo,'aria-label="Raahi Carpool"','accessible product brand label missing');
expect(lockup,'Raahi','master brand missing from lockup');
expect(lockup,'Carpool','Carpool sub-brand missing from lockup');
expect(header,'<BrandLockup size={34}/>','header brand lockup missing');
expect(login,'<BrandLockup size={34}/>','login brand lockup missing');
expect(manifest,'"name": "Raahi Carpool"','PWA must be branded Raahi Carpool');
if(manifest.includes('Raahi Mini'))throw new Error('legacy Raahi Mini PWA name must not remain');
expect(layout,'Raahi Carpool — Shared rides, made clear','page metadata brand title missing');
console.log('Raahi Carpool branding Demo Ready contract: PASS');
