'use client';

import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileCheck2, FileText, Loader2, ShieldAlert, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { getMyDriverLaunchCompliance, registerDriverComplianceUpload, retireMyDriverComplianceDocument, setMyVehicleClassification, type ComplianceDoc, type ComplianceDocType, type ComplianceStatus, type DriverLaunchCompliance, type VehicleClassification } from '@/lib/driverComplianceApi';

const labels:Record<ComplianceDocType,string>={VEHICLE_PERMIT:'Vehicle / contract carriage permit',VEHICLE_FITNESS:'Fitness certificate',VEHICLE_INSURANCE:'Vehicle insurance',VEHICLE_PUC:'Pollution Under Control (PUC)'};
const statusCopy:Record<ComplianceStatus,string>={MISSING:'Not uploaded',PENDING:'Waiting for review',VERIFIED:'Verified',REJECTED:'Needs attention'};
const statusClass:Record<ComplianceStatus,string>={MISSING:'bg-muted text-muted-foreground',PENDING:'bg-amber-50 text-amber-700',VERIFIED:'bg-green-50 text-green-700',REJECTED:'bg-red-50 text-red-700'};
const complianceTypes:ComplianceDocType[]=['VEHICLE_PERMIT','VEHICLE_FITNESS','VEHICLE_INSURANCE','VEHICLE_PUC'];

