"use client";

import { useState } from "react";

type ApiResult={ok:boolean;message?:string;value?:{deduplicated?:boolean}};
type Props={originLocationId:string;destinationLocationId:string;originName:string;destinationName:string};

export function TravelIntentCard({originLocationId,destinationLocationId,originName,destinationName}:Props){
 const[departure,setDeparture]=useState("");const[seats,setSeats]=useState(1);const[service,setService]=useState("ANY");
 const[notify,setNotify]=useState(false);const[busy,setBusy]=useState(false);const[message,setMessage]=useState<string|null>(null);const[saved,setSaved]=useState(false);
 async function save(){setBusy(true);setMessage(null);try{
  const response=await fetch("/api/travel-intents/create",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({originLocationId,destinationLocationId,desiredDepartureAt:departure?new Date(departure).toISOString():null,desiredWindowEndAt:null,seatCount:seats,acceptableServiceType:service,notificationInterest:notify,idempotencyKey:crypto.randomUUID()})});
  const payload=(await response.json()) as ApiResult;if(!payload.ok){setMessage(payload.message??"Raahi could not save this travel interest.");return;}setSaved(true);setMessage(payload.value?.deduplicated?"Raahi already has this travel interest from you.":"Saved. Raahi can now count this demand as the network grows.");
 }catch{setMessage("The network did not confirm this action. Please try again.");}finally{setBusy(false);}}
 return <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">Help Raahi grow the network</p>
  <h2 className="mt-2 text-xl font-semibold">Can&apos;t find the right ride? Tell Raahi you want to go.</h2>
  <p className="mt-2 text-sm leading-6 text-emerald-950">{originName} → {destinationName}. This records travel interest only. It does not book a ride, hold a seat or create a Driver commitment.</p>
  <div className="mt-5 grid gap-4 sm:grid-cols-2">
   <label className="text-sm font-medium">When, if you know<input type="datetime-local" value={departure} onChange={e=>setDeparture(e.target.value)} className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5"/></label>
   <label className="text-sm font-medium">People<select value={seats} onChange={e=>setSeats(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5">{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
  </div>
  <label className="mt-4 block text-sm font-medium">What would work for you?<select value={service} onChange={e=>setService(e.target.value)} className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5"><option value="ANY">Any suitable Raahi option</option><option value="FIXED_ONE_WAY">Shared one way</option><option value="FIXED_ROUND_TRIP">Shared round trip</option><option value="OUTSTATION">Private car</option><option value="CARPOOL">Carpool</option><option value="RAAHI_TRIP">Raahi Trip</option></select></label>
  <label className="mt-4 flex items-start gap-3 text-sm leading-5 text-emerald-950"><input type="checkbox" checked={notify} onChange={e=>setNotify(e.target.checked)} className="mt-1"/><span>Tell me if Raahi later has something useful for this journey. This preference is separate from operational ride notifications.</span></label>
  <button type="button" disabled={busy||saved} onClick={()=>void save()} className="mt-5 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saved?"Travel interest saved":busy?"Saving…":"Tell Raahi I want to go"}</button>
  <a href="/interests" className="ml-3 inline-flex text-sm font-semibold text-emerald-950 underline underline-offset-4">Your travel interests</a>
  {message?<p className="mt-3 text-sm text-emerald-950" role="status">{message}</p>:null}
 </section>;
}
