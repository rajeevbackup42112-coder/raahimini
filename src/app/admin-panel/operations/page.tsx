'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Loader2, ShieldAlert, Trash2, ArrowUp, ArrowDown, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { adminGetDrivers, adminGetRoutes, getDriverQueueStatus } from '@/lib/raahiApi';

export default function AdminOperationsPage(){
  const { profile, loading: authLoading } = useAuth();
  const [drivers,setDrivers]=useState<any[]>([]);
  const [routes,setRoutes]=useState<any[]>([]);
  const [routeId,setRouteId]=useState<string>('');
  const [queue,setQueue]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const supabase=createClient();

  const loadBase=useCallback(async()=>{
    const [d,r]=await Promise.all([adminGetDrivers(),adminGetRoutes()]);
    setDrivers(d); setRoutes(r);
    if(!routeId && r[0]?.id) setRouteId(r[0].id);
    setLoading(false);
  },[routeId]);

  const loadQueue=useCallback(async()=>{
    if(!routeId) return setQueue([]);
    setQueue(await getDriverQueueStatus(routeId));
  },[routeId]);

  useEffect(()=>{ if(profile?.role==='admin') loadBase(); },[profile?.role,loadBase]);
  useEffect(()=>{ if(profile?.role==='admin') loadQueue(); },[profile?.role,loadQueue]);

  const deactivate=async(driver:any)=>{
    if(!window.confirm(`Deactivate ${driver.display_name}? This is blocked automatically if the driver has a live trip.`)) return;
    setBusy(`driver-${driver.id}`);
    const {data,error}=await supabase.rpc('admin_deactivate_driver',{p_driver_id:driver.id});
    setBusy(null);
    if(error || !data?.success) return toast.error(error?.message || data?.error || 'Could not deactivate driver');
    toast.success('Driver deactivated');
    loadBase();
  };

  const reorder=async(entry:any,newPosition:number)=>{
    setBusy(`queue-${entry.queue_id}`);
    const {data,error}=await supabase.rpc('admin_reorder_queue',{p_queue_id:entry.queue_id,p_new_position:newPosition});
    setBusy(null);
    if(error || !data?.success) return toast.error(error?.message || data?.error || 'Could not reorder queue');
    await loadQueue();
  };

  const remove=async(entry:any)=>{
    if(!window.confirm(`Remove ${entry.driver_name} from the waiting queue?`)) return;
    setBusy(`queue-${entry.queue_id}`);
    const {data,error}=await supabase.rpc('admin_remove_from_queue',{p_queue_id:entry.queue_id});
    setBusy(null);
    if(error || !data?.success) return toast.error(error?.message || data?.error || 'Could not remove driver');
    toast.success('Driver removed from queue');
    await loadQueue();
  };

  if(authLoading||loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary"/></div>;
  if(profile?.role!=='admin') return <div className="min-h-screen flex items-center justify-center"><ShieldAlert className="mr-2"/>Admin access required.</div>;

  return <div className="min-h-screen bg-background">
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      <div className="max-w-3xl mx-auto h-14 px-4 flex items-center gap-3">
        <Link href="/admin-panel" className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted"><ChevronLeft size={20}/></Link>
        <div><p className="text-sm font-bold">Safe Operations</p><p className="text-[11px] text-muted-foreground">Audited, invariant-preserving controls only</p></div>
      </div>
    </header>
    <main className="max-w-3xl mx-auto px-4 py-4 space-y-6">
      <section className="space-y-3">
        <div><h2 className="text-base font-bold">Drivers</h2><p className="text-xs text-muted-foreground">Deactivate only when no live trip exists. Raahi blocks unsafe attempts server-side.</p></div>
        {drivers.filter(d=>d.is_active!==false).map(driver=><div key={driver.id} className="card p-4 flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="text-sm font-semibold truncate">{driver.display_name}</p><p className="text-xs text-muted-foreground truncate">{driver.vehicles?.registration_number || 'No vehicle'}</p></div>
          <button disabled={busy===`driver-${driver.id}`} onClick={()=>deactivate(driver)} className="btn-outline text-red-600 shrink-0"><UserX size={15}/>{busy===`driver-${driver.id}`?'Working…':'Deactivate'}</button>
        </div>)}
      </section>

      <section className="space-y-3">
        <div><h2 className="text-base font-bold">Driver Queue</h2><p className="text-xs text-muted-foreground">Only WAITING drivers can be moved or removed. The active collecting driver is never manually reassigned here.</p></div>
        <div className="flex flex-wrap gap-2">{routes.map(r=><button key={r.id} onClick={()=>setRouteId(r.id)} className={`px-3 py-2 rounded-xl text-xs font-semibold border ${routeId===r.id?'border-primary bg-secondary text-primary':'border-border'}`}>{r.code}</button>)}</div>
        {queue.map((entry:any,index:number)=>{
          const waiting=entry.status==='WAITING';
          const minPosition=queue.some((q:any)=>q.status==='ACTIVE_COLLECTING')?2:1;
          const maxPosition=queue.length;
          return <div key={entry.queue_id} className="card p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center font-bold">{entry.queue_position}</div>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{entry.driver_name}</p><p className="text-xs text-muted-foreground">{entry.status==='ACTIVE_COLLECTING'?'Active collecting':'Waiting'}</p></div>
            {waiting&&<div className="flex items-center gap-1">
              <button disabled={busy===`queue-${entry.queue_id}`||entry.queue_position<=minPosition} onClick={()=>reorder(entry,entry.queue_position-1)} className="w-9 h-9 rounded-xl border flex items-center justify-center disabled:opacity-30" aria-label="Move up"><ArrowUp size={15}/></button>
              <button disabled={busy===`queue-${entry.queue_id}`||entry.queue_position>=maxPosition} onClick={()=>reorder(entry,entry.queue_position+1)} className="w-9 h-9 rounded-xl border flex items-center justify-center disabled:opacity-30" aria-label="Move down"><ArrowDown size={15}/></button>
              <button disabled={busy===`queue-${entry.queue_id}`} onClick={()=>remove(entry)} className="w-9 h-9 rounded-xl border text-red-600 flex items-center justify-center" aria-label="Remove from queue"><Trash2 size={15}/></button>
            </div>}
          </div>;
        })}
        {queue.length===0&&<div className="card p-6 text-sm text-muted-foreground text-center">No live queue entries for this route.</div>}
      </section>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Admin does not swap passengers, rewrite seat ownership, or replace the driver on an active trip. Those are physical operational facts and may only change through canonical trip/seat/queue commands.</div>
    </main>
  </div>;
}
