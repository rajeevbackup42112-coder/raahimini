import AppLogo from './AppLogo';

export default function BrandLockup({size=34}:{size?:number}){
  return <span className="inline-flex items-center gap-2.5">
    <AppLogo size={size}/>
    <span className="leading-none"><span className="block text-lg font-extrabold tracking-tight text-primary">Raahi</span><span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Carpool</span></span>
  </span>;
}
