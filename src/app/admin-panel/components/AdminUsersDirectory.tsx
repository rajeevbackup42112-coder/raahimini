'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Car, CheckCircle2, ChevronRight, Loader2, RefreshCw, Search, Shield, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { adminListRegisteredUsers, type RegisteredUser } from '@/lib/adminControlApi';
import { adminRestrictUser, adminUnrestrictUser } from '@/lib/raahiApi';

type Filter = 'all' | 'passenger' | 'driver' | 'admin' | 'unverified' | 'restricted';
const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'passenger', label: 'Passengers' }, { id: 'driver', label: 'Drivers' },
  { id: 'admin', label: 'Admins' }, { id: 'unverified', label: 'Unverified' }, { id: 'restricted', label: 'Restricted' },
];
const stateLabels: Record<string, string> = {
  DRIVING: 'On trip', COLLECTING: 'Collecting', WAITING_QUEUE: 'Waiting in queue', ON_TRIP: 'On trip',
  ABOARD_WAITING: 'Aboard · waiting to depart', WAITING_PICKUP: 'Waiting for pickup', IDLE: 'Idle',
};

export default function AdminUsersDirectory() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [selected, setSelected] = useState<RegisteredUser | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (profile?.role !== 'admin') return;
    setLoading(true); setError('');
    try {
      const rows = await adminListRegisteredUsers();
      setUsers(rows);
      setSelected((current) => current ? rows.find((row) => row.profile_id === current.profile_id) || null : null);
    } catch (e: any) { setError(e.message || 'Could not load registered users'); }
    finally { setLoading(false); }
  }, [profile?.role]);

  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => users.filter((user) => {
    if (filter === 'unverified' && user.phone_verified) return false;
    if (filter === 'restricted' && !user.is_restricted) return false;
    if (['passenger','driver','admin'].includes(filter) && user.role !== filter) return false;
    const text = `${user.display_name || ''} ${user.email || ''} ${user.phone || ''} ${user.registration_number || ''}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }), [users, query, filter]);

  if (profile?.role !== 'admin') return null;

  const toggleRestriction = async () => {
    if (!selected) return;
    const reason = selected.is_restricted ? '' : window.prompt('Reason for restricting this account?', 'Admin restriction');
    if (!selected.is_restricted && !reason) return;
    setBusy(true);
    const result = selected.is_restricted ? await adminUnrestrictUser(selected.profile_id) : await adminRestrictUser(selected.profile_id, reason || 'Admin restriction');
    setBusy(false);
    if (!result.success) return toast.error(result.error || 'Action failed');
    toast.success(selected.is_restricted ? 'User restored' : 'User restricted');
    await load();
  };

  return (
    <main className="mx-auto max-w-screen-2xl px-4 py-5">
      <div className="flex items-start justify-between gap-3"><div><p className="section-label">Users</p><h1 className="mt-1 text-2xl font-extrabold text-foreground">Registered Users</h1><p className="mt-1 text-xs text-muted-foreground">Passengers, Drivers and Admins in one guarded directory.</p></div><button onClick={load} disabled={loading} className="btn-outline px-3 py-2">{loading?<Loader2 size={15} className="animate-spin"/>:<RefreshCw size={15}/>} Refresh</button></div>
      {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 space-y-3">
          <div className="feature-card p-3"><div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-muted-foreground"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search name, email, phone or vehicle" className="w-full rounded-xl border border-border bg-background py-3 pl-9 pr-3 text-sm"/></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{filters.map((item)=><button key={item.id} onClick={()=>setFilter(item.id)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${filter===item.id?'bg-primary text-primary-foreground':'bg-muted text-muted-foreground'}`}>{item.label}</button>)}</div></div>
          {loading && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary"/></div>}
          {!loading && visible.length===0 && <div className="feature-card p-8 text-center text-sm text-muted-foreground">No users match this view.</div>}
          {!loading && visible.map((user)=><button key={user.profile_id} onClick={()=>setSelected(user)} className={`feature-card w-full p-4 text-left transition-colors ${selected?.profile_id===user.profile_id?'border-primary':'hover:bg-muted/40'}`}><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary"><Users size={18} className="text-primary"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-foreground">{user.display_name || user.email || 'Raahi user'}</p><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">{user.role}</span>{user.is_restricted&&<span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">Restricted</span>}</div><p className="mt-1 truncate text-xs text-muted-foreground">{user.email || 'No email'}</p><p className="mt-1 text-[11px] text-muted-foreground">{stateLabels[user.operational_state] || user.operational_state} · {user.phone_verified?'Phone verified':'Phone not verified'}</p></div><ChevronRight size={16} className="mt-1 shrink-0 text-muted-foreground"/></div></button>)}
        </section>

        <aside className="min-w-0 lg:sticky lg:top-32 lg:self-start">
          {!selected ? <div className="feature-card p-6 text-center"><Users size={34} className="mx-auto text-muted-foreground opacity-40"/><p className="mt-3 text-sm font-bold text-foreground">Select a user</p><p className="mt-1 text-xs text-muted-foreground">Open a person to see verified identity, current state and safe Admin actions.</p></div> : <div className="feature-card p-5"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Users size={20} className="text-primary"/></div><div className="min-w-0"><h2 className="truncate text-lg font-extrabold text-foreground">{selected.display_name || 'Raahi user'}</h2><p className="truncate text-xs text-muted-foreground">{selected.email || 'No email'}</p></div></div>
            <div className="mt-4 grid grid-cols-2 gap-2"><Detail label="Role" value={selected.role}/><Detail label="Current state" value={stateLabels[selected.operational_state]||selected.operational_state}/><Detail label="Phone" value={selected.phone||'Not added'} good={selected.phone_verified}/><Detail label="Joined" value={new Date(selected.joined_at).toLocaleDateString()}/></div>
            {selected.is_restricted&&<div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2"><div className="flex gap-2"><AlertTriangle size={15} className="mt-0.5 text-red-600"/><div><p className="text-xs font-bold text-red-800">Restricted account</p><p className="mt-0.5 text-[11px] text-red-700">{selected.restriction_reason||'No reason recorded'}</p></div></div></div>}
            {selected.driver_id&&<div className="mt-4 rounded-xl bg-muted/60 p-3"><p className="section-label">Driver & vehicle</p><p className="mt-2 text-sm font-bold text-foreground">{selected.registration_number||'No vehicle'}{selected.vehicle_model?` · ${selected.vehicle_model}`:''}</p><p className="mt-1 text-xs text-muted-foreground">{selected.vehicle_type||'Vehicle'} · {selected.capacity||'—'} seats · {selected.trips_completed||0} completed trips</p></div>}
            <div className="mt-4 space-y-2">
              {selected.role==='passenger'&&!selected.is_restricted&&<Link href={`/admin-driver-onboarding?profile=${selected.profile_id}`} className="btn-primary w-full"><UserPlus size={16}/> Make Driver</Link>}
              {selected.role==='driver'&&<Link href={`/admin-driver-onboarding?profile=${selected.profile_id}`} className="btn-outline w-full"><Car size={16}/> Driver / vehicle settings</Link>}
              {(selected.role==='passenger'||selected.role==='admin')&&<Link href="/admin-panel/admins" className="btn-outline w-full"><Shield size={16}/> Manage Admin access</Link>}
              <button onClick={toggleRestriction} disabled={busy} className={`w-full ${selected.is_restricted?'btn-outline text-green-700':'btn-outline text-red-600'}`}>{busy?<Loader2 size={16} className="animate-spin"/>:selected.is_restricted?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>} {selected.is_restricted?'Restore account':'Restrict account'}</button>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Sensitive actions remain audited and server-guarded. Raahi does not expose raw seat, FIFO, GPS or phone-verification mutation here.</p>
          </div>}
        </aside>
      </div>
    </main>
  );
}

function Detail({label,value,good}:{label:string;value:string;good?:boolean}){return <div className="rounded-xl bg-muted/60 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-0.5 truncate text-xs font-bold ${good?'text-green-700':'text-foreground'}`}>{value}</p></div>}
