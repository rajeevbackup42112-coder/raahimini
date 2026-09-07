"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TravelIntentView } from "./types";

type ApiResult={ok:boolean;message?:string};
export function TravelIntentActions({intent}:{intent:TravelIntentView}){
 const router=useRouter();const[busy,setBusy]=useState(false);const[message,setMessage]=useState<string|null>(null);
 async function post(path:string,body:Record<string,unknown>){setBusy(true);setMessage(null);try{const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,idempotencyKey:crypto.randomUUID()})});const payload=(await response.json()) as ApiResult;if(!payload.ok){setMessage(payload.message??"Raahi could not confirm this action.");return;}router.refresh();}catch{setMessage("The network did not confirm this action. Please try again.");}finally{setBusy(false);}}
 if(intent.status!=="ACTIVE")return null;
 return <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={busy} onClick={()=>void post("/api/travel-intents/notification",{intentId:intent.intent_id,notificationInterest:!intent.notification_interest})} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold">{intent.notification_interest?"Stop availability updates":"Tell me if something opens"}</button><button type="button" disabled={busy} onClick={()=>void post("/api/travel-intents/cancel",{intentId:intent.intent_id})} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-600">Cancel interest</button>{message?<p className="w-full text-sm text-red-700" role="status">{message}</p>:null}</div>;
}
