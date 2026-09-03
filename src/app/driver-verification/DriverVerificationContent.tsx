'use client';

import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileCheck2, FileText, ImageIcon, Loader2, RefreshCw, ShieldAlert, ShieldCheck, Trash2, Upload, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import DriverLaunchComplianceSection from './DriverLaunchComplianceSection';

type DocType='DRIVING_LICENCE'|'VEHICLE_RC'|'DRIVER_PHOTO'|'CAR_PHOTO';
type VerifyStatus='MISSING'|'PENDING'|'VERIFIED'|'REJECTED';
type DriverDoc={document_id:string;document_type:string;storage_path:string;original_name:string;mime_type:string;file_size:number;created_at:string};
type Verification={
  success:boolean;error?:string;driver_id?:string;
  vehicle?:{registration_number?:string;vehicle_type?:string;vehicle_model?:string;capacity?:number};
  driving_licence_status:VerifyStatus;vehicle_rc_status:VerifyStatus;driver_photo_status:VerifyStatus;car_photos_status:VerifyStatus;
  driving_licence_notes?:string|null;vehicle_rc_notes?:string|null;driver_photo_notes?:string|null;car_photos_notes?:string|null;
  documents:DriverDoc[];
};

const statusCopy:Record<VerifyStatus,string>={MISSING:'Not uploaded',PENDING:'Waiting for review',VERIFIED:'Verified',REJECTED:'Needs attention'};
const statusClass:Record<VerifyStatus,string>={MISSING:'bg-muted text-muted-foreground',PENDING:'bg-amber-50 text-amber-700',VERIFIED:'bg-green-50 text-green-700',REJECTED:'bg-red-50 text-red-700'};
const label:Record<DocType,string>={DRIVING_LICENCE:'Driving Licence',VEHICLE_RC:'Vehicle RC',DRIVER_PHOTO:'Driver photo',CAR_PHOTO:'Car photos'};

