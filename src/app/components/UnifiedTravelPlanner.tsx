'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CarFront, Loader2, MapPin, Route, Search } from 'lucide-react';
import { getActiveLocations, getRoutesForLocation, type Location, type RouteForLocation } from '@/lib/raahiApi';
import { getOutstationServiceAreas, type OutstationArea } from '@/lib/outstationApi';

type OriginOption={key:string;name:string;state:string;locationId?:string;areaId?:string};
type Match={kind:'SHARED';route:RouteForLocation}|{kind:'OUTSTATION';areaId:string;originName:string}|{kind:'NONE'};

export default function UnifiedTravelPlanner(){
  const router=useRouter();
  const [locations,setLocations]=useState<Location[]>([]);
  const [areas,setAreas]=useState<OutstationArea[]>([]);
  const [fromKey,setFromKey]=useState('');
  const [destination,setDestination]=useState('');
  const [routes,setRoutes]=useState<RouteForLocation[]>([]);
  const [loading,setLoading]=useState(true);
  const [resolving,setResolving]=useState(false);
  const [match,setMatch]=useState<Match|null>(null);

  useEffect(()=>{Promise.all([getActiveLocations(),getOutstationServiceAreas()]).then(([l,a])=>{setLocations(l);setAreas(a);}).finally(()=>setLoading(false));},[]);

  const origins=useMemo<OriginOption[]>(()=>{
    const map=new Map<string,OriginOption>();
    for(const loc of locations){const key=loc.name.trim().toLowerCase();map.set(key,{key,name:loc.name,state:loc.state,locationId:loc.id});}
    for(const area of areas){const key=area.area_name.trim().toLowerCase();const current=map.get(key);map.set(key,{key,name:area.area_name,state:area.state,locationId:current?.locationId,areaId:area.area_id});}
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
  },[areas,locations]);
  const origin=origins.find(x=>x.key===fromKey);

  useEffect(()=>{setMatch(null);if(!origin?.locationId){setRoutes([]);return;}let alive=true;setResolving(true);getRoutesForLocation(origin.locationId).then(rows=>{if(alive)setRoutes(rows.filter(r=>r.from_location_name.toLowerCase()===origin.name.toLowerCase()));}).finally(()=>{if(alive)setResolving(false);});return()=>{alive=false;};},[origin?.key,origin?.locationId,origin?.name]);

  const resolve=(e:FormEvent)=>{
    e.preventDefault();setMatch(null);
    if(!origin||destination.trim().length<2)return;
    const desired=destination.trim().toLowerCase();
    const fixed=routes.find(r=>r.to_location_name.trim().toLowerCase()===desired);
    if(fixed){setMatch({kind:'SHARED',route:fixed});return;}
    if(origin.areaId){setMatch({kind:'OUTSTATION',areaId:origin.areaId,originName:origin.name});return;}
    setMatch({kind:'NONE'});
  };

  return <section className="page-shell pb-0 pt-5">
    <div className="feature-card overflow-hidden">
      <div className="bg-gradient-to-br from-primary to-[#164f31] p-5 text-white sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">Plan one journey</p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">From where, to where?</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">Tell Raahi the journey. Raahi will use a published seat-sharing corridor when one matches; otherwise it can offer a round-trip local car request from an active origin area.</p>
      </div>
      <form onSubmit={resolve} className="space-y-3 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold">From<select disabled={loading} required value={fromKey} onChange={e=>setFromKey(e.target.value)} className="input-field mt-1"><option value="">Choose your origin</option>{origins.map(o=><option key={o.key} value={o.key}>{o.name}</option>)}</select></label>
          <label className="text-xs font-bold">To<input required list="raahi-destination-suggestions" value={destination} onChange={e=>{setDestination(e.target.value);setMatch(null);}} placeholder="Dhanbad, Ranchi, Topchanchi…" className="input-field mt-1"/><datalist id="raahi-destination-suggestions">{locations.map(l=><option key={l.id} value={l.name}/>)}</datalist></label>
        </div>
        <button disabled={loading||resolving||!origin||destination.trim().length<2} className="btn-primary w-full py-3">{loading||resolving?<Loader2 size={17} className="animate-spin"/>:<Search size={17}/>}Find my Raahi</button>
      </form>

      {match?.kind==='SHARED'&&<div className="border-t border-border bg-green-50 p-4 sm:p-5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700"><Route size={18}/></div><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wide text-green-700">Published corridor found</p><h2 className="mt-1 text-base font-extrabold text-green-950">{match.route.from_location_name} → {match.route.to_location_name}</h2><p className="mt-1 text-xs text-green-800">₹{match.route.fare_per_seat} per seat · {match.route.has_active_car?`${match.route.available_seats} seats available now`:'Raahi can watch this corridor for a car'}</p></div></div><button onClick={()=>router.push(`/active-car-screen?route_id=${match.route.route_id}`)} className="btn-primary mt-4 w-full">View this ride <ArrowRight size={16}/></button></div>}
      {match?.kind==='OUTSTATION'&&<div className="border-t border-border bg-blue-50 p-4 sm:p-5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><CarFront size={18}/></div><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Local car request available</p><h2 className="mt-1 text-base font-extrabold text-blue-950">{match.originName} → {destination.trim()} → {match.originName}</h2><p className="mt-1 text-xs leading-relaxed text-blue-800">No fixed Shared Ride corridor matches this journey. Raahi can ask launch-cleared Drivers from {match.originName} for complete round-trip prices.</p></div></div><button onClick={()=>router.push(`/outstation?origin_area_id=${encodeURIComponent(match.areaId)}&destination=${encodeURIComponent(destination.trim())}`)} className="btn-primary mt-4 w-full">Plan round trip <ArrowRight size={16}/></button></div>}
      {match?.kind==='NONE'&&<div className="border-t border-border bg-muted p-4 sm:p-5"><div className="flex gap-3"><MapPin size={18} className="mt-0.5 shrink-0 text-muted-foreground"/><div><p className="text-sm font-extrabold">Raahi is not serving this journey yet.</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">We show this honestly rather than inventing availability. Your demand can help Raahi decide which area or corridor to launch next.</p></div></div></div>}
    </div>
    <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"><div><p className="text-xs font-extrabold">Own a car and want local travel leads?</p><p className="mt-1 text-[11px] text-muted-foreground">Drivers join themselves; Raahi Admin verifies before operations unlock.</p></div><Link href="/drive-with-raahi" className="btn-outline shrink-0 px-3 py-2 text-xs">Drive with Raahi</Link></div>
  </section>;
}
