'use client';

import { ChangeEvent,FormEvent,useCallback,useEffect,useState } from 'react';
import { Archive,ImageIcon,Loader2,Megaphone,Plus,RefreshCw,Save,Store } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { adminListLocalPromotions,adminSaveLocalPromotion,adminSetLocalPromotionStatus,localPromotionImageUrl,type AdminLocalPromotion } from '@/lib/localOffersApi';

function localInput(value:string|Date){const d=value instanceof Date?value:new Date(value);const p=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;}
const initial=()=>({businessName:'',headline:'',description:'',locality:'',contactPhone:'',whatsappPhone:'',startsAt:localInput(new Date()),endsAt:localInput(new Date(Date.now()+7*86400000)),amountCollected:200,imagePath:null as string|null});

export default function AdminLocalPromotions(){
  const {profile}=useAuth(); const [rows,setRows]=useState<AdminLocalPromotion[]>([]); const [selected,setSelected]=useState<AdminLocalPromotion|null>(null); const [form,setForm]=useState(initial); const [imageFile,setImageFile]=useState<File|null>(null); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{if(profile?.role!=='admin')return;setLoading(true);try{setRows(await adminListLocalPromotions());}catch(e:any){toast.error(e.message||'Could not load promotions');}finally{setLoading(false);}},[profile?.role]);
  useEffect(()=>{void load();},[load]);
  if(profile?.role!=='admin')return null;

  const reset=()=>{setSelected(null);setForm(initial());setImageFile(null);};
  const edit=(row:AdminLocalPromotion)=>{setSelected(row);setForm({businessName:row.business_name,headline:row.headline,description:row.description,locality:row.locality||'',contactPhone:row.contact_phone||'',whatsappPhone:row.whatsapp_phone||'',startsAt:localInput(row.starts_at),endsAt:localInput(row.ends_at),amountCollected:row.amount_collected,imagePath:row.image_path});setImageFile(null);window.scrollTo({top:0,behavior:'smooth'});};
  const chooseImage=(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0]||null;e.target.value='';if(!file)return;if(file.size>5242880)return toast.error('Promotion image must be 5 MB or smaller');if(!['image/jpeg','image/png','image/webp'].includes(file.type))return toast.error('Use JPG, PNG or WebP');setImageFile(file);};

  const save=async(e:FormEvent)=>{e.preventDefault();setBusy(true);let uploaded:string|null=null;try{
    if(imageFile){const ext=imageFile.type==='image/png'?'png':imageFile.type==='image/webp'?'webp':'jpg';uploaded=`${crypto.randomUUID()}.${ext}`;const {error}=await createClient().storage.from('promotion-assets').upload(uploaded,imageFile,{upsert:false,contentType:imageFile.type});if(error)throw error;}
    const imagePath=uploaded||form.imagePath;
    await adminSaveLocalPromotion({promotionId:selected?.promotion_id||null,businessName:form.businessName,headline:form.headline,description:form.description,locality:form.locality,contactPhone:form.contactPhone,whatsappPhone:form.whatsappPhone,imagePath,startsAt:new Date(form.startsAt).toISOString(),endsAt:new Date(form.endsAt).toISOString(),amountCollected:Number(form.amountCollected)||0});
    if(uploaded&&selected?.image_path&&selected.image_path!==uploaded)await createClient().storage.from('promotion-assets').remove([selected.image_path]);
    toast.success(selected?'Promotion updated':'Promotion saved as draft');reset();await load();
  }catch(e:any){if(uploaded)await createClient().storage.from('promotion-assets').remove([uploaded]);toast.error(e.message||'Could not save promotion');}finally{setBusy(false);}};
  const setStatus=async(row:AdminLocalPromotion,status:'DRAFT'|'ACTIVE'|'ARCHIVED')=>{setBusy(true);try{await adminSetLocalPromotionStatus(row.promotion_id,status);toast.success(`Promotion ${status.toLowerCase()}`);await load();}catch(e:any){toast.error(e.message);}finally{setBusy(false);}};

  return <main className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="section-label">Operations · Promotions</p><h1 className="mt-1 text-2xl font-extrabold">Local Offers</h1><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Local businesses support Raahi while the platform has no Passenger fee or Driver commission at launch. Every placement stays clearly marked Sponsored.</p></div><div className="flex gap-2"><button onClick={load} className="btn-outline px-3 py-2"><RefreshCw size={14}/>Refresh</button><button onClick={reset} className="btn-primary px-3 py-2"><Plus size={14}/>New offer</button></div></div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form onSubmit={save} className="feature-card space-y-3 p-4 sm:p-5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary"><Megaphone size={18}/></div><div><p className="text-sm font-extrabold">{selected?'Edit promotion':'Create promotion'}</p><p className="text-[11px] text-muted-foreground">New promotions start as Draft.</p></div></div>
      <Field label="Business name"><input required maxLength={100} value={form.businessName} onChange={e=>setForm(f=>({...f,businessName:e.target.value}))} className="input-field"/></Field>
      <Field label="Offer headline"><input required maxLength={120} value={form.headline} onChange={e=>setForm(f=>({...f,headline:e.target.value}))} placeholder="Festive sarees from ₹699" className="input-field"/></Field>
      <Field label="Short description"><textarea required rows={3} maxLength={300} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="input-field resize-y"/></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Locality"><input maxLength={120} value={form.locality} onChange={e=>setForm(f=>({...f,locality:e.target.value}))} className="input-field"/></Field><Field label="Amount collected ₹"><input type="number" min={0} value={form.amountCollected} onChange={e=>setForm(f=>({...f,amountCollected:Number(e.target.value)}))} className="input-field"/></Field></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Call phone"><input maxLength={30} value={form.contactPhone} onChange={e=>setForm(f=>({...f,contactPhone:e.target.value}))} className="input-field"/></Field><Field label="WhatsApp"><input maxLength={30} value={form.whatsappPhone} onChange={e=>setForm(f=>({...f,whatsappPhone:e.target.value}))} className="input-field"/></Field></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Starts"><input required type="datetime-local" value={form.startsAt} onChange={e=>setForm(f=>({...f,startsAt:e.target.value}))} className="input-field"/></Field><Field label="Ends"><input required type="datetime-local" value={form.endsAt} onChange={e=>setForm(f=>({...f,endsAt:e.target.value}))} className="input-field"/></Field></div>
      <Field label="Promotion image"><label className="btn-outline w-full cursor-pointer justify-center"><ImageIcon size={14}/>{imageFile?imageFile.name:form.imagePath?'Replace image':'Add image'}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={chooseImage}/></label></Field>
      {(imageFile||form.imagePath)&&<div className="rounded-xl bg-muted px-3 py-2 text-[11px] text-muted-foreground">{imageFile?'New image will upload when you save.':'Current image will stay unless replaced.'}</div>}
      <button disabled={busy} className="btn-primary w-full py-3">{busy?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>}Save promotion</button></form>

      <section className="space-y-3"><div className="flex items-end justify-between"><div><p className="section-label">Promotion inventory</p><h2 className="mt-1 text-lg font-extrabold">{rows.length} promotion{rows.length===1?'':'s'}</h2></div><p className="text-[11px] text-muted-foreground">No behavioral ad tracking</p></div>
      {loading&&<div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary"/></div>}
      {!loading&&rows.length===0&&<div className="feature-card p-8 text-center"><Store size={30} className="mx-auto text-muted-foreground opacity-40"/><p className="mt-3 text-sm font-bold">No promotions yet</p></div>}
      {rows.map(row=><PromotionRow key={row.promotion_id} row={row} busy={busy} onEdit={()=>edit(row)} onStatus={(s)=>setStatus(row,s)}/>)}</section>
    </div>
  </main>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block text-[11px] font-bold text-foreground"><span className="mb-1 block">{label}</span>{children}</label>}

function PromotionRow({row,busy,onEdit,onStatus}:{row:AdminLocalPromotion;busy:boolean;onEdit:()=>void;onStatus:(s:'DRAFT'|'ACTIVE'|'ARCHIVED')=>void}){
  const image=localPromotionImageUrl(row.image_path); const live=row.status==='ACTIVE'&&new Date(row.starts_at)<=new Date()&&new Date(row.ends_at)>new Date();
  return <article className="feature-card overflow-hidden"><div className="grid sm:grid-cols-[140px_minmax(0,1fr)]">{image?<img src={image} alt={`${row.business_name} promotion`} className="h-36 w-full object-cover sm:h-full"/>:<div className="flex h-28 items-center justify-center bg-secondary sm:h-full"><Store size={26} className="text-primary"/></div>}<div className="p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${live?'bg-green-50 text-green-700':row.status==='DRAFT'?'bg-amber-50 text-amber-700':'bg-muted text-muted-foreground'}`}>{live?'ACTIVE NOW':row.status}</span><span className="text-[10px] font-bold text-muted-foreground">₹{row.amount_collected.toLocaleString('en-IN')} collected</span></div><p className="mt-2 text-xs font-bold uppercase tracking-wide text-primary">{row.business_name}</p><h3 className="mt-1 text-base font-extrabold">{row.headline}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{row.description}</p></div><button onClick={onEdit} className="btn-outline px-3 py-2 text-xs">Edit</button></div>
    <p className="mt-3 text-[10px] text-muted-foreground">{new Date(row.starts_at).toLocaleString('en-IN')} → {new Date(row.ends_at).toLocaleString('en-IN')}</p><div className="mt-3 flex flex-wrap gap-2">{row.status!=='ACTIVE'&&<button disabled={busy} onClick={()=>onStatus('ACTIVE')} className="btn-primary px-3 py-2 text-xs"><Megaphone size={13}/>Activate</button>}{row.status==='ACTIVE'&&<button disabled={busy} onClick={()=>onStatus('DRAFT')} className="btn-outline px-3 py-2 text-xs">Return to Draft</button>}{row.status!=='ARCHIVED'&&<button disabled={busy} onClick={()=>onStatus('ARCHIVED')} className="btn-outline px-3 py-2 text-xs text-red-600"><Archive size={13}/>Archive</button>}</div></div></div></article>;
}