export default function DriverLaunchComplianceSection(){
  const {user,profile}=useAuth();
  const [state,setState]=useState<DriverLaunchCompliance|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const load=useCallback(async()=>{if(!user||profile?.role!=='driver')return;setLoading(true);try{setState(await getMyDriverLaunchCompliance());}catch(e:any){toast.error(e.message||'Could not load launch compliance');}finally{setLoading(false);}},[profile?.role,user]);
  useEffect(()=>{void load();},[load]);

  const extension=(file:File)=>{const ext=file.name.includes('.')?file.name.split('.').pop()?.toLowerCase():'';if(ext&&['jpg','jpeg','png','webp','pdf'].includes(ext))return ext;return file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';};

  const saveClassification=async(value:Exclude<VehicleClassification,'UNDECLARED'>)=>{
    setBusy('classification');try{await setMyVehicleClassification(value);toast.success('Vehicle classification saved for Admin review');await load();}catch(e:any){toast.error(e.message);}finally{setBusy(null);}
  };
  const upload=async(type:ComplianceDocType,file:File)=>{
    if(!user)return;if(file.size>8388608)return toast.error('File must be 8 MB or smaller');
    const allowed=['image/jpeg','image/png','image/webp','application/pdf'];if(!allowed.includes(file.type))return toast.error('Use JPG, PNG, WebP or PDF');
    setBusy(`upload-${type}`);const supabase=createClient();const replaced=state?.documents.filter(d=>d.document_type===type)||[];
    const path=`${user.id}/${type.toLowerCase()}/${crypto.randomUUID()}.${extension(file)}`;
    const {error:uploadError}=await supabase.storage.from('driver-verification').upload(path,file,{upsert:false,contentType:file.type});
    if(uploadError){setBusy(null);return toast.error(uploadError.message);}
    try{await registerDriverComplianceUpload({type,path,name:file.name,mime:file.type,size:file.size});
      if(replaced.length){const {error}=await supabase.storage.from('driver-verification').remove(replaced.map(d=>d.storage_path));if(error)toast.warning('New document saved, but an older private file still needs cleanup.');}
      toast.success(`${labels[type]} uploaded for review`);await load();
    }catch(e:any){toast.error(e.message||'Could not register compliance document');}finally{setBusy(null);}
  };
  const choose=(type:ComplianceDocType)=>(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(type,file);};
  const retire=async(doc:ComplianceDoc)=>{if(!window.confirm(`Remove ${doc.original_name} from current compliance?`))return;setBusy(`retire-${doc.document_id}`);try{await retireMyDriverComplianceDocument(doc.document_id);const {error}=await createClient().storage.from('driver-verification').remove([doc.storage_path]);if(error)toast.warning('Compliance state changed, but the private file still needs cleanup.');else toast.success('Compliance document removed');await load();}catch(e:any){toast.error(e.message);}finally{setBusy(null);}};

  if(loading)return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary"/></div>;
  if(!state)return null;
  const classification=state.vehicle_classification||'UNDECLARED';
  return <section className="space-y-4">
    <div className={`rounded-2xl border p-4 ${state.launch_compliant?'border-green-200 bg-green-50':'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-start gap-3">{state.launch_compliant?<CheckCircle2 size={20} className="mt-0.5 shrink-0 text-green-700"/>:<ShieldAlert size={20} className="mt-0.5 shrink-0 text-amber-700"/>}<div><p className="text-sm font-extrabold">{state.launch_compliant?'Launch compliance complete':'Launch compliance required before paid ride operations'}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Shared Ride FIFO and Outstation quoting stay locked until the required operating records are verified.</p></div></div>
    </div>
    <div className="feature-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="section-label">Vehicle classification</p><h2 className="mt-1 text-base font-extrabold">How is this vehicle registered for passenger service?</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Choose truthfully. A private/non-transport vehicle can be recorded, but Raahi will not enable paid ride operations for it unless the applicable transport rules permit that model.</p></div><ShieldCheck size={19} className="shrink-0 text-primary"/></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <ClassButton active={classification==='COMMERCIAL_PERMITTED'} disabled={busy==='classification'} onClick={()=>void saveClassification('COMMERCIAL_PERMITTED')} title="Commercial / permitted" text="Registered/permitted for passenger transport"/>
        <ClassButton active={classification==='PRIVATE_NON_TRANSPORT'} disabled={busy==='classification'} onClick={()=>void saveClassification('PRIVATE_NON_TRANSPORT')} title="Private / non-transport" text="Private registration; not launch-enabled"/>
        <ClassButton active={classification==='OTHER'} disabled={busy==='classification'} onClick={()=>void saveClassification('OTHER')} title="Other / unsure" text="Admin will review the documents"/>
      </div>
      <div className="mt-3 flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass[state.vehicle_classification_status||'MISSING']}`}>Classification: {statusCopy[state.vehicle_classification_status||'MISSING']}</span>{state.vehicle_classification_notes&&<span className="text-xs text-muted-foreground">Admin note: {state.vehicle_classification_notes}</span>}</div>
    </div>

    {classification==='PRIVATE_NON_TRANSPORT' ? (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-extrabold">Private vehicle recorded · paid ride operations stay locked</p>
        <p className="mt-1 text-xs leading-relaxed">Raahi will keep this vehicle on your profile, but it is not eligible for Shared Ride FIFO or Outstation quoting under the current launch rules. You do not need to upload commercial permit or fitness documents unless the vehicle classification changes.</p>
      </div>
    ) : (<>
      <div className="grid gap-4 lg:grid-cols-2">
        {complianceTypes.map(type=><ComplianceCard key={type} type={type} status={statusFor(state,type)} notes={notesFor(state,type)} docs={state.documents.filter(d=>d.document_type===type)} busy={busy} onChoose={choose(type)} onRetire={retire}/>) }
      </div>
      <p className="rounded-2xl bg-muted px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">Permit, fitness, insurance and PUC files stay private to you and Raahi Admin except where disclosure is required by law or a competent authority. Passengers do not receive these raw scans.</p>
    </>)}
  </section>;
}

function ClassButton({active,disabled,onClick,title,text}:{active:boolean;disabled:boolean;onClick:()=>void;title:string;text:string}){return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-2xl border-2 p-3 text-left ${active?'border-primary bg-secondary':'border-border bg-card'}`}><span className="block text-xs font-extrabold">{title}</span><span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">{text}</span></button>}

function statusFor(s:DriverLaunchCompliance,type:ComplianceDocType):ComplianceStatus{return type==='VEHICLE_PERMIT'?s.vehicle_permit_status:type==='VEHICLE_FITNESS'?s.vehicle_fitness_status:type==='VEHICLE_INSURANCE'?s.vehicle_insurance_status:s.vehicle_puc_status;}
function notesFor(s:DriverLaunchCompliance,type:ComplianceDocType){return type==='VEHICLE_PERMIT'?s.vehicle_permit_notes:type==='VEHICLE_FITNESS'?s.vehicle_fitness_notes:type==='VEHICLE_INSURANCE'?s.vehicle_insurance_notes:s.vehicle_puc_notes;}
function ComplianceCard({type,status,notes,docs,busy,onChoose,onRetire}:{type:ComplianceDocType;status:ComplianceStatus;notes?:string|null;docs:ComplianceDoc[];busy:string|null;onChoose:(e:ChangeEvent<HTMLInputElement>)=>void;onRetire:(d:ComplianceDoc)=>void}){
  return <section className="feature-card p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><FileText size={19}/></div><div><h3 className="text-sm font-extrabold">{labels[type]}</h3><span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass[status]}`}>{statusCopy[status]}</span></div></div><label className="btn-outline cursor-pointer px-3 py-2"><Upload size={14}/>{docs.length?'Replace':'Upload'}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" disabled={busy===`upload-${type}`} onChange={onChoose}/></label></div>
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Current JPG, PNG, WebP or PDF · up to 8 MB. Replacing the file returns this item to Admin review.</p>
    {notes&&<div className={`mt-3 rounded-2xl px-3 py-2.5 text-xs ${status==='REJECTED'?'bg-red-50 text-red-700':'bg-muted text-muted-foreground'}`}><strong>Admin note:</strong> {notes}</div>}
    {docs.map(doc=><div key={doc.document_id} className="mt-3 flex items-center gap-3 rounded-2xl border border-border px-3 py-3"><FileCheck2 size={16} className="shrink-0 text-primary"/><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{doc.original_name}</p><p className="text-[10px] text-muted-foreground">Uploaded {new Date(doc.created_at).toLocaleDateString()}</p></div><button onClick={()=>onRetire(doc)} disabled={busy===`retire-${doc.document_id}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-red-600" aria-label={`Remove ${doc.original_name}`}>{busy===`retire-${doc.document_id}`?<Loader2 size={14} className="animate-spin"/>:<Trash2 size={14}/>}</button></div>)}
  </section>;
}
