'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CarFront, CheckCircle2, FileCheck2, Loader2, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { acceptMyLegalDocuments, getMyLegalAcceptanceState, isCurrentForMode } from '@/lib/legalApi';
import { selfOnboardAsDriver } from '@/lib/driverOnboardingApi';
import { getOutstationServiceAreas, type OutstationArea } from '@/lib/outstationApi';

const VEHICLE_TYPES = ['Hatchback','Sedan','SUV','MPV','Van','Car'];

export default function DriveWithRaahiContent() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signInWithGoogle, requestPhoneVerification, verifyPhoneChange, refreshProfile } = useAuth();
  const [areas,setAreas]=useState<OutstationArea[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [phone,setPhone]=useState('');
  const [otp,setOtp]=useState('');
  const [otpSent,setOtpSent]=useState(false);
  const [driverName,setDriverName]=useState('');
  const [registration,setRegistration]=useState('');
  const [vehicleModel,setVehicleModel]=useState('');
  const [vehicleType,setVehicleType]=useState('Hatchback');
  const [capacity,setCapacity]=useState(4);
  const [originAreaId,setOriginAreaId]=useState('');
  const [agreed,setAgreed]=useState(false);
  const [legalCurrent,setLegalCurrent]=useState(false);

  const load=useCallback(async()=>{
    try {
      const a=await getOutstationServiceAreas();
      setAreas(a); setOriginAreaId(current=>current||a[0]?.area_id||'');
      if(user){const state=await getMyLegalAcceptanceState();setLegalCurrent(isCurrentForMode(state,'driver'));}
    } catch(e:any){toast.error(e?.message||'Could not load Driver onboarding');}
    finally{setLoading(false);}
  },[user]);

  useEffect(()=>{if(!authLoading)void load();},[authLoading,load]);
  useEffect(()=>{if(profile?.display_name)setDriverName(profile.display_name);},[profile?.display_name]);

  const phoneVerified=Boolean(user?.phone && user?.phone_confirmed_at);

  const sendOtp=async()=>{
    if(phone.replace(/\D/g,'').length<10)return toast.error('Enter a valid mobile number');
    setBusy(true);try{await requestPhoneVerification(phone);setOtpSent(true);toast.success('Verification code sent');}catch(e:any){toast.error(e?.message||'Could not send OTP');}finally{setBusy(false);}
  };
  const verifyOtp=async()=>{
    if(otp.trim().length<4)return toast.error('Enter the verification code');
    setBusy(true);try{await verifyPhoneChange(phone,otp.trim());setOtp('');setOtpSent(false);toast.success('Mobile number verified');}catch(e:any){toast.error(e?.message||'Could not verify OTP');}finally{setBusy(false);}
  };

  const acceptExistingDriverTerms=async()=>{
    if(!agreed)return toast.error('Please accept the Raahi agreement to continue');
    setBusy(true);try{await acceptMyLegalDocuments('driver');setLegalCurrent(true);router.push('/driver-verification');}catch(e:any){toast.error(e?.message||'Could not save Driver agreement');}finally{setBusy(false);}
  };

  const submit=async(e:FormEvent)=>{
    e.preventDefault();
    if(!phoneVerified)return toast.error('Verify your mobile number first');
    if(!agreed)return toast.error('Please accept the Raahi agreement to continue');
    if(!originAreaId)return toast.error('Choose your main Raahi origin area');
    setBusy(true);
    try{
      await selfOnboardAsDriver({driverName,registrationNumber:registration,vehicleModel,vehicleType,capacity,originAreaId});
      // The profile is now a Driver in the database, so Driver Terms can be recorded from the same explicit consent action.
      await acceptMyLegalDocuments('driver');
      await refreshProfile();
      toast.success('Driver profile created. Now upload your verification documents.');
      router.push('/driver-verification');
    }catch(e:any){
      await refreshProfile().catch(()=>undefined);
      toast.error(e?.message||'Could not create Driver profile');
    }finally{setBusy(false);}
  };

  if(authLoading||loading)return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary"/></div>;

  return <div className="page-shell space-y-5 py-5">
    <section className="hero-surface">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">Drive with Raahi</p>
      <h1 className="mt-2 max-w-2xl text-2xl font-extrabold text-white sm:text-3xl">Join your local Raahi network.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">Choose where you want to originate, submit your real Driver and vehicle details, and upload your verification documents. Raahi Admin reviews them before paid operations unlock.</p>
    </section>

    <section className="grid gap-3 sm:grid-cols-3">
      <Step icon={<Phone size={18}/>} title="1 · Verify yourself" detail="Google sign-in and mobile OTP."/>
      <Step icon={<CarFront size={18}/>} title="2 · Add your car" detail="Vehicle details and your origin area."/>
      <Step icon={<FileCheck2 size={18}/>} title="3 · Admin review" detail="DL, RC, car photos and launch documents."/>
    </section>

    {!user&&<section className="feature-card p-5 sm:p-6">
      <h2 className="text-lg font-extrabold">Start with your own Raahi account</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Raahi Admin will verify your documents; Admin does not need to create your account for you.</p>
      <button disabled={busy} onClick={()=>void signInWithGoogle('/drive-with-raahi')} className="btn-primary mt-5 w-full py-3"><ShieldCheck size={17}/>Continue with Google</button>
    </section>}

    {user&&!phoneVerified&&<section className="feature-card p-5 sm:p-6">
      <p className="section-label">Mobile verification</p><h2 className="mt-1 text-lg font-extrabold">Verify the number passengers can reach after a booking</h2>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">The number stays private until a Passenger accepts your Outstation quote or has a confirmed Shared Ride relationship.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><input value={phone} onChange={e=>setPhone(e.target.value)} inputMode="tel" placeholder="10-digit mobile number" className="input-field"/><button disabled={busy} onClick={sendOtp} className="btn-outline">{busy?<Loader2 size={15} className="animate-spin"/>:'Send OTP'}</button></div>
      {otpSent&&<div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"><input value={otp} onChange={e=>setOtp(e.target.value)} inputMode="numeric" placeholder="Verification code" className="input-field"/><button disabled={busy} onClick={verifyOtp} className="btn-primary">Verify mobile</button></div>}
    </section>}

    {user&&profile?.role==='driver'&&<section className="feature-card p-5 sm:p-6">
      <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-green-700" size={20}/><div><p className="section-label">Driver profile exists</p><h2 className="mt-1 text-lg font-extrabold">Continue your verification</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Your Driver record does not unlock paid operations by itself. Raahi still requires the applicable agreement and full document verification.</p></div></div>
      {!legalCurrent?<><Agreement checked={agreed} onChange={setAgreed}/><button disabled={!agreed||busy} onClick={acceptExistingDriverTerms} className="btn-primary mt-4 w-full">Agree & continue to verification</button></>:<button onClick={()=>router.push('/driver-verification')} className="btn-primary mt-4 w-full">Continue to Driver verification</button>}
    </section>}

    {user&&profile?.role==='passenger'&&phoneVerified&&<form onSubmit={submit} className="feature-card space-y-4 p-5 sm:p-6">
      <div><p className="section-label">Your Driver profile</p><h2 className="mt-1 text-lg font-extrabold">Tell Raahi where and what you drive</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Use real details. Your car and documents remain unapproved until Raahi Admin verifies them.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Driver name" value={driverName} onChange={setDriverName} placeholder="Name as used for Raahi"/>
        <Field label="Vehicle registration" value={registration} onChange={setRegistration} placeholder="JH10AB1234"/>
        <Field label="Vehicle model" value={vehicleModel} onChange={setVehicleModel} placeholder="Tata Tiago"/>
        <label className="text-xs font-bold">Vehicle type<select value={vehicleType} onChange={e=>setVehicleType(e.target.value)} className="input-field mt-1">{VEHICLE_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="text-xs font-bold">Passenger capacity<select value={capacity} onChange={e=>setCapacity(Number(e.target.value))} className="input-field mt-1">{[4,5,6,7,8].map(n=><option key={n} value={n}>{n} seats</option>)}</select></label>
        <label className="text-xs font-bold">Main Outstation origin<select value={originAreaId} onChange={e=>setOriginAreaId(e.target.value)} className="input-field mt-1"><option value="">Choose area</option>{areas.map(a=><option key={a.area_id} value={a.area_id}>{a.area_name}, {a.state}</option>)}</select></label>
      </div>
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><div className="flex gap-2"><MapPin size={17} className="mt-0.5 shrink-0 text-blue-700"/><p className="text-xs leading-relaxed text-blue-900"><strong>Your origin area controls Outstation leads.</strong> You can later change Outstation areas independently from Shared Ride corridor preferences.</p></div></div>
      <Agreement checked={agreed} onChange={setAgreed}/>
      <button disabled={busy||!agreed||!originAreaId||driverName.trim().length<2||registration.trim().length<4||vehicleModel.trim().length<2} className="btn-primary w-full py-3">{busy?<Loader2 size={17} className="animate-spin"/>:<CarFront size={17}/>}Create Driver profile & continue</button>
    </form>}
  </div>;
}

function Agreement({checked,onChange}:{checked:boolean;onChange:(v:boolean)=>void}){
  return <div className="mt-4 rounded-2xl border border-border bg-card p-4"><p className="text-sm font-extrabold">A quick Raahi agreement, once</p><div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground"><p>• Raahi connects independent local Drivers and passengers; Raahi does not operate your vehicle.</p><p>• You are responsible for safe driving, lawful documents, your vehicle and the fare you agree directly with passengers.</p><p>• Raahi verifies submitted evidence but you must keep every required document current.</p><p>• Passenger contact information is private and may be used only for the accepted Raahi journey.</p></div><label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-muted/60 p-3"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} className="mt-1"/><span className="text-xs leading-relaxed">I agree to the <Link href="/terms" target="_blank" className="font-bold text-primary underline">Terms</Link>, <Link href="/privacy" target="_blank" className="font-bold text-primary underline">Privacy Policy</Link> and <Link href="/driver-terms" target="_blank" className="font-bold text-primary underline">Driver Terms</Link>.</span></label></div>;
}
function Step({icon,title,detail}:{icon:React.ReactNode;title:string;detail:string}){return <div className="rounded-2xl border border-border bg-card p-4"><div className="text-primary">{icon}</div><p className="mt-2 text-sm font-extrabold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>}
function Field({label,value,onChange,placeholder}:{label:string;value:string;onChange:(v:string)=>void;placeholder:string}){return <label className="text-xs font-bold">{label}<input required value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="input-field mt-1"/></label>}
