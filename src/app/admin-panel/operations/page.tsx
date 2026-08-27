'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowDown, ArrowUp, Car, Gauge, Loader2, MapPin, RefreshCw, ShieldAlert, Trash2, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AdminPrimaryNav from '../components/AdminPrimaryNav';
import AdminSupportInbox from '../components/AdminSupportInbox';
import { adminGetDrivers, adminGetRoutes, getDriverQueueStatus } from '@/lib/raahiApi';
import { adminGetDashboardSummary, adminGetLiveTripOperations, type AdminDashboardSummary, type AdminLiveTripOperation } from '@/lib/adminControlApi';

const actionCopy: Record<string, string> = {
  PICKUP_NOW: 'Resolve passenger pickup here',
  DRIVE_TO_PICKUP: 'Drive to next passenger pickup',
  READY_TO_START: 'Ready for automatic departure',
  WAIT_OR_CLOSE_SEATS: 'Wait for passengers or close empty seats',
  GET_READY: 'Manifest resolved · preparing departure',
  DRIVE_TO_DESTINATION: 'Drive to destination',
  COMPLETE_TRIP: 'At destination · Driver can complete trip',
};

const gpsCopy: Record<string, string> = {
  FRESH: 'Fresh GPS', STALE: 'GPS stale', POOR_ACCURACY: 'GPS accuracy poor', MISSING: 'GPS unavailable',
};

