'use client';

import { useEffect,useState } from 'react';
import { Loader2,MapPin,MessageCircle,Phone,Store } from 'lucide-react';
import { getActiveLocalPromotions,localPromotionImageUrl,type LocalPromotion } from '@/lib/localOffersApi';

export default function LocalOffersContent(){
  const [offers,setOffers]=useState<LocalPromotion[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{getActiveLocalPromotions(20).then(setOffers).finally(()=>setLoading(false));},[]);
  return <div className="page-shell space-y-5">
    <section className="hero-surface"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">Local Offers</p><h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">Local businesses help support Raahi.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">Raahi has no platform fee for passengers or Drivers at launch. Clearly marked local promotions help support the service.</p></section>
    <div className="rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Sponsored, not personalized.</strong> These offers are scheduled by Raahi Admin. Raahi does not build advertising profiles or track which offer you open.</div>
    {loading&&<div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary"/></div>}
    {!loading&&offers.length===0&&<div className="feature-card p-8 text-center"><Store size={30} className="mx-auto text-muted-foreground opacity-40"/><p className="mt-3 text-sm font-bold">No local offers right now</p><p className="mt-1 text-xs text-muted-foreground">New sponsored offers will appear here when local businesses support Raahi.</p></div>}
    <div className="grid gap-4 md:grid-cols-2">{offers.map(o=><OfferCard key={o.promotion_id} offer={o}/>)}</div>
  </div>;
}

function OfferCard({offer}:{offer:LocalPromotion}){
  const image=localPromotionImageUrl(offer.image_path); const whatsapp=(offer.whatsapp_phone||'').replace(/\D/g,'');
  return <article className="feature-card overflow-hidden">{image&&<img src={image} alt={`${offer.business_name} promotion`} className="h-44 w-full object-cover"/>}<div className="p-4 sm:p-5"><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Sponsored · Local promotion</span><p className="mt-3 text-xs font-bold uppercase tracking-wide text-primary">{offer.business_name}</p><h2 className="mt-1 text-lg font-extrabold">{offer.headline}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{offer.description}</p>{offer.locality&&<p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={13}/>{offer.locality}</p>}<div className="mt-4 flex flex-wrap gap-2">{offer.contact_phone&&<a href={`tel:${offer.contact_phone}`} className="btn-outline px-3 py-2"><Phone size={14}/>Call</a>}{whatsapp&&<a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="btn-outline px-3 py-2"><MessageCircle size={14}/>WhatsApp</a>}</div></div></article>;
}
