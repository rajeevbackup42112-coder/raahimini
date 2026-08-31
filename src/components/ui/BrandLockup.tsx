import AppLogo from './AppLogo';

export default function BrandLockup({size=34}:{size?:number}){
  return <span className="inline-flex items-center gap-2.5">
    <AppLogo size={size}/>
    <span className="text-lg font-extrabold leading-none tracking-tight text-primary">Raahi</span>
  </span>;
}