export default function DriverVerificationContent(){
  const {user,profile,loading:authLoading}=useAuth();
  const [state,setState]=useState<Verification|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!user||profile?.role!=='driver') return;
    setLoading(true);
    const {data,error}=await createClient().rpc('get_my_driver_verification');
    if(error||!data?.success) toast.error(error?.message||data?.error||'Could not load verification');
    else setState(data as Verification);
    setLoading(false);
  },[profile?.role,user]);

  useEffect(()=>{if(!authLoading&&user&&profile?.role==='driver')void load();else if(!authLoading)setLoading(false);},[authLoading,user,profile?.role,load]);

  const extension=(file:File)=>{
    const nameExt=file.name.includes('.')?file.name.split('.').pop()?.toLowerCase():'';
    if(nameExt&&['jpg','jpeg','png','webp','pdf'].includes(nameExt))return nameExt;
    return file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
  };

  const upload=async(type:DocType,file:File)=>{
    if(!user)return;
    if(file.size>8388608)return toast.error('File must be 8 MB or smaller');
    const allowed=['image/jpeg','image/png','image/webp','application/pdf'];
    if(!allowed.includes(file.type))return toast.error('Use JPG, PNG, WebP or PDF');
    if((type==='DRIVER_PHOTO'||type==='CAR_PHOTO')&&file.type==='application/pdf')return toast.error('Driver and car photos must be images');
    if(type==='CAR_PHOTO'&&(state?.documents.filter(d=>d.document_type==='CAR_PHOTO').length||0)>=4)return toast.error('Keep up to 4 current car photos');
    setBusy(`upload-${type}`);
    const supabase=createClient();
    const replaced=type==='CAR_PHOTO'?[]:(state?.documents.filter(d=>d.document_type===type)||[]);
    const path=`${user.id}/${type.toLowerCase()}/${crypto.randomUUID()}.${extension(file)}`;
    const {error:uploadError}=await supabase.storage.from('driver-verification').upload(path,file,{upsert:false,contentType:file.type});
    if(uploadError){setBusy(null);return toast.error(uploadError.message);}
    const {data,error}=await supabase.rpc('register_driver_verification_upload',{p_document_type:type,p_storage_path:path,p_original_name:file.name,p_mime_type:file.type,p_file_size:file.size});
    setBusy(null);
    if(error||!data?.success)return toast.error(error?.message||data?.error||'File uploaded but could not be registered');
    if(replaced.length){const {error:cleanupError}=await supabase.storage.from('driver-verification').remove(replaced.map(d=>d.storage_path));if(cleanupError)toast.warning('New document saved, but an older private file still needs cleanup.');}
    toast.success(`${label[type]} uploaded for review`);await load();
  };

  const choose=(type:DocType)=>(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];event.target.value='';if(file)void upload(type,file);};
  const retire=async(doc:DriverDoc)=>{
    if(!window.confirm(`Remove ${doc.original_name} from current verification?`))return;
    setBusy(`retire-${doc.document_id}`);const supabase=createClient();
    const {data,error}=await supabase.rpc('retire_my_driver_verification_document',{p_document_id:doc.document_id});
    if(error||!data?.success){setBusy(null);return toast.error(error?.message||data?.error||'Could not remove document');}
    const {error:removeError}=await supabase.storage.from('driver-verification').remove([doc.storage_path]);setBusy(null);
    if(removeError)toast.warning('Verification state was updated, but the private file still needs cleanup.');else toast.success('Document removed from current verification');
    await load();
  };

  if(authLoading||loading)return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary"/></div>;
  if(!user)return <Access title="Driver sign in required" text="Sign in with your Driver account to upload verification documents."/>;
  if(profile?.role!=='driver')return <Access title="Driver access only" text="Verification uploads are available to registered Drivers."/>;
  if(!state)return <Access title="Verification unavailable" text="Raahi could not load your Driver verification right now."/>;

  const dlDocs=state.documents.filter(d=>d.document_type==='DRIVING_LICENCE');
  const rcDocs=state.documents.filter(d=>d.document_type==='VEHICLE_RC');
  const driverPhotoDocs=state.documents.filter(d=>d.document_type==='DRIVER_PHOTO');
  const carDocs=state.documents.filter(d=>d.document_type==='CAR_PHOTO');
  const fully=state.driving_licence_status==='VERIFIED'&&state.vehicle_rc_status==='VERIFIED'&&state.driver_photo_status==='VERIFIED'&&state.car_photos_status==='VERIFIED';

  return <div className="mx-auto max-w-screen-lg space-y-5 px-4 py-5 sm:px-6 sm:py-8">
    <section className="hero-surface p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">Driver trust</p><h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">Verify your Driver profile</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">Add a clear Driver photo, Driving Licence, vehicle RC and car photos, then complete the launch-compliance documents required before paid ride operations.</p></div><ShieldCheck size={28} className="shrink-0 text-white/80"/></div></section>

    <section className={`rounded-2xl border p-4 ${fully?'border-green-200 bg-green-50':'border-border bg-card'}`}><div className="flex items-start gap-3">{fully?<CheckCircle2 size={20} className="mt-0.5 shrink-0 text-green-700"/>:<FileCheck2 size={20} className="mt-0.5 shrink-0 text-primary"/>}<div><p className="text-sm font-extrabold">{fully?'Core trust verification complete':'Complete all four core trust groups'}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Raw Licence and RC files stay private to you and Raahi Admin. Passengers see approved trust results, your verified Driver photo and approved car photos only when they have a legitimate Raahi journey relationship.</p></div></div></section>

    <section className="feature-card p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="section-label">Vehicle on Raahi</p><p className="mt-1 text-base font-extrabold">{state.vehicle?.vehicle_model||state.vehicle?.vehicle_type||'Vehicle'}</p><p className="mt-1 text-xs text-muted-foreground">{state.vehicle?.registration_number||'Registration unavailable'}{state.vehicle?.capacity?` · ${state.vehicle.capacity} seats`:''}</p></div><Link href="/driver-route-selection" className="btn-outline px-3 py-2">Driver Home</Link></div></section>

    <div className="grid gap-4 lg:grid-cols-2">
      <VerificationCard type="DRIVER_PHOTO" status={state.driver_photo_status} notes={state.driver_photo_notes} docs={driverPhotoDocs} busy={busy} onChoose={choose('DRIVER_PHOTO')} onRetire={retire}/>
      <VerificationCard type="DRIVING_LICENCE" status={state.driving_licence_status} notes={state.driving_licence_notes} docs={dlDocs} busy={busy} onChoose={choose('DRIVING_LICENCE')} onRetire={retire}/>
      <VerificationCard type="VEHICLE_RC" status={state.vehicle_rc_status} notes={state.vehicle_rc_notes} docs={rcDocs} busy={busy} onChoose={choose('VEHICLE_RC')} onRetire={retire}/>
      <VerificationCard type="CAR_PHOTO" status={state.car_photos_status} notes={state.car_photos_notes} docs={carDocs} busy={busy} onChoose={choose('CAR_PHOTO')} onRetire={retire}/>
    </div>

    <DriverLaunchComplianceSection/>
    <button onClick={load} className="btn-outline w-full"><RefreshCw size={15}/>Refresh verification</button>
  </div>;
}

