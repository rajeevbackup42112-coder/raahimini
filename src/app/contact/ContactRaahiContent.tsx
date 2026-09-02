'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, Send } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

const reasons = [
  ['SUGGESTION','I have a suggestion'],
  ['PROMOTION','Promote my business'],
  ['DRIVER_PARTNER','Driver / partner enquiry'],
  ['GENERAL_HELP','I need general help'],
  ['OTHER','Something else'],
] as const;

type Reason = (typeof reasons)[number][0];

export default function ContactRaahiContent() {
  const { user, profile } = useAuth();
  const [category,setCategory]=useState<Reason>('SUGGESTION');
  const [name,setName]=useState('');
  const [contact,setContact]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    if(profile?.display_name) setName(current=>current || profile.display_name);
    if(user?.email) setContact(current=>current || user.email || '');
  },[profile?.display_name,user?.email]);

  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    setBusy(true); setError('');
    const {data,error:rpcError}=await createClient().rpc('submit_contact_message',{
      p_category:category,p_sender_name:name,p_contact:contact,p_message:message,
    });
    setBusy(false);
    if(rpcError || !data?.success){
      setError(rpcError?.message || data?.error || 'Could not send your message');
      return;
    }
    setSent(true);
  };

  return <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-screen-xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="Back to Raahi"><ArrowLeft size={19}/></Link>
        <AppLogo size={32}/><span className="text-lg font-extrabold text-primary">Contact Raahi</span>
      </div>
    </header>

    <main className="mx-auto grid max-w-screen-xl gap-5 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="hero-surface p-6 sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">Talk to Raahi</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white">Ideas and local businesses help build Raahi.</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/75">Send a suggestion, ask a question, enquire about driving with Raahi, or tell us about a local business promotion.</p>
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/10 p-5">
          <p className="text-sm font-bold text-white">Raahi has no platform fee for passengers or Drivers at launch.</p>
          <p className="mt-2 text-xs leading-relaxed text-white/70">At launch, Raahi does not charge passengers a platform fee or take a Driver commission. Clearly marked local promotions are one way we plan to support the service.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 card-shadow-md sm:p-7">
        {sent ? <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
          <CheckCircle2 size={42} className="text-green-700"/>
          <h2 className="mt-4 text-2xl font-extrabold">Message received</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">Thank you. Your message is now in the Raahi Admin contact inbox for review.</p>
          <Link href="/" className="btn-primary mt-6">Back to Raahi</Link>
        </div> : <form onSubmit={submit}>
          <p className="section-label">What would you like to discuss?</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {reasons.map(([id,label])=><button key={id} type="button" onClick={()=>setCategory(id)} className={`min-h-12 rounded-2xl border-2 px-3 text-left text-sm font-bold ${category===id?'border-primary bg-secondary text-primary':'border-border'}`}>{label}</button>)}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5"><span className="text-xs font-bold">Your name</span><input className="input-field" required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Name"/></label>
            <label className="space-y-1.5"><span className="text-xs font-bold">Phone, WhatsApp or email</span><input className="input-field" required maxLength={120} value={contact} onChange={e=>setContact(e.target.value)} placeholder="How should Raahi reach you?"/></label>
          </div>
          <label className="mt-4 block space-y-1.5"><span className="text-xs font-bold">Message</span><textarea className="input-field resize-y" rows={6} minLength={5} maxLength={1000} required value={message} onChange={e=>setMessage(e.target.value)} placeholder={category==='PROMOTION'?'Business name, locality and the offer you want to promote.':category==='DRIVER_PARTNER'?'Where do you operate and how would you like to work with Raahi?':'Tell us what you would like Raahi to know.'}/><div className="text-right text-[10px] text-muted-foreground">{message.length}/1000</div></label>
          {error&&<div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
          <button className="btn-primary mt-5 w-full py-3.5" disabled={busy}>{busy?<Loader2 size={18} className="animate-spin"/>:<Send size={18}/>} {busy?'Sending…':'Send to Raahi'}</button>
          <p className="mt-4 text-center text-[11px] text-muted-foreground">For an active ride problem, use the in-ride <strong>Need Help?</strong> option so Raahi receives the trip context.</p>
        </form>}
      </section>
    </main>
  </div>;
}
