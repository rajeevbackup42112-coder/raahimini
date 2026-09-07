"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ApiResult={ok:boolean;message?:string};
export function MarketOpportunityReviewButton({opportunityId}:{opportunityId:string}){
 const router=useRouter();const[busy,setBusy]=useState(false);const[message,setMessage]=useState<string|null>(null);
 async function review(){setBusy(true);setMessage(null);try{const response=await fetch("/api/admin/market-intelligence/review",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({opportunityId,idempotencyKey:crypto.randomUUID()})});const payload=(await response.json()) as ApiResult;if(!payload.ok){setMessage(payload.message??"Raahi could not start this review.");return;}router.refresh();}catch{setMessage("The network did not confirm this review. Please try again.");}finally{setBusy(false);}}
 return <div><button type="button" disabled={busy} onClick={()=>void review()} className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?"Starting review…":"Review opportunity"}</button>{message?<p className="mt-2 text-sm text-red-700" role="status">{message}</p>:null}</div>;
}
