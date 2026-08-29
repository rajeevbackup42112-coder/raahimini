'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Car, CheckCircle2, ChevronRight, Loader2, RefreshCw, Search, Shield, UserPlus, Users, X } from 'lucide-react';
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

  const stats = useMemo(() => ({
    total: users.length,
    drivers: users.filter((user) => user.role === 'driver').length,
    unverified: users.filter((user) => !user.phone_verified).length,
    restricted: users.filter((user) => user.is_restricted).length,
  }), [users]);

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
      <div className="flex items-start justify-between gap-3">
        <div><p className="section-label">Users</p><h1 className="mt-1 text-2xl font-extrabold text-foreground">Registered Users</h1><p className="mt-1 text-xs text-muted-foreground">Identity, verification and operational state in one guarded directory.</p></div>
        <button onClick={load} disabled={loading} className="btn-outline px-3 py-2">{loading?<Loader2 size={15} className="animate-spin"/>:<RefreshCw size={15}/>} Refresh</button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Summary label="Accounts" value={stats.total} />
        <Summary label="Drivers" value={stats.drivers} />
        <Summary label="Unverified" value={stats.unverified} attention={stats.unverified > 0} />
        <Summary label="Restricted" value={stats.restricted} attention={stats.restricted > 0} />
      </div>

      {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-w-0 space-y-3">
          <div className="feature-card p-3">
            <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-muted-foreground"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search name, email, phone or vehicle" className="w-full rounded-xl border border-border bg-background py-3 pl-9 pr-3 text-sm"/></div>
            <div className="mt-3 flex items-center justify-between gap-3"><div className="flex min-w-0 gap-2 overflow-x-auto pb-1">{filters.map((item)=><button key={item.id} onClick={()=>setFilter(item.id)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${filter===item.id?'bg-primary text-primary-foreground':'bg-muted text-muted-foreground'}`}>{item.label}</button>)}</div><span className="hidden shrink-0 text-[11px] font-semibold text-muted-foreground sm:block">{visible.length} shown</span></div>
          </div>
          {loading && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary"/></div>}
          {!loading && visible.length===0 && <div className="feature-card p-8 text-center text-sm text-muted-foreground">No users match this view.</div>}
          {!loading && visible.map((user) => {
            const state = stateLabels[user.operational_state] || user.operational_state;
            const active = state !== 'Idle';
            const selectedNow = selected?.profile_id === user.profile_id;
            return (
              <button key={user.profile_id} onClick={()=>setSelected(user)} className={`w-full rounded-2xl border bg-card p-4 text-left card-shadow-sm transition-all ${selectedNow?'border-primary brand-ring':'border-border hover:border-primary/30'}`}>
                <div className="flex items-start gap-3">
                  <RoleIcon role={user.role} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-extrabold text-foreground">{user.display_name || user.email || 'Raahi user'}</p><RoleBadge role={user.role}/>{user.is_restricted&&<span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">Restricted</span>}</div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{user.email || 'No email'}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${active?'bg-blue-50 text-blue-700':'bg-muted text-muted-foreground'}`}>{state}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${user.phone_verified?'bg-green-50 text-green-700':'bg-amber-50 text-amber-700'}`}>{user.phone_verified?<CheckCircle2 size={11}/>:<AlertTriangle size={11}/>} {user.phone_verified?'Phone verified':'Phone not verified'}</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="mt-1 shrink-0 text-muted-foreground"/>
                </div>
              </button>
            );
          })}
        </section>

        <aside className="hidden min-w-0 lg:sticky lg:top-32 lg:block lg:self-start">
          {!selected ? <DirectoryGuide /> : <UserDetailCard selected={selected} busy={busy} onToggleRestriction={toggleRestriction} />}
        </aside>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-0 lg:hidden" onClick={()=>setSelected(null)}>
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-background p-4 shadow-2xl" onClick={(event)=>event.stopPropagation()}>
            <div className="mb-2 flex justify-end"><button onClick={()=>setSelected(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card" aria-label="Close user details"><X size={17}/></button></div>
            <UserDetailCard selected={selected} busy={busy} onToggleRestriction={toggleRestriction} />
          </div>
        </div>
      )}
    </main>
  );
}
function UserDetailCard({ selected, busy, onToggleRestriction }: { selected: RegisteredUser; busy: boolean; onToggleRestriction: () => void }) {
  return (
    <div className="feature-card p-5">
      <div className="flex items-start gap-3"><RoleIcon role={selected.role}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-extrabold text-foreground">{selected.display_name || 'Raahi user'}</h2><RoleBadge role={selected.role}/></div><p className="mt-1 truncate text-xs text-muted-foreground">{selected.email || 'No email'}</p></div></div>
      <div className="mt-4 flex flex-wrap gap-2"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${selected.phone_verified?'bg-green-50 text-green-700':'bg-amber-50 text-amber-700'}`}>{selected.phone_verified?<CheckCircle2 size={11}/>:<AlertTriangle size={11}/>} {selected.phone_verified?'Phone verified':'Phone not verified'}</span>{selected.is_restricted&&<span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">Restricted</span>}</div>
      <div className="mt-4 grid grid-cols-2 gap-2"><Detail label="Role" value={selected.role}/><Detail label="Current state" value={stateLabels[selected.operational_state]||selected.operational_state}/><Detail label="Phone" value={selected.phone||'Not added'} good={selected.phone_verified}/><Detail label="Joined" value={new Date(selected.joined_at).toLocaleDateString()}/></div>
      {selected.is_restricted&&<div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2"><div className="flex gap-2"><AlertTriangle size={15} className="mt-0.5 text-red-600"/><div><p className="text-xs font-bold text-red-800">Restricted account</p><p className="mt-0.5 text-[11px] text-red-700">{selected.restriction_reason||'No reason recorded'}</p></div></div></div>}
      {selected.driver_id&&<div className="mt-4 rounded-2xl bg-muted/60 p-3"><p className="section-label">Driver & vehicle</p><p className="mt-2 text-sm font-bold text-foreground">{selected.registration_number||'No vehicle'}{selected.vehicle_model?` · ${selected.vehicle_model}`:''}</p><p className="mt-1 text-xs text-muted-foreground">{selected.vehicle_type||'Vehicle'} · {selected.capacity||'—'} seats · {selected.trips_completed||0} completed trips</p></div>}
      <div className="mt-4 space-y-2">
        {selected.role==='passenger'&&!selected.is_restricted&&<Link href={`/admin-driver-onboarding?profile=${selected.profile_id}`} className="btn-primary w-full"><UserPlus size={16}/> Make Driver</Link>}
        {selected.role==='driver'&&<Link href={`/admin-driver-onboarding?profile=${selected.profile_id}`} className="btn-outline w-full"><Car size={16}/> Driver / vehicle settings</Link>}
        {(selected.role==='passenger'||selected.role==='admin')&&<Link href="/admin-panel/admins" className="btn-outline w-full"><Shield size={16}/> Manage Admin access</Link>}
        <button onClick={onToggleRestriction} disabled={busy} className={`w-full ${selected.is_restricted?'btn-outline text-green-700':'btn-outline text-red-600'}`}>{busy?<Loader2 size={16} className="animate-spin"/>:selected.is_restricted?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>} {selected.is_restricted?'Restore account':'Restrict account'}</button>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Sensitive actions remain audited and server-guarded. Raahi does not expose raw seat, FIFO, GPS or phone-verification mutation here.</p>
    </div>
  );
}
function DirectoryGuide() {
  return <div className="feature-card p-6 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary"><Users size={22} className="text-primary"/></div><p className="mt-3 text-sm font-bold text-foreground">Select a user</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Open a person to review identity, trust state and the safe Admin actions available for that account.</p></div>;
}

function RoleIcon({ role }: { role: string }) {
  const icon = role === 'driver' ? <Car size={18}/> : role === 'admin' ? <Shield size={18}/> : <Users size={18}/>;
  return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">{icon}</div>;
}

function RoleBadge({ role }: { role: string }) {
  const tone = role === 'driver' ? 'bg-blue-50 text-blue-700' : role === 'admin' ? 'bg-violet-50 text-violet-700' : 'bg-muted text-muted-foreground';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tone}`}>{role}</span>;
}

function Summary({label,value,attention=false}:{label:string;value:number;attention?:boolean}) {
  return <div className={`rounded-2xl border bg-card px-3 py-3 card-shadow-sm ${attention?'border-amber-200':'border-border'}`}><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-extrabold ${attention?'text-amber-700':'text-foreground'}`}>{value}</p></div>;
}

function Detail({label,value,good}:{label:string;value:string;good?:boolean}){return <div className="rounded-xl bg-muted/60 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-0.5 truncate text-xs font-bold ${good?'text-green-700':'text-foreground'}`}>{value}</p></div>}
