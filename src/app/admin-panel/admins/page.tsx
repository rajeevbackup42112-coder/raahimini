'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronLeft, Loader2, LockKeyhole, ShieldCheck, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Account = { id:string; display_name:string|null; email:string|null; role:string; is_restricted:boolean };

export default function ManageAdminsPage(){
  const { user, profile, loading: authLoading } = useAuth();
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const supabase=useMemo(()=>createClient(),[]);

  const load=useCallback(async()=>{
    setLoading(true);
    const {data,error}=await supabase.rpc('admin_list_role_accounts');
    if(error) toast.error(error.message); else setAccounts((data||[]) as Account[]);
    setLoading(false);
  },[supabase]);

  useEffect(()=>{ if(profile?.role==='admin') void load(); },[profile?.role,load]);

  const adminCount=accounts.filter(a=>a.role==='admin'&&!a.is_restricted).length;
  const eligibleCount=accounts.filter(a=>a.role==='passenger'&&!a.is_restricted).length;

  const grant=async(id:string)=>{
    const target=accounts.find(a=>a.id===id);
    if(!window.confirm(`Grant Admin access to ${target?.display_name||target?.email||'this account'}? This enables Raahi operational controls.`)) return;
    setBusy(id);
    const {data,error}=await supabase.rpc('admin_grant_admin',{p_user_id:id});
    setBusy(null);
    if(error) return toast.error(error.message);
    if(!data?.success) return toast.error(data?.error||'Could not grant admin access');
    toast.success('Admin access granted'); void load();
  };

  const revoke=async(id:string)=>{
    const target=accounts.find(a=>a.id===id);
    if(!window.confirm(`Remove Admin access from ${target?.display_name||target?.email||'this account'}? They will return to Passenger access.`)) return;
    setBusy(id);
    const {data,error}=await supabase.rpc('admin_revoke_admin',{p_user_id:id});
    setBusy(null);
    if(error) return toast.error(error.message);
    if(!data?.success) return toast.error(data?.error||'Could not revoke admin access');
    toast.success('Admin access removed'); void load();
  };

  if(authLoading||loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary"/></div>;
  if(profile?.role!=='admin') return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Admin access required.</div>;

  return <div className="min-h-screen bg-background pb-8">
    <header className="sticky top-0 z-40 border-b border-border bg-card card-shadow-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link href="/admin-panel" className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted"><ChevronLeft size={20}/></Link>
        <ShieldCheck size={20} className="text-primary"/>
        <div><p className="text-sm font-bold">Manage Admins</p><p className="text-[11px] text-muted-foreground">Existing Raahi accounts only</p></div>
      </div>
    </header>

    <main className="mx-auto max-w-5xl space-y-4 px-4 py-5">
      <section className="overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground card-shadow sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">Trusted operations</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Admin access</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">Grant operational authority only to existing, eligible Raahi accounts. Every role change is server-guarded and audited.</p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="feature-card p-4"><p className="section-label">Active admins</p><p className="mt-2 text-2xl font-extrabold">{adminCount}</p><p className="mt-1 text-[11px] text-muted-foreground">Trusted operators</p></div>
        <div className="feature-card p-4"><p className="section-label">Eligible passengers</p><p className="mt-2 text-2xl font-extrabold">{eligibleCount}</p><p className="mt-1 text-[11px] text-muted-foreground">Can be granted access</p></div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700"/><div><p className="text-sm font-bold text-amber-900">Protected role boundary</p><p className="mt-1 text-xs leading-relaxed text-amber-800">Driver accounts cannot also become admins. You cannot remove your own Admin access, and Raahi will not allow the final active admin to be removed.</p></div></div>
      </section>
      <section>
        <div className="mb-3"><p className="section-label">Access roster</p><p className="mt-1 text-xs text-muted-foreground">Admins and Passenger accounts eligible for delegation.</p></div>
        <div className="grid gap-3 lg:grid-cols-2">
          {accounts.map(a=>{
            const self=a.id===user?.id || Boolean(user?.email&&a.email===user.email);
            return <div key={a.id} className="feature-card p-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.role==='admin'?'bg-primary text-primary-foreground':'bg-secondary text-primary'}`}>{a.role==='admin'?<ShieldCheck size={18}/>:<UserPlus size={18}/>}</div>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold">{a.display_name||a.email||'Raahi user'}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${a.role==='admin'?'bg-green-50 text-green-700':'bg-muted text-muted-foreground'}`}>{a.role}</span>{self&&<span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">You</span>}{a.is_restricted&&<span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">Restricted</span>}</div><p className="mt-1 truncate text-xs text-muted-foreground">{a.email}</p></div>
              </div>
              <div className="mt-4 border-t border-border pt-3">
                {a.role==='admin' ? self ? <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-xs font-semibold text-muted-foreground"><LockKeyhole size={15}/> Current Admin access is self-protected</div> : <button disabled={busy===a.id} onClick={()=>revoke(a.id)} className="btn-outline w-full text-red-600"><UserMinus size={15}/>{busy===a.id?'Working…':'Remove Admin access'}</button> : <button disabled={busy===a.id||a.is_restricted} onClick={()=>grant(a.id)} className="btn-primary w-full"><UserPlus size={15}/>{busy===a.id?'Working…':a.is_restricted?'Restricted account':'Grant Admin access'}</button>}
              </div>
            </div>;
          })}
        </div>
      </section>
    </main>
  </div>;
}
