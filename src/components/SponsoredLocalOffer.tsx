'use client';

import { useEffect,useState } from 'react';
import Link from 'next/link';
import { ArrowRight,MapPin,Store } from 'lucide-react';
import { getActiveLocalPromotions,localPromotionImageUrl,type LocalPromotion } from '@/lib/localOffersApi';

export default function SponsoredLocalOffer(){
  const [offer,setOffer]=useState<LocalPromotion|null>(null);
  useEffect(()=>{let alive=true;getActiveLocalPromotions(1).then(rows=>{if(alive)setOffer(rows[0]||null);}).catch(()=>{});return()=>{alive=false};},[]);
  if(!offer)return null;
  const image=localPromotionImageUrl(offer.image_path);
  return <section className="feature-card overflow-hidden">
    <div className="grid sm:grid-cols-[150px_minmax(0,1fr)]">
      {image?<img src={image} alt={`${offer.business_name} promotion`} className="h-36 w-full object-cover sm:h-full"/>:<div className="flex h-28 items-center justify-center bg-secondary sm:h-full"><Store size={30} className="text-primary"/></div>}
      <div className="p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Sponsored · Local offer</span><Link href="/offers" className="text-xs font-bold text-primary">All offers</Link></div>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-primary">{offer.business_name}</p><h2 className="mt-1 text-base font-extrabold text-foreground sm:text-lg">{offer.headline}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{offer.description}</p>
      <div className="mt-3 flex items-center justify-between gap-3">{offer.locality?<span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground"><MapPin size={13} className="shrink-0"/><span className="truncate">{offer.locality}</span></span>:<span/>}<Link href="/offers" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-primary">View offer <ArrowRight size={13}/></Link></div></div>
    </div>
  </section>;
}
