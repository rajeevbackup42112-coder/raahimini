'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, FileText, ImageIcon, Loader2, RefreshCw, ShieldAlert, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import DriverLaunchComplianceReview from './DriverLaunchComplianceReview';

type VerifyStatus='MISSING'|'PENDING'|'VERIFIED'|'REJECTED';
type DocType='DRIVING_LICENCE'|'VEHICLE_RC'|'DRIVER_PHOTO'|'CAR_PHOTO';
type DriverRow={driver_id:string;profile_id:string;display_name:string;vehicle_number:string;vehicle_type:string;vehicle_model:string;driving_licence_status:VerifyStatus;vehicle_rc_status:VerifyStatus;driver_photo_status:VerifyStatus;car_photos_status:VerifyStatus;fully_verified:boolean;current_document_count:number};
type DriverDoc={document_id:string;document_type:string;storage_path:string;original_name:string;mime_type:string;file_size:number;created_at:string};

const labels:Record<DocType,string>={DRIVING_LICENCE:'Driving Licence',VEHICLE_RC:'Vehicle RC',DRIVER_PHOTO:'Driver photo',CAR_PHOTO:'Car photos'};
const statusTone:Record<VerifyStatus,string>={MISSING:'bg-muted text-muted-foreground',PENDING:'bg-amber-50 text-amber-700',VERIFIED:'bg-green-50 text-green-700',REJECTED:'bg-red-50 text-red-700'};