export default function AdminOperationsPage() {
  const { profile, loading: authLoading } = useAuth();
  const [drivers,setDrivers]=useState<any[]>([]);
  const [routes,setRoutes]=useState<any[]>([]);
  const [routeId,setRouteId]=useState('');
  const [queue,setQueue]=useState<any[]>([]);
  const [liveTrips,setLiveTrips]=useState<AdminLiveTripOperation[]>([]);
  const [summary,setSummary]=useState<AdminDashboardSummary | null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);

  const loadBase=useCallback(async()=>{
    if(profile?.role!=='admin') return;
    setLoading(true);
    try {
      const [d,r,t,s]=await Promise.all([adminGetDrivers(),adminGetRoutes(),adminGetLiveTripOperations(),adminGetDashboardSummary()]);
      setDrivers(d); setRoutes(r); setLiveTrips(t); setSummary(s);
      setRouteId(current=>current || r[0]?.id || '');
    } catch(e:any) { toast.error(e.message || 'Could not load live operations'); }
    finally { setLoading(false); }
  },[profile?.role]);

  const loadQueue=useCallback(async()=>{
    if(!routeId) return setQueue([]);
    setQueue(await getDriverQueueStatus(routeId));
  },[routeId]);

  useEffect(()=>{ void loadBase(); },[loadBase]);
  useEffect(()=>{ if(profile?.role==='admin') void loadQueue(); },[profile?.role,loadQueue]);

  const deactivate=async(driver:any)=>{
    if(!window.confirm(`Deactivate ${driver.display_name}? Raahi blocks this if the driver has a live trip.`)) return;
    setBusy(`driver-${driver.id}`);
    const supabase=createClient();
    const {data,error}=await supabase.rpc('admin_deactivate_driver',{p_driver_id:driver.id});
    setBusy(null);
    if(error || !data?.success) return toast.error(error?.message || data?.error || 'Could not deactivate driver');
    toast.success('Driver deactivated'); await loadBase();
  };

  const reorder=async(entry:any,newPosition:number)=>{
    setBusy(`queue-${entry.queue_id}`);
    const supabase=createClient();
    const {data,error}=await supabase.rpc('admin_reorder_queue',{p_queue_id:entry.queue_id,p_new_position:newPosition});
    setBusy(null);
    if(error || !data?.success) return toast.error(error?.message || data?.error || 'Could not reorder queue');
    await loadQueue();
  };

  const remove=async(entry:any)=>{
    if(!window.confirm(`Remove ${entry.driver_name} from the WAITING queue?`)) return;
    setBusy(`queue-${entry.queue_id}`);
    const supabase=createClient();
    const {data,error}=await supabase.rpc('admin_remove_from_queue',{p_queue_id:entry.queue_id});
    setBusy(null);
    if(error || !data?.success) return toast.error(error?.message || data?.error || 'Could not remove driver');
    toast.success('Driver removed from queue'); await loadQueue();
  };

  const gpsWarnings=useMemo(()=>liveTrips.filter(t=>t.gps_state!=='FRESH' && (t.trip_status==='IN_PROGRESS'||t.next_action==='READY_TO_START')), [liveTrips]);
  if(authLoading||loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary"/></div>;
  if(profile?.role!=='admin') return <div className="min-h-screen flex items-center justify-center"><ShieldAlert className="mr-2"/>Admin access required.</div>;

  return <div className="min-h-screen bg-background pb-8">
    <AdminPrimaryNav active="operations" />
    <main className="mx-auto max-w-screen-2xl space-y-6 px-4 py-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="section-label">Operations</p><h1 className="mt-1 text-2xl font-extrabold">Live transport & safe intervention</h1><p className="mt-1 max-w-2xl text-xs text-muted-foreground">See trips, GPS health, queues and support in one place. Controls stay inside existing audited backend commands.</p></div>
        <button onClick={()=>{void loadBase();void loadQueue();}} className="btn-outline px-3 py-2"><RefreshCw size={15}/>Refresh</button>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Live cars" value={liveTrips.length} sub="Collecting + on trip" icon={<Car size={17}/>}/>
        <Metric label="GPS attention" value={gpsWarnings.length} sub="Trips needing location" icon={<MapPin size={17}/>}/>
        <Metric label="Drivers waiting" value={summary?.waiting_drivers ?? 0} sub="FIFO waiting only" icon={<Users size={17}/>}/>
        <Metric label="Open support" value={summary?.open_support_cases ?? 0} sub="Reports to review" icon={<AlertTriangle size={17}/>}/>
      </section>

      {gpsWarnings.length>0&&<section className="feature-card border-amber-200 p-4">
        <div className="flex items-center gap-2"><AlertTriangle size={17} className="text-amber-600"/><h2 className="text-sm font-bold">Needs attention</h2></div>
        <div className="mt-3 space-y-2">{gpsWarnings.map(t=><div key={t.trip_id} className="rounded-xl bg-amber-50 px-3 py-2.5"><p className="text-sm font-bold text-amber-900">{t.route_label} · {t.driver_name}</p><p className="mt-0.5 text-xs text-amber-800">{gpsCopy[t.gps_state] || t.gps_state}{t.gps_age_seconds!=null?` · ${t.gps_age_seconds}s old`:''}</p></div>)}</div>
      </section>}

      <section className="space-y-3">
        <div><p className="section-label">Live trips</p><p className="mt-1 text-xs text-muted-foreground">Same route truth as Driver/Passenger, plus GPS and support context.</p></div>
        {liveTrips.length===0&&<div className="feature-card p-8 text-center text-sm text-muted-foreground">No live trips right now.</div>}
        <div className="grid gap-3 lg:grid-cols-2">{liveTrips.map(t=><div key={t.trip_id} className="feature-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t.route_code}</p><h2 className="mt-1 text-base font-extrabold">{t.route_label}</h2><p className="mt-1 text-xs text-muted-foreground">{t.driver_name} · {t.vehicle_number}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${t.trip_status==='IN_PROGRESS'?'bg-blue-50 text-blue-700':'bg-green-50 text-green-700'}`}>{t.trip_status==='IN_PROGRESS'?'On the way':'Collecting'}</span></div>
          <div className="grid grid-cols-3 gap-2"><Mini label="Seats" value={`${t.confirmed+t.held}/${t.capacity}`}/><Mini label="Available" value={String(t.available)}/><Mini label="Support" value={String(t.open_support_cases)}/></div>
          <div className="rounded-2xl bg-secondary/60 px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">What happens next</p><p className="mt-1 text-sm font-bold text-primary">{actionCopy[t.next_action] || t.next_action}</p>{t.next_stop_name&&<p className="mt-0.5 text-xs text-muted-foreground">{t.next_stop_name}</p>}</div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/60 px-3 py-2.5"><div className="flex items-center gap-2"><Gauge size={15} className={t.gps_state==='FRESH'?'text-green-700':'text-amber-700'}/><div><p className="text-xs font-bold">{gpsCopy[t.gps_state] || t.gps_state}</p><p className="text-[10px] text-muted-foreground">{t.gps_age_seconds!=null?`${t.gps_age_seconds}s old`:'No recent fix'}{t.gps_accuracy_meters!=null?` · ±${Math.round(t.gps_accuracy_meters)}m`:''}</p></div></div><div className="text-right"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current stop</p><p className="text-xs font-bold">{t.current_stop_name || '—'}</p></div></div>
        </div>)}</div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="section-label">Driver queue</p><p className="mt-1 text-xs text-muted-foreground">Only WAITING Drivers can be reordered or removed. Active collector is never reassigned here.</p></div><Link href="/admin-panel/route-settings" className="text-xs font-semibold text-primary">Route controls</Link></div>
        <div className="flex flex-wrap gap-2">{routes.map(r=><button key={r.id} onClick={()=>setRouteId(r.id)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${routeId===r.id?'border-primary bg-secondary text-primary':'border-border'}`}>{r.code}</button>)}</div>
        <div className="space-y-2">{queue.map((entry:any)=>{
          const waiting=entry.status==='WAITING';
          const minPosition=queue.some((q:any)=>q.status==='ACTIVE_COLLECTING')?2:1;
          const maxPosition=queue.length;
          return <div key={entry.queue_id} className="feature-card flex items-center gap-3 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted font-bold">{entry.queue_position}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{entry.driver_name}</p><p className="text-xs text-muted-foreground">{entry.status==='ACTIVE_COLLECTING'?'Active collecting':'Waiting'}</p></div>
            {waiting&&<div className="flex items-center gap-1">
              <button disabled={busy===`queue-${entry.queue_id}`||entry.queue_position<=minPosition} onClick={()=>reorder(entry,entry.queue_position-1)} className="flex h-9 w-9 items-center justify-center rounded-xl border disabled:opacity-30" aria-label="Move up"><ArrowUp size={15}/></button>
              <button disabled={busy===`queue-${entry.queue_id}`||entry.queue_position>=maxPosition} onClick={()=>reorder(entry,entry.queue_position+1)} className="flex h-9 w-9 items-center justify-center rounded-xl border disabled:opacity-30" aria-label="Move down"><ArrowDown size={15}/></button>
              <button disabled={busy===`queue-${entry.queue_id}`} onClick={()=>remove(entry)} className="flex h-9 w-9 items-center justify-center rounded-xl border text-red-600" aria-label="Remove from queue"><Trash2 size={15}/></button>
            </div>}
          </div>;
        })}</div>
        {queue.length===0&&<div className="feature-card p-6 text-center text-sm text-muted-foreground">No live queue entries for this route.</div>}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="section-label">Driver recovery</p><p className="mt-1 text-xs text-muted-foreground">Account deactivation is secondary and server-blocked during a live trip.</p></div><Link href="/admin-panel/users" className="text-xs font-semibold text-primary">Open Users</Link></div>
        <div className="grid gap-2 lg:grid-cols-2">{drivers.filter(d=>d.is_active!==false).map(driver=><div key={driver.id} className="feature-card flex items-center justify-between gap-3 p-4">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{driver.display_name}</p><p className="truncate text-xs text-muted-foreground">{driver.vehicles?.registration_number || 'No vehicle'}</p></div>
          <button disabled={busy===`driver-${driver.id}`} onClick={()=>deactivate(driver)} className="btn-outline shrink-0 text-red-600"><UserX size={15}/>{busy===`driver-${driver.id}`?'Working…':'Deactivate'}</button>
        </div>)}</div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
        <p className="font-bold">Emergency boundary</p>
        <p className="mt-1 leading-relaxed">Admin can inspect live truth and use guarded queue, support, Driver and Route controls. Raahi never offers raw seat reassignment, FIFO bypass, verified-phone editing, fabricated GPS or active-trip Driver replacement.</p>
      </section>
    </main>
    <AdminSupportInbox />
  </div>;
}

function Metric({label,value,sub,icon}:{label:string;value:number;sub:string;icon:React.ReactNode}) {
  return <div className="feature-card p-4"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><span className="text-primary">{icon}</span></div><p className="mt-2 text-2xl font-extrabold">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{sub}</p></div>;
}

function Mini({label,value}:{label:string;value:string}) {
  return <div className="rounded-xl bg-muted/60 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-extrabold">{value}</p></div>;
}