function VerificationCard({type,status,notes,docs,busy,onChoose,onRetire}:{type:DocType;status:VerifyStatus;notes?:string|null;docs:DriverDoc[];busy:string|null;onChoose:(e:ChangeEvent<HTMLInputElement>)=>void;onRetire:(doc:DriverDoc)=>void}){
  const car=type==='CAR_PHOTO';const portrait=type==='DRIVER_PHOTO';const imageOnly=car||portrait;
  const accept=imageOnly?'image/jpeg,image/png,image/webp':'image/jpeg,image/png,image/webp,application/pdf';
  const canAdd=!car||docs.length<4;
  const detail=portrait?'Use one clear, recent, front-facing photo of yourself. Passengers may see it only with a legitimate Raahi trust relationship.':car?'Add up to 4 clear exterior/interior photos. Adding or removing a photo returns this group to review.':'JPG, PNG, WebP or PDF · up to 8 MB. Replacing a document returns it to review.';
  return <section className="feature-card p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">{portrait?<UserRound size={19}/>:car?<ImageIcon size={19}/>:<FileText size={19}/>}</div><div><h2 className="text-sm font-extrabold">{label[type]}</h2><span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass[status]}`}>{statusCopy[status]}</span></div></div><label className={`btn-outline cursor-pointer px-3 py-2 ${!canAdd?'pointer-events-none opacity-40':''}`}><Upload size={14}/>{docs.length?(car?'Add':'Replace'):'Upload'}<input type="file" accept={accept} className="hidden" disabled={!canAdd||busy===`upload-${type}`} onChange={onChoose}/></label></div>
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{detail}</p>
    {notes&&<div className={`mt-3 rounded-2xl px-3 py-2.5 text-xs ${status==='REJECTED'?'bg-red-50 text-red-700':'bg-muted text-muted-foreground'}`}><strong>Admin note:</strong> {notes}</div>}
    {docs.length>0&&<div className="mt-4 space-y-2">{docs.map(doc=><DocumentRow key={doc.document_id} doc={doc} busy={busy===`retire-${doc.document_id}`} onRetire={()=>onRetire(doc)}/>)}</div>}
    {car&&<p className="mt-3 text-[10px] text-muted-foreground">{docs.length}/4 current photos</p>}
  </section>;
}

function DocumentRow({doc,busy,onRetire}:{doc:DriverDoc;busy:boolean;onRetire:()=>void}){const size=doc.file_size<1024*1024?`${Math.max(1,Math.round(doc.file_size/1024))} KB`:`${(doc.file_size/1024/1024).toFixed(1)} MB`;return <div className="flex items-center gap-3 rounded-2xl border border-border px-3 py-3"><FileCheck2 size={16} className="shrink-0 text-primary"/><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{doc.original_name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{size} · uploaded {new Date(doc.created_at).toLocaleDateString()}</p></div><button onClick={onRetire} disabled={busy} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-red-600" aria-label={`Remove ${doc.original_name}`}>{busy?<Loader2 size={14} className="animate-spin"/>:<Trash2 size={14}/>}</button></div>;}
function Access({title,text}:{title:string;text:string}){return <div className="mx-auto max-w-screen-sm px-4 py-16 text-center"><ShieldAlert size={36} className="mx-auto text-muted-foreground opacity-40"/><h1 className="mt-4 text-lg font-bold">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>;}
