'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Loader2, ShieldCheck, UserPlus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Account = { id:string; display_name:string|null; email:string|null; role:string; is_restricted:boolean };

export default function ManageAdminsPage(){
  const { profile, loading: authLoading } = useAuth();
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const supabase=createClient();

  const load=useCallback(async()=>{
    setLoading(true);
    const {data,error}=await supabase.rpc('admin_list_role_accounts');
    if(error) toast.error(error.message); else setAccounts((data||[]) as Account[]);
    setLoading(false);
  },[supabase]);

  useEffect(()=>{ if(profile?.role==='admin') load(); },[profile?.role,load]);

  const grant=async(id:string)=>{
    setBusy(id);
    const {data,error}=await supabase.rpc('admin_grant_admin',{p_user_id:id});
    setBusy(null);
    if(error) return toast.error(error.message);
    if(!data?.success) return toast.error(data?.error||'Could not grant admin access');
    toast.success('Admin access granted');
    load();
  };

  const revoke=async(id:string)=>{
    setBusy(id);
    const {data,error}=await supabase.rpc('admin_revoke_admin',{p_user_id:id});
    setBusy(null);
    if(error) return toast.error(error.message);
    if(!data?.success) return toast.error(data?.error||'Could not revoke admin access');
    toast.success('Admin access removed');
    load();
  };

  if(authLoading||loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary"/></div>;
  if(profile?.role!=='admin') return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Admin access required.</div>;

  return <div className="min-h-screen bg-background">
    <header className="sticky top-0 z-40 bg-card border-b border-border card-shadow">
      <div className="max-w-3xl mx-auto h-14 px-4 flex items-center gap-3">
        <Link href="/admin-panel" className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted"><ChevronLeft size={20}/></Link>
        <ShieldCheck size={20} className="text-primary"/>
        <div><p className="text-sm font-bold">Manage Admins</p><p className="text-[11px] text-muted-foreground">Existing Raahi accounts only</p></div>
      </div>
    </header>
    <main className="max-w-3xl mx-auto px-4 py-4 space-y-3">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Admin access is a trusted operational role. Driver accounts cannot also become admins, you cannot remove your own admin access, and Raahi will not allow the final active admin to be removed.</div>
      {accounts.map(a=><div key={a.id} className="card p-4 flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-sm font-semibold truncate">{a.display_name||a.email||'User'}</p><p className="text-xs text-muted-foreground truncate">{a.email}</p><p className="text-[11px] mt-1 capitalize">{a.role}{a.is_restricted?' · Restricted':''}</p></div>
        {a.role==='admin' ? <button disabled={busy===a.id} onClick={()=>revoke(a.id)} className="btn-outline text-red-600 shrink-0"><UserMinus size={15}/>{busy===a.id?'Working…':'Remove Admin'}</button> : <button disabled={busy===a.id||a.is_restricted} onClick={()=>grant(a.id)} className="btn-primary shrink-0"><UserPlus size={15}/>{busy===a.id?'Working…':'Make Admin'}</button>}
      </div>)}
    </main>
  </div>;
}
