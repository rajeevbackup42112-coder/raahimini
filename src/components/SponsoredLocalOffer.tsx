'use client';

import { useEffect,useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Lightbulb, MapPin, MessageSquareText, Store } from 'lucide-react';
import { getActiveLocalPromotions,localPromotionImageUrl,type LocalPromotion } from '@/lib/localOffersApi';

export default function SponsoredLocalOffer(){
  const [offer,setOffer]=useState<LocalPromotion|null>(null);
  useEffect(()=>{let alive=true;getActiveLocalPromotions(1).then(rows=>{if(alive)setOffer(rows[0]||null);}).catch(()=>{});return()=>{alive=false};},[]);

  if(!offer)return <section className="feature-card p-4 sm:p-5">
    <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><Lightbulb size={18}/></div><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wide text-primary">Around Raahi</p><h2 className="mt-1 text-base font-extrabold">Local information should be useful, not noisy.</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Raahi can share genuine local travel updates and useful places here when there is something worth showing. No sponsored offer is needed for this space to be helpful.</p></div></div>
    <div className="mt-4 flex flex-wrap gap-2"><Link href="/offers" className="btn-outline px-3 py-2 text-xs"><Store size={14}/>Around Raahi</Link><Link href="/contact" className="btn-outline px-3 py-2 text-xs"><MessageSquareText size={14}/>Suggest something</Link></div>
  </section>;

  const image=localPromotionImageUrl(offer.image_path);
  return <section className="feature-card overflow-hidden">
    <div className="grid sm:grid-cols-[150px_minmax(0,1fr)]">
      {image?<img src={image} alt={`${offer.business_name} promotion`} className="h-36 w-full object-cover sm:h-full"/>:<div className="flex h-28 items-center justify-center bg-secondary sm:h-full"><Store size={30} className="text-primary"/></div>}
      <div className="p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">Sponsored · Local offer</span><Link href="/offers" className="text-xs font-bold text-primary">Around Raahi</Link></div>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-primary">{offer.business_name}</p><h2 className="mt-1 text-base font-extrabold text-foreground sm:text-lg">{offer.headline}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{offer.description}</p>
      <div className="mt-3 flex items-center justify-between gap-3">{offer.locality?<span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground"><MapPin size={13} className="shrink-0"/><span className="truncate">{offer.locality}</span></span>:<span/>}<Link href="/offers" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-primary">See local info <ArrowRight size={13}/></Link></div></div>
    </div>
  </section>;
}
