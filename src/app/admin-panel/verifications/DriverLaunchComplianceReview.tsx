'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, FileText, Loader2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { ComplianceDoc, ComplianceDocType, ComplianceStatus, DriverLaunchCompliance } from '@/lib/driverComplianceApi';

const labels:Record<ComplianceDocType,string>={VEHICLE_PERMIT:'Vehicle / contract carriage permit',VEHICLE_FITNESS:'Fitness certificate',VEHICLE_INSURANCE:'Vehicle insurance',VEHICLE_PUC:'Pollution Under Control (PUC)'};
const types:ComplianceDocType[]=['VEHICLE_PERMIT','VEHICLE_FITNESS','VEHICLE_INSURANCE','VEHICLE_PUC'];
const tone:Record<ComplianceStatus,string>={MISSING:'bg-muted text-muted-foreground',PENDING:'bg-amber-50 text-amber-700',VERIFIED:'bg-green-50 text-green-700',REJECTED:'bg-red-50 text-red-700'};

export default function DriverLaunchComplianceReview({driverId,displayName}:{driverId:string;displayName:string}){
  const [state,setState]=useState<DriverLaunchCompliance|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const load=useCallback(async()=>{setLoading(true);const {data,error}=await createClient().rpc('admin_get_driver_launch_compliance',{p_driver_id:driverId});if(error||!data?.success){toast.error(error?.message||data?.error||'Could not load launch compliance');setState(null);}else setState(data as DriverLaunchCompliance);setLoading(false);},[driverId]);
  useEffect(()=>{void load();},[load]);

  const openDoc=async(doc:ComplianceDoc)=>{setBusy(`open-${doc.document_id}`);const {data,error}=await createClient().storage.from('driver-verification').createSignedUrl(doc.storage_path,120);setBusy(null);if(error||!data?.signedUrl)return toast.error(error?.message||'Could not open private document');window.open(data.signedUrl,'_blank','noopener,noreferrer');};

  const review=async(item:'VEHICLE_CLASSIFICATION'|ComplianceDocType,status:'VERIFIED'|'REJECTED')=>{
    const itemName=item==='VEHICLE_CLASSIFICATION'?'vehicle classification':labels[item];
    const notes=status==='REJECTED'?window.prompt(`Why is ${itemName} rejected?`,'Please correct or upload a current document.')||'':'';
    if(status==='REJECTED'&&!notes)return;
    if(status==='VERIFIED'&&!window.confirm(`Mark ${displayName}'s ${itemName} as verified?`))return;
    setBusy(`review-${item}`);const {data,error}=await createClient().rpc('admin_set_driver_launch_compliance_status',{p_driver_id:driverId,p_item:item,p_status:status,p_notes:notes||null});setBusy(null);
    if(error||!data?.success)return toast.error(error?.message||data?.error||'Review could not be saved');toast.success(`${itemName} ${status==='VERIFIED'?'verified':'rejected'}`);await load();
  };

  if(loading)return <div className="mt-4 flex justify-center py-6"><Loader2 className="animate-spin text-primary"/></div>;
  if(!state)return null;
  return <div className="mt-5 border-t border-border pt-5">
    <div className={`rounded-2xl border p-3 ${state.launch_compliant?'border-green-200 bg-green-50':'border-amber-200 bg-amber-50'}`}><div className="flex items-start gap-2">{state.launch_compliant?<CheckCircle2 size={17} className="mt-0.5 text-green-700"/>:<ShieldAlert size={17} className="mt-0.5 text-amber-700"/>}<div><p className="text-xs font-extrabold">{state.launch_compliant?'Launch compliant':'Not yet launch compliant'}</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Paid Shared Ride FIFO and Outstation quoting stay blocked until every launch-compliance item is verified.</p></div></div></div>

    <section className="mt-4 rounded-2xl border border-border p-3">
      <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-extrabold">Vehicle classification</p><p className="mt-1 text-xs text-muted-foreground">{classificationLabel(state.vehicle_classification)}</p></div><Status status={state.vehicle_classification_status}/></div>
      {state.vehicle_classification_notes&&<p className="mt-2 rounded-xl bg-muted px-3 py-2 text-[10px] text-muted-foreground">Admin note: {state.vehicle_classification_notes}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2"><button disabled={state.vehicle_classification==='UNDECLARED'||busy==='review-VEHICLE_CLASSIFICATION'} onClick={()=>void review('VEHICLE_CLASSIFICATION','VERIFIED')} className="btn-outline justify-center text-green-700"><CheckCircle2 size={14}/>Verify</button><button disabled={state.vehicle_classification==='UNDECLARED'||busy==='review-VEHICLE_CLASSIFICATION'} onClick={()=>void review('VEHICLE_CLASSIFICATION','REJECTED')} className="btn-outline justify-center text-red-600"><XCircle size={14}/>Reject</button></div>
    </section>

    <div className="mt-4 space-y-4">{types.map(type=>{const docs=state.documents.filter(d=>d.document_type===type);const status=statusFor(state,type);return <section key={type} className="rounded-2xl border border-border p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-extrabold">{labels[type]}</p><Status status={status}/></div>{docs.length===0?<p className="mt-3 text-xs text-muted-foreground">Nothing uploaded.</p>:<div className="mt-3 space-y-2">{docs.map(doc=><button key={doc.document_id} onClick={()=>void openDoc(doc)} className="flex w-full items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-left"><FileText size={15} className="text-primary"/><span className="min-w-0 flex-1 truncate text-xs font-semibold">{doc.original_name}</span>{busy===`open-${doc.document_id}`?<Loader2 size={14} className="animate-spin"/>:<ExternalLink size={13}/>}</button>)}</div>}<div className="mt-3 grid grid-cols-2 gap-2"><button disabled={!docs.length||busy===`review-${type}`} onClick={()=>void review(type,'VERIFIED')} className="btn-outline justify-center text-green-700"><CheckCircle2 size={14}/>Verify</button><button disabled={!docs.length||busy===`review-${type}`} onClick={()=>void review(type,'REJECTED')} className="btn-outline justify-center text-red-600"><XCircle size={14}/>Reject</button></div></section>})}</div>
    <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground"><ShieldCheck size={12} className="mr-1 inline"/>These documents are private operational compliance records. Do not expose raw permit, fitness, insurance or PUC files on Passenger trust cards.</p>
  </div>;
}

function classificationLabel(v:string){return v==='COMMERCIAL_PERMITTED'?'Commercial / permitted passenger-service vehicle':v==='PRIVATE_NON_TRANSPORT'?'Private / non-transport vehicle — not launch-enabled':v==='OTHER'?'Other / needs regulatory review':'Not declared by Driver';}
function statusFor(s:DriverLaunchCompliance,type:ComplianceDocType):ComplianceStatus{return type==='VEHICLE_PERMIT'?s.vehicle_permit_status:type==='VEHICLE_FITNESS'?s.vehicle_fitness_status:type==='VEHICLE_INSURANCE'?s.vehicle_insurance_status:s.vehicle_puc_status;}
function Status({status}:{status:ComplianceStatus}){return <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${tone[status]}`}>{status.toLowerCase()}</span>}
