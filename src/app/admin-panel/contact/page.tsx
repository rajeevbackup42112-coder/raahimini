'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, MessageSquareText, RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import AdminPrimaryNav from '../components/AdminPrimaryNav';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type ContactMessage = {
  message_id:string;
  category:string;
  sender_name:string;
  contact_value:string;
  message:string;
  user_id:string|null;
  created_at:string;
};

const labels:Record<string,string>={
  SUGGESTION:'Suggestion',PROMOTION:'Business promotion',DRIVER_PARTNER:'Driver / partner enquiry',GENERAL_HELP:'General help',OTHER:'Other',
};

export default function AdminContactPage(){
  const {profile,loading:authLoading}=useAuth();
  const [items,setItems]=useState<ContactMessage[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(profile?.role!=='admin') return;
    setLoading(true);
    const {data,error}=await createClient().rpc('admin_list_open_contact_messages');
    if(error) toast.error(error.message); else setItems((data||[]) as ContactMessage[]);
    setLoading(false);
  },[profile?.role]);

  useEffect(()=>{void load();},[load]);

  const resolve=async(id:string)=>{
    setBusy(id);
    const {data,error}=await createClient().rpc('admin_resolve_contact_message',{p_message_id:id});
    setBusy(null);
    if(error||!data?.success) return toast.error(error?.message||data?.error||'Could not resolve message');
    toast.success('Contact message resolved');
    await load();
  };

  if(authLoading||loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary"/></div>;
  if(profile?.role!=='admin') return <div className="min-h-screen flex items-center justify-center"><ShieldAlert className="mr-2"/>Admin access required.</div>;

  return <div className="min-h-screen bg-background pb-8">
    <AdminPrimaryNav active="operations"/>
    <main className="mx-auto max-w-screen-xl space-y-5 px-4 py-5 sm:px-6">
      <section className="hero-surface p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">General contact</p><h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">Suggestions, promotions & partnerships</h1><p className="mt-2 text-sm text-white/75">Separate from ride-specific support. Review general messages and close them when handled.</p></div>
          <button onClick={load} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white" aria-label="Refresh"><RefreshCw size={16}/></button>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <Link href="/admin-panel/operations" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><ArrowLeft size={14}/>Back to Operations</Link>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary">{items.length} open</span>
      </div>

      {items.length===0?<div className="feature-card p-8 text-center"><MessageSquareText size={30} className="mx-auto text-muted-foreground opacity-40"/><p className="mt-3 text-sm font-bold">No open general contact messages</p><p className="mt-1 text-xs text-muted-foreground">New suggestions and business enquiries will appear here.</p></div>:<div className="space-y-3">{items.map(item=><article key={item.message_id} className="feature-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-primary">{labels[item.category]||item.category}</span><span className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span></div><h2 className="mt-3 text-base font-extrabold">{item.sender_name}</h2><p className="mt-1 break-all text-xs font-semibold text-primary">{item.contact_value}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{item.message}</p></div>
          <button onClick={()=>resolve(item.message_id)} disabled={busy===item.message_id} className="btn-outline shrink-0 text-green-700">{busy===item.message_id?<Loader2 size={14} className="animate-spin"/>:<CheckCircle2 size={14}/>} {busy===item.message_id?'Working…':'Resolve'}</button>
        </div>
      </article>)}</div>}
    </main>
  </div>;
}
