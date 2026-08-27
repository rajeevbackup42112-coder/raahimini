'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, ArrowDown, ArrowUp, Copy, Loader2, Pencil, Plus, RefreshCw, Save, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { adminGetLocations } from '@/lib/raahiApi';
import {
  adminArchiveRoute, adminCreateNewRouteDraft, adminCreateRouteDraft, adminDiscardRouteDraft,
  adminDuplicateRouteAsDraft, adminListRouteVersions, adminPublishRouteDraft, adminReplaceRouteDraftStops,
  adminSetCurrentRouteActive, adminSetCurrentRouteFare, adminUpdateRouteDraft,
  type AdminRouteStop, type AdminRouteVersion,
} from '@/lib/routeManagementApi';

type LocationRow = { id: string; name: string; state?: string };
type Family = { familyId: string; current?: AdminRouteVersion; draft?: AdminRouteVersion; history: AdminRouteVersion[] };

export default function RouteManagementContent() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<AdminRouteVersion[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    if (profile?.role !== 'admin') return;
    setLoading(true);
    try {
      const [routeRows, locationRows] = await Promise.all([adminListRouteVersions(), adminGetLocations()]);
      setRows(routeRows);
      setLocations(locationRows as LocationRow[]);
    } catch (e: any) {
      toast.error(e.message || 'Could not load route management');
    } finally { setLoading(false); }
  }, [profile?.role]);

  useEffect(() => { void load(); }, [load]);

  const families = useMemo<Family[]>(() => {
    const map = new Map<string, Family>();
    rows.forEach((row) => {
      const family = map.get(row.route_family_id) || { familyId: row.route_family_id, history: [] };
      if (row.version_status === 'DRAFT') family.draft = row;
      else if (row.is_current && row.version_status === 'PUBLISHED') family.current = row;
      else family.history.push(row);
      map.set(row.route_family_id, family);
    });
    return [...map.values()].sort((a, b) => (a.current?.code || a.draft?.code || '').localeCompare(b.current?.code || b.draft?.code || ''));
  }, [rows]);

  const editingDraft = rows.find((r) => r.route_id === editingDraftId && r.version_status === 'DRAFT');
  const editingFamily = editingDraft ? families.find((f) => f.familyId === editingDraft.route_family_id) : undefined;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>;

  const run = async (key: string, action: () => Promise<{ success: boolean; error?: string }>, success: string) => {
    setBusy(key);
    const result = await action();
    setBusy(null);
    if (!result.success) { toast.error(result.error || 'Action failed'); return false; }
    toast.success(success);
    await load();
    return true;
  };

  const editCurrent = async (route: AdminRouteVersion) => {
    setBusy(`edit-${route.route_id}`);
    const result = await adminCreateRouteDraft(route.route_id);
    setBusy(null);
    if (!result.success) return toast.error(result.error || 'Could not create route draft');
    await load();
    setEditingDraftId(String(result.draft_id));
  };

  const duplicate = async (route: AdminRouteVersion) => {
    const code = window.prompt(`New route code for the duplicate of ${route.code}:`, `${route.code}-COPY`);
    if (!code?.trim()) return;
    setBusy(`duplicate-${route.route_id}`);
    const result = await adminDuplicateRouteAsDraft(route.route_id, code.trim());
    setBusy(null);
    if (!result.success) return toast.error(result.error || 'Could not duplicate route');
    await load();
    setEditingDraftId(String(result.draft_id));
  };

  return (
    <main className="mx-auto max-w-screen-2xl px-4 py-5 space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="section-label">Route management</p><h1 className="mt-1 text-xl font-extrabold">Published routes and safe drafts</h1>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">Structural changes are prepared as a new version. Publish is blocked while that route has a live trip, queue, or active passenger demand.</p></div>
        <div className="flex gap-2"><button onClick={load} className="btn-outline"><RefreshCw size={15}/>Refresh</button><button onClick={() => setShowNew((v) => !v)} className="btn-primary"><Plus size={15}/>New Route</button></div>
      </section>
      {showNew && <NewRouteForm locations={locations} busy={busy === 'new-route'} onCancel={() => setShowNew(false)} onCreate={async (input) => {
        setBusy('new-route');
        const result = await adminCreateNewRouteDraft(input);
        setBusy(null);
        if (!result.success) return toast.error(result.error || 'Could not create route draft');
        setShowNew(false); await load(); setEditingDraftId(String(result.draft_id));
      }} />}

      {editingDraft && <DraftEditor key={editingDraft.route_id} draft={editingDraft} current={editingFamily?.current} locations={locations}
        busy={busy} onClose={() => setEditingDraftId(null)} onSaved={load}
        onPublish={async () => {
          const ok = await run(`publish-${editingDraft.route_id}`, () => adminPublishRouteDraft(editingDraft.route_id), `Version ${editingDraft.version_no} published`);
          if (ok) setEditingDraftId(null);
        }}
        onDiscard={async () => {
          if (!window.confirm('Discard this unpublished route draft?')) return;
          const ok = await run(`discard-${editingDraft.route_id}`, () => adminDiscardRouteDraft(editingDraft.route_id), 'Draft discarded');
          if (ok) setEditingDraftId(null);
        }} />}

      <section className="grid gap-4 lg:grid-cols-2">
        {families.filter((f) => f.current || f.draft).map((family) => {
          const route = family.current || family.draft!;
          const current = family.current;
          const blocked = current ? current.live_trip_count + current.live_queue_count + current.active_demand_count > 0 : false;
          return <div key={family.familyId} className="feature-card p-4 space-y-4">
            <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="rounded-lg bg-secondary px-2 py-1 text-xs font-bold text-primary">{route.code}</span>{current && <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${current.is_active ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{current.is_active ? 'Active' : 'Paused'}</span>}</div>
              <h2 className="mt-2 text-base font-bold">{route.direction_label}</h2><p className="mt-1 text-xs text-muted-foreground">{route.from_location_name} → {route.to_location_name}</p></div>
              <div className="text-right"><p className="text-xs font-bold">v{current?.version_no || route.version_no}</p><p className="text-[10px] text-muted-foreground">₹{current?.fare_per_seat || route.fare_per_seat}/seat</p></div></div>
            {current && <div className="grid grid-cols-3 gap-2"><MiniMetric label="Live trips" value={current.live_trip_count}/><MiniMetric label="Queue" value={current.live_queue_count}/><MiniMetric label="Demand" value={current.active_demand_count}/></div>}
            {blocked && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"><AlertTriangle size={14} className="mt-0.5 shrink-0"/>You can edit a draft now, but publishing waits until this route is operationally idle.</div>}
            {family.draft && <button onClick={() => setEditingDraftId(family.draft!.route_id)} className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-left"><p className="text-xs font-bold text-blue-800">Draft v{family.draft.version_no} ready to edit</p><p className="mt-1 text-xs text-blue-700">{family.draft.stop_count} stops · ₹{family.draft.fare_per_seat}/seat</p></button>}
            {current && <div className="flex flex-wrap gap-2">
              <button disabled={!!busy || !!family.draft} onClick={() => editCurrent(current)} className="btn-primary px-3 py-2"><Pencil size={14}/>{busy === `edit-${current.route_id}` ? 'Working…' : family.draft ? 'Draft exists' : 'Edit'}</button>
              <button disabled={!!busy} onClick={() => duplicate(current)} className="btn-outline px-3 py-2"><Copy size={14}/>Duplicate</button>
              <button disabled={!!busy} onClick={() => run(`active-${current.route_id}`, () => adminSetCurrentRouteActive(current.route_id, !current.is_active), current.is_active ? 'Route paused' : 'Route enabled')} className="btn-outline px-3 py-2">{current.is_active ? 'Pause' : 'Enable'}</button>
              <button disabled={!!busy} onClick={async () => { const value = window.prompt('Fare per seat for future cars:', String(current.fare_per_seat)); if (!value) return; const fare=Number(value); await run(`fare-${current.route_id}`, () => adminSetCurrentRouteFare(current.route_id,fare), `Fare set to ₹${fare}`); }} className="btn-outline px-3 py-2">Fare</button>
              <button disabled={!!busy} onClick={async () => { if (!window.confirm(`Archive ${current.code}? This permanently removes it from new journeys but preserves history.`)) return; await run(`archive-${current.route_id}`, () => adminArchiveRoute(current.route_id), 'Route archived'); }} className="btn-outline px-3 py-2 text-red-600"><Archive size={14}/>Archive</button>
            </div>}
            {family.history.length > 0 && <p className="text-[11px] text-muted-foreground">{family.history.length} historical version{family.history.length === 1 ? '' : 's'} preserved.</p>}
          </div>;
        })}
      </section>
    </main>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-muted/60 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-lg font-extrabold">{value}</p></div>; }
function NewRouteForm({ locations, busy, onCancel, onCreate }: { locations: LocationRow[]; busy: boolean; onCancel: () => void; onCreate: (input: { code: string; fromLocationId: string; toLocationId: string; directionLabel: string; farePerSeat: number }) => void }) {
  const [code,setCode]=useState(''); const [from,setFrom]=useState(locations[0]?.id || ''); const [to,setTo]=useState(locations[1]?.id || ''); const [label,setLabel]=useState(''); const [fare,setFare]=useState('150');
  return <section className="feature-card border-blue-200 p-4 space-y-4">
    <div><p className="section-label">New route draft</p><p className="mt-1 text-xs text-muted-foreground">Nothing becomes visible to Passenger or Driver until you publish it.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Route code" value={code} onChange={setCode}/><Field label="Direction label" value={label} onChange={setLabel}/>
      <LocationSelect label="From" value={from} onChange={setFrom} locations={locations}/><LocationSelect label="To" value={to} onChange={setTo} locations={locations}/>
      <Field label="Fare per seat" value={fare} onChange={setFare} inputMode="numeric"/>
    </div>
    <div className="flex gap-2"><button onClick={onCancel} className="btn-outline flex-1">Cancel</button><button disabled={busy || !code || !from || !to || !label} onClick={() => onCreate({code,fromLocationId:from,toLocationId:to,directionLabel:label,farePerSeat:Number(fare)})} className="btn-primary flex-1">{busy?<Loader2 size={15} className="animate-spin"/>:<Plus size={15}/>}Create Draft</button></div>
  </section>;
}

function DraftEditor({ draft,current,locations,busy,onClose,onSaved,onPublish,onDiscard }: { draft: AdminRouteVersion; current?: AdminRouteVersion; locations: LocationRow[]; busy: string | null; onClose:()=>void; onSaved:()=>Promise<void>; onPublish:()=>void; onDiscard:()=>void }) {
  const [code,setCode]=useState(draft.code); const [from,setFrom]=useState(draft.from_location_id); const [to,setTo]=useState(draft.to_location_id);
  const [label,setLabel]=useState(draft.direction_label); const [fare,setFare]=useState(String(draft.fare_per_seat));
  const [stops,setStops]=useState<AdminRouteStop[]>(draft.stops.map((s,i)=>({...s,stop_order:i+1})));
  const blockerCount=(current?.live_trip_count||0)+(current?.live_queue_count||0)+(current?.active_demand_count||0);
  const move=(index:number,delta:number)=>setStops((items)=>{const next=[...items];const target=index+delta;if(target<0||target>=next.length)return next;[next[index],next[target]]=[next[target],next[index]];return next.map((s,i)=>({...s,stop_order:i+1}));});
  const updateStop=(index:number,key:'name'|'minutes_from_prev',value:string)=>setStops((items)=>items.map((s,i)=>i===index?{...s,[key]:key==='minutes_from_prev'?Number(value):value}:s));
  const save=async()=>{
    const fareNumber=Number(fare);
    if(!Number.isInteger(fareNumber)||fareNumber<20||fareNumber>5000) { toast.error('Fare must be a whole number between ₹20 and ₹5000'); return false; }
    if(stops.length<2) { toast.error('A route needs at least two stops'); return false; }
    const meta=await adminUpdateRouteDraft({routeId:draft.route_id,code,fromLocationId:from,toLocationId:to,directionLabel:label,farePerSeat:fareNumber});
    if(!meta.success) { toast.error(meta.error||'Could not save route details'); return false; }
    const stopResult=await adminReplaceRouteDraftStops(draft.route_id,stops);
    if(!stopResult.success) { toast.error(stopResult.error||'Could not save stops'); return false; }
    toast.success('Route draft saved'); await onSaved(); return true;
  };
  return <section className="feature-card border-blue-300 p-4 space-y-4">
    <div className="flex items-start justify-between gap-3"><div><p className="section-label">Editing draft v{draft.version_no}</p><h2 className="mt-1 text-lg font-extrabold">{draft.code}</h2><p className="mt-1 text-xs text-muted-foreground">This draft is invisible to live journeys until Publish succeeds.</p></div><button onClick={onClose} className="btn-outline px-3 py-2">Close</button></div>
    {blockerCount>0&&<div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"><AlertTriangle size={14} className="mt-0.5 shrink-0"/>Publishing is currently blocked: {current?.live_trip_count||0} live trip(s), {current?.live_queue_count||0} queued driver(s), {current?.active_demand_count||0} active demand intent(s).</div>}
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Route code" value={code} onChange={setCode}/><Field label="Direction label" value={label} onChange={setLabel}/><LocationSelect label="From" value={from} onChange={setFrom} locations={locations}/><LocationSelect label="To" value={to} onChange={setTo} locations={locations}/><Field label="Fare per seat" value={fare} onChange={setFare} inputMode="numeric"/></div>
    <div className="space-y-2"><div className="flex items-center justify-between"><div><p className="section-label">Stops</p><p className="mt-1 text-xs text-muted-foreground">Order is the published travel order. Travel minutes are from the previous stop.</p></div><button onClick={()=>setStops((items)=>[...items,{stop_order:items.length+1,name:'New Stop',minutes_from_prev:5}])} className="btn-outline px-3 py-2"><Plus size={14}/>Add Stop</button></div>
      {stops.map((stop,index)=><div key={`${index}-${stop.stop_id||'new'}`} className="grid grid-cols-[auto_1fr_82px_auto] items-center gap-2 rounded-2xl border border-border p-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">{index+1}</span>
        <input value={stop.name} onChange={e=>updateStop(index,'name',e.target.value)} className="min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm" aria-label={`Stop ${index+1} name`}/>
        <input type="number" min={0} max={180} value={index===0?0:stop.minutes_from_prev} disabled={index===0} onChange={e=>updateStop(index,'minutes_from_prev',e.target.value)} className="rounded-xl border border-border bg-background px-2 py-2 text-sm" aria-label={`Stop ${index+1} travel minutes`}/>
        <div className="flex"><button disabled={index===0} onClick={()=>move(index,-1)} className="p-2 text-muted-foreground" aria-label="Move stop up"><ArrowUp size={15}/></button><button disabled={index===stops.length-1} onClick={()=>move(index,1)} className="p-2 text-muted-foreground" aria-label="Move stop down"><ArrowDown size={15}/></button><button disabled={stops.length<=2} onClick={()=>setStops((items)=>items.filter((_,i)=>i!==index).map((s,i)=>({...s,stop_order:i+1})))} className="p-2 text-red-600" aria-label="Remove stop"><Trash2 size={15}/></button></div>
      </div>)}
    </div>
    <div className="flex flex-wrap gap-2"><button disabled={!!busy} onClick={save} className="btn-primary"><Save size={15}/>Save Draft</button><button disabled={!!busy||blockerCount>0} onClick={async()=>{const saved=await save(); if(!saved)return; if(!window.confirm(`Publish ${code} v${draft.version_no}? New journeys will use this exact stop order.`))return; onPublish();}} className="btn-primary"><Send size={15}/>Publish</button><button disabled={!!busy} onClick={onDiscard} className="btn-outline text-red-600"><Trash2 size={15}/>Discard Draft</button></div>
  </section>;
}

function Field({label,value,onChange,inputMode}:{label:string;value:string;onChange:(value:string)=>void;inputMode?:'text'|'numeric'}) { return <label><span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span><input value={value} inputMode={inputMode} onChange={e=>onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"/></label>; }
function LocationSelect({label,value,onChange,locations}:{label:string;value:string;onChange:(value:string)=>void;locations:LocationRow[]}) { return <label><span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span><select value={value} onChange={e=>onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>; }
