'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Car, Loader2, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { adminDeactivateDriver, adminListDriverCandidates, adminOnboardDriver, type DriverCandidate } from '@/lib/adminDriverApi';

const VEHICLE_TYPES = ['Car', 'Hatchback', 'Sedan', 'SUV', 'MPV', 'Van'] as const;
type SeatCapacity = 4 | 5 | 6 | 7 | 8;

export default function AdminDriverOnboardingPage() {
  const { profile, loading: authLoading } = useAuth();
  const [items, setItems] = useState<DriverCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [phone, setPhone] = useState('');
  const [registration, setRegistration] = useState('');
  const [model, setModel] = useState('');
  const [vehicleType, setVehicleType] = useState('Car');
  const [capacity, setCapacity] = useState<SeatCapacity>(4);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState<string|null>(null);

  const load = async () => {
    try {
      setItems(await adminListDriverCandidates());
    } catch (e:any) {
      toast.error(e.message || 'Could not load driver candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && profile?.role === 'admin') load();
    else if (!authLoading) setLoading(false);
  }, [authLoading, profile?.role]);

  useEffect(() => {
    if (selectedId || items.length === 0 || typeof window === 'undefined') return;
    const profileId = new URLSearchParams(window.location.search).get('profile');
    if (profileId && items.some((item) => item.profile_id === profileId)) setSelectedId(profileId);
  }, [items, selectedId]);

  const selected = useMemo(() => items.find(x => x.profile_id === selectedId), [items, selectedId]);
  useEffect(() => {
    if (!selected) return;
    setDriverName(selected.driver_name || selected.display_name || '');
    setPhone(selected.driver_phone || selected.phone || '');
    setRegistration(selected.registration_number || '');
    setModel(selected.vehicle_model || '');
    setCapacity(([4, 5, 6, 7, 8].includes(selected.capacity || 0) ? selected.capacity : 4) as SeatCapacity);
  }, [selected]);

  if (authLoading || loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;
  if (profile?.role !== 'admin') return <div className="max-w-md mx-auto px-4 py-12 text-center"><ShieldCheck className="mx-auto opacity-40" size={42}/><h1 className="font-bold mt-3">Admin Access Required</h1></div>;

  const save = async () => {
    if (!selectedId) { toast.error('Choose a signed-in user first'); return; }
    setSaving(true);
    const result = await adminOnboardDriver({ profileId:selectedId, driverName, phone, registrationNumber:registration, vehicleModel:model, vehicleType, capacity });
    setSaving(false);
    if (!result.success) { toast.error(result.error || 'Could not onboard driver'); return; }
    toast.success('Driver onboarded and linked to vehicle');
    await load();
  };

  const deactivate = async (driverId:string) => {
    setDeactivating(driverId);
    const result = await adminDeactivateDriver(driverId);
    setDeactivating(null);
    if (!result.success) { toast.error(result.error || 'Could not deactivate driver'); return; }
    toast.success('Driver deactivated');
    await load();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-screen-sm mx-auto h-14 px-4 flex items-center gap-3">
          <Link href="/admin-panel" className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted"><ArrowLeft size={20}/></Link>
          <div><p className="text-xs text-muted-foreground">Raahi Admin</p><h1 className="font-bold">Driver Onboarding</h1></div>
        </div>
      </header>

      <main className="max-w-screen-sm mx-auto px-4 py-5 space-y-5">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Drivers must sign in to Raahi once first. Then select their account here, verify the driver personally, and attach their vehicle.
        </div>

        <div className="card p-4 space-y-4">
          <div className="flex items-center gap-2"><UserPlus size={18} className="text-primary"/><h2 className="font-bold">Add / Update Driver</h2></div>
          <label className="block"><span className="text-xs font-semibold text-muted-foreground">SIGNED-IN USER</span>
            <select value={selectedId} onChange={e=>setSelectedId(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm">
              <option value="">Choose user…</option>
              {items.map(x=><option key={x.profile_id} value={x.profile_id}>{x.display_name || x.phone || x.profile_id}{x.driver_id?' — existing driver':''}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Driver name" value={driverName} onChange={setDriverName}/>
            <Field label="Phone" value={phone} onChange={setPhone} inputMode="tel"/>
            <Field label="Registration number" value={registration} onChange={setRegistration}/>
            <Field label="Vehicle model" value={model} onChange={setModel}/>
            <label><span className="text-xs font-semibold text-muted-foreground">VEHICLE TYPE</span>
              <select value={vehicleType} onChange={e=>setVehicleType(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm">
                {VEHICLE_TYPES.map(type=><option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label><span className="text-xs font-semibold text-muted-foreground">SEAT CAPACITY</span>
              <select value={capacity} onChange={e=>setCapacity(Number(e.target.value) as SeatCapacity)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm">
                <option value={4}>4 seats</option><option value={5}>5 seats</option><option value={6}>6 seats</option><option value={7}>7 seats</option><option value={8}>8 seats</option>
              </select>
            </label>
          </div>
          <button onClick={save} disabled={saving || !selectedId} className="btn-primary w-full">{saving?<Loader2 size={17} className="animate-spin"/>:<UserPlus size={17}/>} {saving?'Saving…':'Onboard Driver'}</button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2"><Users size={17}/><h2 className="font-bold">Existing Drivers</h2></div>
          {items.filter(x=>x.driver_id).length===0 && <div className="card p-5 text-center text-sm text-muted-foreground">No drivers onboarded yet.</div>}
          {items.filter(x=>x.driver_id).map(x=><div key={x.driver_id!} className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center"><Car size={18} className="text-primary"/></div>
            <div className="flex-1 min-w-0"><p className="font-bold text-sm">{x.driver_name}</p><p className="text-xs text-muted-foreground">{x.registration_number} · {x.vehicle_model} · {x.capacity} seats</p></div>
            <button disabled={deactivating===x.driver_id} onClick={()=>deactivate(x.driver_id!)} className="text-xs font-semibold text-red-600 px-2 py-2">{deactivating===x.driver_id?<Loader2 size={14} className="animate-spin"/>:'Deactivate'}</button>
          </div>)}
        </div>
      </main>
    </div>
  );
}

function Field({label,value,onChange,inputMode}:{label:string;value:string;onChange:(v:string)=>void;inputMode?:'text'|'tel'}) {
  return <label><span className="text-xs font-semibold text-muted-foreground">{label.toUpperCase()}</span><input value={value} onChange={e=>onChange(e.target.value)} inputMode={inputMode} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"/></label>;
}
