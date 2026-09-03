'use client';

import { useEffect,useState } from 'react';
import Link from 'next/link';
import { BellRing, Lightbulb, Loader2, MapPin, MessageCircle, MessageSquareText, Phone, Sparkles, Store } from 'lucide-react';
import { getActiveLocalPromotions,localPromotionImageUrl,type LocalPromotion } from '@/lib/localOffersApi';

export default function LocalOffersContent(){
  const [offers,setOffers]=useState<LocalPromotion[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{getActiveLocalPromotions(20).then(setOffers).finally(()=>setLoading(false));},[]);
  return <div className="page-shell space-y-5">
    <section className="hero-surface"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">Around Raahi</p><h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">Useful things around your journey.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">Local travel information, useful places, community suggestions and—when available—clearly marked local promotions can live here without interrupting your booking.</p></section>

    <section className="grid gap-3 md:grid-cols-3">
      <CommunityCard icon={<BellRing size={18}/>} title="Local travel updates" detail="Raahi can surface useful town, road or event information here when Admin has a real update worth sharing."/>
      <CommunityCard icon={<Lightbulb size={18}/>} title="Useful around the trip" detail="Think food, sweets, gifts, hotels or services near an origin or destination—not an endless advertising feed."/>
      <CommunityCard icon={<MessageSquareText size={18}/>} title="Help shape Raahi" detail="See something Raahi should know, improve or add in your town? Send it directly to the Raahi team." action={<Link href="/contact" className="mt-3 inline-flex text-xs font-extrabold text-primary hover:underline">Send a suggestion</Link>}/>
    </section>

    <div className="rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Useful first. Sponsored second.</strong> Raahi does not build advertising profiles or track which offer you open. Any paid business promotion below is clearly marked <strong>Sponsored</strong> and is scheduled by Raahi Admin.</div>

    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3"><div><p className="section-label">Local support</p><h2 className="mt-1 text-lg font-extrabold">Sponsored local promotions</h2></div><Link href="/contact" className="text-xs font-bold text-primary hover:underline">Promote a local business</Link></div>
      {loading&&<div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary"/></div>}
      {!loading&&offers.length===0&&<div className="feature-card p-7 text-center"><Sparkles size={28} className="mx-auto text-primary opacity-60"/><p className="mt-3 text-sm font-extrabold">No sponsored promotions right now</p><p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">That is completely fine. Around Raahi remains useful for community information and feedback even when no business is advertising.</p></div>}
      <div className="grid gap-4 md:grid-cols-2">{offers.map(o=><OfferCard key={o.promotion_id} offer={o}/>)}</div>
    </section>
  </div>;
}

function CommunityCard({icon,title,detail,action}:{icon:React.ReactNode;title:string;detail:string;action?:React.ReactNode}){return <article className="feature-card p-4 sm:p-5"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-primary">{icon}</div><h2 className="mt-3 text-sm font-extrabold">{title}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>{action}</article>}

function OfferCard({offer}:{offer:LocalPromotion}){
  const image=localPromotionImageUrl(offer.image_path); const whatsapp=(offer.whatsapp_phone||'').replace(/\D/g,'');
  return <article className="feature-card overflow-hidden">{image&&<img src={image} alt={`${offer.business_name} promotion`} className="h-44 w-full object-cover"/>}<div className="p-4 sm:p-5"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">Sponsored · Local promotion</span><p className="mt-3 text-xs font-bold uppercase tracking-wide text-primary">{offer.business_name}</p><h2 className="mt-1 text-lg font-extrabold">{offer.headline}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{offer.description}</p>{offer.locality&&<p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={13}/>{offer.locality}</p>}<div className="mt-4 flex flex-wrap gap-2">{offer.contact_phone&&<a href={`tel:${offer.contact_phone}`} className="btn-outline px-3 py-2"><Phone size={14}/>Call</a>}{whatsapp&&<a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="btn-outline px-3 py-2"><MessageCircle size={14}/>WhatsApp</a>}</div></div></article>;
}