export default function AdminDriverVerificationReview(){
  const {profile}=useAuth();
  const [rows,setRows]=useState<DriverRow[]>([]);const [selected,setSelected]=useState<DriverRow|null>(null);const [docs,setDocs]=useState<DriverDoc[]>([]);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(profile?.role!=='admin')return;setLoading(true);const supabase=createClient();
    const {data,error}=await supabase.rpc('admin_list_driver_verifications_v2');
    if(error)toast.error(error.message);else{const next=(data||[]) as DriverRow[];setRows(next);setSelected(current=>current?next.find(row=>row.driver_id===current.driver_id)||null:null);}setLoading(false);
  },[profile?.role]);
  const loadDocs=useCallback(async(driverId:string)=>{const {data,error}=await createClient().rpc('admin_get_driver_verification_documents',{p_driver_id:driverId});if(error){toast.error(error.message);setDocs([]);}else setDocs((data||[]) as DriverDoc[]);},[]);
  useEffect(()=>{void load();},[load]);useEffect(()=>{if(selected)void loadDocs(selected.driver_id);else setDocs([]);},[selected,loadDocs]);

  const counts=useMemo(()=>({verified:rows.filter(r=>r.fully_verified).length,pending:rows.filter(r=>[r.driving_licence_status,r.vehicle_rc_status,r.driver_photo_status,r.car_photos_status].includes('PENDING')).length}),[rows]);
  const openDoc=async(doc:DriverDoc)=>{setBusy(`open-${doc.document_id}`);const {data,error}=await createClient().storage.from('driver-verification').createSignedUrl(doc.storage_path,120);setBusy(null);if(error||!data?.signedUrl)return toast.error(error?.message||'Could not open private document');window.open(data.signedUrl,'_blank','noopener,noreferrer');};
  const review=async(type:DocType,status:'VERIFIED'|'REJECTED')=>{if(!selected)return;const notes=status==='REJECTED'?window.prompt(`Why is ${labels[type]} rejected?`,'Please upload a clearer/current document.')||'':'';if(status==='REJECTED'&&!notes)return;if(status==='VERIFIED'&&!window.confirm(`Mark ${selected.display_name}'s ${labels[type]} as verified?`))return;setBusy(`review-${type}`);const {data,error}=await createClient().rpc('admin_set_driver_verification_status',{p_driver_id:selected.driver_id,p_document_type:type,p_status:status,p_notes:notes||null});setBusy(null);if(error||!data?.success)return toast.error(error?.message||data?.error||'Review could not be saved');toast.success(`${labels[type]} ${status==='VERIFIED'?'verified':'rejected'}`);await load();};

  if(profile?.role!=='admin')return <div className="flex min-h-[60vh] items-center justify-center"><ShieldAlert className="mr-2"/>Admin access required.</div>;

  return <main className="mx-auto max-w-screen-2xl space-y-5 px-4 py-5">
    <section className="flex flex-wrap items-start justify-between gap-3"><div><p className="section-label">Users · Driver trust</p><h1 className="mt-1 text-2xl font-extrabold">Driver verification</h1><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Review the Driver photo and core trust documents, then complete the separate launch-compliance checks required before paid ride operations. Raw files remain private to the Driver and Raahi Admin.</p></div><div className="flex gap-2"><Link href="/admin-panel/users" className="btn-outline">Registered Users</Link><button onClick={load} disabled={loading} className="btn-outline px-3">{loading?<Loader2 size={15} className="animate-spin"/>:<RefreshCw size={15}/>}Refresh</button></div></section>
    <section className="grid grid-cols-3 gap-2"><Metric label="Drivers" value={rows.length}/><Metric label="Core trust verified" value={counts.verified}/><Metric label="Pending review" value={counts.pending} attention={counts.pending>0}/></section>

    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_430px]">
      <section className="space-y-2">{loading&&<div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary"/></div>}{!loading&&rows.map(row=><button key={row.driver_id} onClick={()=>setSelected(row)} className={`w-full rounded-2xl border bg-card p-4 text-left transition ${selected?.driver_id===row.driver_id?'border-primary brand-ring':'border-border hover:border-primary/30'}`}><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><ShieldCheck size={18}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-extrabold">{row.display_name}</p>{row.fully_verified&&<span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">Core trust verified</span>}</div><p className="mt-1 text-xs text-muted-foreground">{row.vehicle_number||'No vehicle'}{row.vehicle_model?` · ${row.vehicle_model}`:''}</p><div className="mt-2 flex flex-wrap gap-1.5"><Status name="Driver photo" status={row.driver_photo_status}/><Status name="DL" status={row.driving_licence_status}/><Status name="RC" status={row.vehicle_rc_status}/><Status name="Car photos" status={row.car_photos_status}/></div></div><span className="text-[10px] font-bold text-muted-foreground">{row.current_document_count} files</span></div></button>)}{!loading&&rows.length===0&&<div className="feature-card p-8 text-center text-sm text-muted-foreground">No active Drivers to review.</div>}</section>
      <aside className="min-w-0 lg:sticky lg:top-32 lg:self-start">{!selected?<div className="feature-card p-7 text-center"><ShieldCheck size={30} className="mx-auto text-primary"/><p className="mt-3 text-sm font-extrabold">Select a Driver</p><p className="mt-1 text-xs text-muted-foreground">Open a Driver to inspect only their current verification files and save a review decision.</p></div>:<div className="feature-card p-4 sm:p-5"><div><p className="section-label">Review Driver</p><h2 className="mt-1 text-lg font-extrabold">{selected.display_name}</h2><p className="mt-1 text-xs text-muted-foreground">{selected.vehicle_number} · {selected.vehicle_model||selected.vehicle_type}</p></div>
        <div className="mt-4 space-y-4">{(['DRIVER_PHOTO','DRIVING_LICENCE','VEHICLE_RC','CAR_PHOTO'] as DocType[]).map(type=>{const typeDocs=docs.filter(doc=>doc.document_type===type);const status=type==='DRIVER_PHOTO'?selected.driver_photo_status:type==='DRIVING_LICENCE'?selected.driving_licence_status:type==='VEHICLE_RC'?selected.vehicle_rc_status:selected.car_photos_status;return <section key={type} className="rounded-2xl border border-border p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-xs font-extrabold">{labels[type]}</p><Status name={status} status={status}/></div><span className="text-[10px] text-muted-foreground">{typeDocs.length} current</span></div>{typeDocs.length===0?<p className="mt-3 text-xs text-muted-foreground">Nothing uploaded.</p>:<div className="mt-3 space-y-2">{typeDocs.map(doc=><button key={doc.document_id} onClick={()=>openDoc(doc)} className="flex w-full items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-left"><span className="text-primary">{type==='DRIVER_PHOTO'?<UserRound size={15}/>:type==='CAR_PHOTO'?<ImageIcon size={15}/>:<FileText size={15}/>}</span><span className="min-w-0 flex-1 truncate text-xs font-semibold">{doc.original_name}</span>{busy===`open-${doc.document_id}`?<Loader2 size={14} className="animate-spin"/>:<ExternalLink size={13}/>}</button>)}</div>}<div className="mt-3 grid grid-cols-2 gap-2"><button disabled={!typeDocs.length||busy===`review-${type}`} onClick={()=>review(type,'VERIFIED')} className="btn-outline justify-center text-green-700"><CheckCircle2 size={14}/>Verify</button><button disabled={!typeDocs.length||busy===`review-${type}`} onClick={()=>review(type,'REJECTED')} className="btn-outline justify-center text-red-600"><XCircle size={14}/>Reject</button></div></section>;})}</div>
        <DriverLaunchComplianceReview driverId={selected.driver_id} displayName={selected.display_name}/>
        <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">Document links expire after 2 minutes. Passenger trust cards receive only verified status, the verified Driver photo, vehicle identity and approved car photos—not Licence, RC or launch-compliance scans.</p>
      </div>}</aside>
    </div>
  </main>;
}

function Status({name,status}:{name:string;status:VerifyStatus}){return <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${statusTone[status]}`}>{name}: {status.toLowerCase()}</span>}
function Metric({label,value,attention=false}:{label:string;value:number;attention?:boolean}){return <div className={`rounded-2xl border bg-card p-3 ${attention?'border-amber-200':'border-border'}`}><p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-extrabold ${attention?'text-amber-700':'text-foreground'}`}>{value}</p></div>}
