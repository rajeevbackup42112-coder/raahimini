"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PassengerPaymentCard } from "@/features/payment-support/PassengerPaymentCard";
import { ReportIssue } from "@/features/payment-support/ReportIssue";
import { formatCarpoolDateTime } from "./format";
import type { CarpoolJourneyView } from "./types";

type ApiResult={ok:boolean;message?:string};
export function CarpoolJourneyActions({journey}:{journey:CarpoolJourneyView}){
 const router=useRouter();const[seats,setSeats]=useState(1);const[busy,setBusy]=useState(false);const[message,setMessage]=useState<string|null>(null);
 async function post(path:string,body:Record<string,unknown>){setBusy(true);setMessage(null);try{const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,idempotencyKey:crypto.randomUUID()})});const payload=(await response.json()) as ApiResult;if(!payload.ok)setMessage(payload.message??"Raahi could not confirm this action.");else router.refresh();}catch{setMessage("The network did not confirm this action. Please try again.");}finally{setBusy(false);}}
 const b=journey.my_booking;const change=journey.pending_change;const canBook=!b||b.status!=="ACTIVE";
 return <div className="mt-6 space-y-5">
  {canBook&&journey.status==="PUBLISHED"&&journey.seats_left>0?<section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5"><p className="text-sm font-semibold">Instant seat booking</p><p className="mt-1 text-sm text-zinc-600">No Driver approval step. If the seats are still open, Raahi commits them atomically.</p><div className="mt-4 flex items-end gap-3"><label className="text-sm font-medium">Seats<select value={seats} onChange={e=>setSeats(Number(e.target.value))} className="ml-2 rounded-xl border border-zinc-300 bg-white px-3 py-2">{Array.from({length:Math.min(journey.seats_left,4)},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label><button type="button" disabled={busy} onClick={()=>void post("/api/carpool/book",{journeyId:journey.journey_id,seatCount:seats})} className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Book · ₹{seats*journey.contribution_per_seat_inr}</button></div></section>:null}
  {b?<section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">Your booking · {b.status.replaceAll("_"," ")}</p><p className="mt-2 text-lg font-semibold">{b.seat_count} seat{b.seat_count===1?"":"s"} · ₹{b.total_inr}</p>{journey.driver_phone?<p className="mt-2 text-sm text-zinc-700">Driver contact: {journey.driver_phone}</p>:null}{b.status==="ACTIVE"&&journey.ride_status==="UPCOMING"?<button type="button" disabled={busy} onClick={()=>void post("/api/carpool/cancel-booking",{carpoolBookingId:b.carpool_booking_id})} className="mt-4 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold">Cancel booking</button>:null}</section>:null}
  {change&&b?.status==="ACTIVE"&&change.my_response==="PENDING"?<section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">Driver proposed a material change</p><h2 className="mt-2 text-lg font-semibold">{change.proposed_destination_name} · {formatCarpoolDateTime(change.proposed_departure_at)}</h2><p className="mt-2 text-sm leading-6 text-amber-950">Your original booking is not silently rewritten. Accept the new plan, or reject it and exit this Carpool without a change penalty.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={()=>void post("/api/carpool/change-response",{proposalId:change.proposal_id,accept:true})} className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">Accept change</button><button type="button" disabled={busy} onClick={()=>void post("/api/carpool/change-response",{proposalId:change.proposal_id,accept:false})} className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold">Can’t make it · exit without penalty</button></div></section>:null}
  {b?.payment&&journey.ride_id?<PassengerPaymentCard payment={{...b.payment,ride_id:journey.ride_id,booking_id:b.ride_booking_id,dispute_case_id:b.payment.dispute_case_id??null}}/>:null}
  {journey.ride_id?<ReportIssue objectType="RIDE" objectId={journey.ride_id}/>:null}
  {message?<p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="status">{message}</p>:null}
 </div>;
}
