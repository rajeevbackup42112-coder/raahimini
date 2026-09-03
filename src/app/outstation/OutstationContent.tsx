'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CarFront, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { acceptOutstationQuote, cancelOutstationRequest, createOutstationRequest, getDriverCarPhotoUrls, getMyOutstationQuotes, getMyOutstationRequests, getOutstationServiceAreas, type OutstationArea, type OutstationQuote, type OutstationRequest } from '@/lib/outstationApi';
import { useLegalAcceptanceGate } from '@/components/legal/LegalAcceptanceGate';
import { useRegulatoryLaunchGate } from '@/components/launch/RegulatoryLaunchGate';

function localInput(date:Date){const p=(n:number)=>String(n).padStart(2,'0');return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;}

export default function OutstationContent(){
  const router=useRouter();
  const {user,profile,loading:authLoading}=useAuth();
  const {guard:guardLegal,dialog:legalDialog}=useLegalAcceptanceGate('passenger');
  const {guard:guardLaunch,dialog:launchDialog}=useRegulatoryLaunchGate();
  const [areas,setAreas]=useState<OutstationArea[]>([]); const [requests,setRequests]=useState<OutstationRequest[]>([]); const [quotes,setQuotes]=useState<Record<string,OutstationQuote[]>>({});
  const [originArea,setOriginArea]=useState(''); const [pickupText,setPickupText]=useState(''); const [destination,setDestination]=useState('');
  const [departure,setDeparture]=useState(localInput(new Date(Date.now()+2*60*60*1000))); const [returnAt,setReturnAt]=useState(localInput(new Date(Date.now()+26*60*60*1000)));
  const [passengerCount,setPassengerCount]=useState(1); const [notes,setNotes]=useState(''); const [busy,setBusy]=useState(false); const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [a,r]=await Promise.all([getOutstationServiceAreas(),user&&profile?.role==='passenger'?getMyOutstationRequests():Promise.resolve([])]);
      setAreas(a);setRequests(r);
      const params=typeof window==='undefined'?null:new URLSearchParams(window.location.search);
      const requestedArea=params?.get('origin_area_id')||'';
      const validRequested=a.some(x=>x.area_id===requestedArea)?requestedArea:'';
      setOriginArea(current=>current||validRequested||a[0]?.area_id||'');
      if(params?.get('destination'))setDestination(current=>current||params.get('destination')||'');
    }catch(e:any){toast.error(e.message||'Could not load Outstation');}finally{setLoading(false);}
  },[profile?.role,user]);
  useEffect(()=>{if(!authLoading)void load();},[authLoading,load]);
  const openCount=useMemo(()=>requests.filter(r=>r.status==='OPEN').length,[requests]);

  const submit=async(e:FormEvent)=>{
    e.preventDefault();
    if(!user){router.push('/login?next=/outstation');return;}
    if(profile?.role!=='passenger')return toast.error('Use a Passenger account to request an Outstation car');
    if(new Date(returnAt)<=new Date(departure))return toast.error('Return must be after departure');
    try{await guardLaunch(async()=>{await guardLegal(async()=>{setBusy(true);try{
      await createOutstationRequest({originAreaId:originArea,pickupText,destination,departureAt:new Date(departure).toISOString(),returnAt:new Date(returnAt).toISOString(),passengerCount,notes});
      toast.success('Round-trip request sent to eligible Raahi Drivers');setDestination('');setPickupText('');setNotes('');await load();
    }finally{setBusy(false);}});});}catch(e:any){toast.error(e.message||'Could not check launch or booking access.');}
  };
  const showQuotes=async(requestId:string)=>{try{const rows=await getMyOutstationQuotes(requestId);setQuotes(q=>({...q,[requestId]:rows}));}catch(e:any){toast.error(e.message);}};
  const accept=async(quote:OutstationQuote)=>{if(!window.confirm(`Choose ${quote.driver_name} for ₹${quote.total_price.toLocaleString('en-IN')} total? Other quotes will close.`))return;try{await guardLaunch(async()=>{await guardLegal(async()=>{setBusy(true);try{await acceptOutstationQuote(quote.quote_id);toast.success('Driver selected. Contact details are now available.');await load();}finally{setBusy(false);}});});}catch(e:any){toast.error(e.message||'Could not check launch or booking access.');}};
  const cancel=async(id:string)=>{if(!window.confirm('Cancel this Outstation request?'))return;setBusy(true);try{await cancelOutstationRequest(id);toast.success('Outstation request cancelled');await load();}catch(e:any){toast.error(e.message);}finally{setBusy(false);}};

  return <><div className="page-shell space-y-5">
    <section className="hero-surface"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">Raahi Outstation</p><h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">Request a round-trip car. Compare verified local Drivers.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">Start from an active Raahi area, enter any destination and your return time. Eligible local Drivers can quote the complete round trip; you choose only when you are comfortable.</p></section>
    <section className="rounded-2xl border border-green-200 bg-green-50 p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-green-700" size={19}/><div><p className="text-sm font-extrabold text-green-900">Only launch-cleared Drivers can receive and quote these requests</p><p className="mt-1 text-xs leading-relaxed text-green-800">Raahi verifies Driver identity, vehicle details and required operating documents. Sensitive scans stay private; you see verification status, vehicle details and approved car photos before choosing.</p></div></div></section>

    <form onSubmit={submit} className="feature-card space-y-4 p-4 sm:p-5">
      <div><p className="section-label">Plan your journey</p><h2 className="mt-1 text-lg font-extrabold">Where are you going and when will you return?</h2></div>
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900"><strong>Outstation is round trip at launch.</strong> For regular one-way travel between two towns, Raahi uses published Shared Ride corridors so passengers can pool seats and Drivers can rotate fairly.</div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Origin area<select required value={originArea} onChange={e=>setOriginArea(e.target.value)} className="input-field mt-1"><option value="">Choose area</option>{areas.map(a=><option key={a.area_id} value={a.area_id}>{a.area_name}</option>)}</select></label><label className="text-xs font-bold">Exact pickup<input required maxLength={180} value={pickupText} onChange={e=>setPickupText(e.target.value)} placeholder="Chas, Sector 4, station, home…" className="input-field mt-1"/></label></div>
      <label className="text-xs font-bold">Destination<input required maxLength={160} value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Ranchi, Patna, Kolkata…" className="input-field mt-1"/></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Departure<input required type="datetime-local" value={departure} onChange={e=>setDeparture(e.target.value)} className="input-field mt-1"/></label><label className="text-xs font-bold">Return<input required type="datetime-local" value={returnAt} onChange={e=>setReturnAt(e.target.value)} className="input-field mt-1"/></label></div>
      <label className="text-xs font-bold">Passengers<select value={passengerCount} onChange={e=>setPassengerCount(Number(e.target.value))} className="input-field mt-1">{Array.from({length:8},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      <label className="text-xs font-bold">Notes <span className="font-normal text-muted-foreground">optional</span><textarea rows={3} maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Luggage, pickup details or anything useful for the Driver" className="input-field mt-1 resize-y"/></label>
      <button disabled={busy||!originArea||pickupText.trim().length<2||destination.trim().length<2||!returnAt} className="btn-primary w-full py-3">{busy?<Loader2 size={17} className="animate-spin"/>:<CarFront size={17}/>}Request round-trip prices</button>
      {!user&&<p className="text-center text-xs text-muted-foreground">You can plan first. Raahi asks you to sign in only before sending the request.</p>}
    </form>

    {user&&profile?.role==='passenger'&&<section className="space-y-3"><div className="flex items-end justify-between"><div><p className="section-label">My Outstation</p><h2 className="mt-1 text-lg font-extrabold">Requests & quotes</h2></div><button onClick={load} className="btn-outline px-3 py-2"><RefreshCw size={14}/>Refresh</button></div>{loading&&<div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary"/></div>}{!loading&&requests.length===0&&<div className="feature-card p-6 text-center text-sm text-muted-foreground">No Outstation requests yet.</div>}{requests.map(r=><RequestCard key={r.request_id} request={r} quotes={quotes[r.request_id]} onShowQuotes={()=>showQuotes(r.request_id)} onAccept={accept} onCancel={()=>cancel(r.request_id)} busy={busy}/>)}{openCount>0&&<p className="text-[11px] text-muted-foreground">Open requests are leads only. Nothing is booked until you accept one Driver quote.</p>}</section>}
  </div>{launchDialog}{legalDialog}</>;
}

function RequestCard({request,quotes,onShowQuotes,onAccept,onCancel,busy}:{request:OutstationRequest;quotes?:OutstationQuote[];onShowQuotes:()=>void;onAccept:(q:OutstationQuote)=>void;onCancel:()=>void;busy:boolean}){
  const accepted=request.status==='ACCEPTED';
  return <div className="feature-card p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-primary">{request.origin_name} → {request.destination_text} → {request.origin_name}</p><p className="mt-1 text-sm font-extrabold">{new Date(request.departure_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</p><p className="mt-1 text-xs text-muted-foreground">{request.travel_type==='ROUND_TRIP'?'Round trip':'Legacy one-way request'} · {request.passenger_count} passenger{request.passenger_count===1?'':'s'}</p>{request.return_at&&<p className="mt-1 text-xs text-muted-foreground">Return · {new Date(request.return_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</p>}{request.pickup_text&&<p className="mt-1 text-xs text-muted-foreground">Pickup · {request.pickup_text}</p>}</div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${accepted?'bg-green-50 text-green-700':request.status==='OPEN'?'bg-blue-50 text-blue-700':'bg-muted text-muted-foreground'}`}>{request.status}</span></div>
    {accepted&&<div className="mt-3 rounded-2xl border border-green-200 bg-green-50 p-3"><p className="text-sm font-extrabold text-green-900">₹{request.accepted_price?.toLocaleString('en-IN')} · {request.accepted_driver_name}</p><p className="mt-1 text-xs text-green-800">{request.accepted_vehicle_model||'Vehicle'} · {request.accepted_vehicle_number}</p>{request.accepted_driver_phone&&<a href={`tel:${request.accepted_driver_phone}`} className="mt-2 inline-block text-sm font-bold text-green-800 underline">Call Driver · {request.accepted_driver_phone}</a>}</div>}
    {request.status==='OPEN'&&<div className="mt-3 flex gap-2"><button onClick={onShowQuotes} className="btn-primary flex-1">{request.quote_count>0?`View ${request.quote_count} quote${request.quote_count===1?'':'s'}`:'Check quotes'}<ArrowRight size={15}/></button><button disabled={busy} onClick={onCancel} className="btn-outline text-red-600">Cancel</button></div>}
    {quotes&&<div className="mt-4 space-y-3">{quotes.length===0?<div className="rounded-2xl bg-muted p-4 text-center text-xs text-muted-foreground">No Driver quotes yet. Raahi will show them here as eligible Drivers respond.</div>:quotes.map(q=><QuoteCard key={q.quote_id} quote={q} onAccept={()=>onAccept(q)} disabled={busy||request.status!=='OPEN'}/>)}</div>}
  </div>;
}

function QuoteCard({quote,onAccept,disabled}:{quote:OutstationQuote;onAccept:()=>void;disabled:boolean}){
  const [photos,setPhotos]=useState<string[]>([]); useEffect(()=>{if(quote.car_photos_verified)void getDriverCarPhotoUrls(quote.driver_id).then(setPhotos).catch(()=>setPhotos([]));},[quote.driver_id,quote.car_photos_verified]);
  return <div className="rounded-2xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-extrabold">₹{quote.total_price.toLocaleString('en-IN')}</p><p className="text-sm font-bold">{quote.driver_name} · {quote.vehicle_model||quote.vehicle_type||'Car'}</p><p className="mt-1 text-xs text-muted-foreground">{quote.vehicle_number} · up to {quote.vehicle_capacity} passengers</p></div><ShieldCheck size={20} className="text-green-700"/></div>
    <div className="mt-3 flex flex-wrap gap-1.5"><Badge text="Driving Licence verified" ok={quote.driving_licence_verified}/><Badge text="Vehicle RC verified" ok={quote.vehicle_rc_verified}/><Badge text="Car photos verified" ok={quote.car_photos_verified}/></div>
    {photos.length>0&&<div className="mt-3 flex gap-2 overflow-x-auto">{photos.map((src,i)=><img key={src} src={src} alt={`Verified car photo ${i+1}`} className="h-24 w-32 shrink-0 rounded-xl object-cover"/>)}</div>}
    <div className="mt-3 text-xs text-muted-foreground"><p>{quote.includes_tolls?'Tolls included':'Tolls not included'} · {quote.includes_parking?'Parking included':'Parking not included'}</p>{quote.driver_note&&<p className="mt-1 text-foreground">{quote.driver_note}</p>}</div>
    {quote.quote_status==='ACCEPTED'?<div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-800"><CheckCircle2 size={14} className="mr-1 inline"/>Selected Driver{quote.driver_phone?` · ${quote.driver_phone}`:''}</div>:<button disabled={disabled||!quote.fully_verified} onClick={onAccept} className="btn-primary mt-3 w-full">Choose this car</button>}
  </div>;
}
function Badge({text,ok}:{text:string;ok:boolean}){return <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${ok?'bg-green-50 text-green-700':'bg-muted text-muted-foreground'}`}>{ok?'✓':'•'} {text}</span>}
