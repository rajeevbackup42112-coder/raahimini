'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { Car, Clock3, ExternalLink, Loader2, LocateFixed, MapPin, ShieldCheck, User } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import { getSharedTrip, type SharedTrip } from '@/lib/shareApi';

export default function SharedTripPage() {
  return <Suspense fallback={<SharedLoading />}><SharedTripContent /></Suspense>;
}

function SharedLoading() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
}

function SharedTripContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [trip, setTrip] = useState<SharedTrip | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) { setTrip({ valid: false }); setLoading(false); return; }
    setTrip(await getSharedTrip(token));
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (loading) return <SharedLoading />;
  if (!trip?.valid) {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <div className="mx-auto max-w-md text-center space-y-4">
          <AppLogo size={44} />
          <h1 className="text-xl font-bold">This Raahi trip link is no longer active</h1>
          <p className="text-sm text-muted-foreground">The passenger may have revoked it, the trip may have been cancelled, or the secure link may have expired.</p>
        </div>
      </div>
    );
  }

  const stops = trip.stops || [];
  const location = trip.location;
  const live = Boolean(location?.is_fresh && trip.trip_status === 'IN_PROGRESS');
  const mapUrl = location ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(location.latitude))}&mlon=${encodeURIComponent(String(location.longitude))}#map=16/${encodeURIComponent(String(location.latitude))}/${encodeURIComponent(String(location.longitude))}` : '';

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-md items-center gap-2 px-4"><AppLogo size={34} /><div><p className="font-extrabold text-primary">Raahi</p><p className="text-[10px] text-muted-foreground">Shared trip · read only</p></div></div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-5">
        <div className="hero-surface">
          <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-amber-200" /><p className="text-xs font-bold uppercase tracking-wide text-amber-200">Shared by {trip.passenger_name}</p></div>
          <h1 className="mt-3 text-xl font-extrabold text-white">{trip.route_label || trip.route_code}</h1>
          <p className="mt-1 text-sm text-white/75">{trip.trip_status === 'COMPLETED' ? 'Destination reached' : trip.trip_status === 'IN_PROGRESS' ? 'Trip is in progress' : 'Preparing to depart'}</p>
        </div>

        <div className="feature-card p-4 space-y-3">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary"><User size={18} className="text-primary" /></div><div><p className="text-xs text-muted-foreground">Raahi driver</p><p className="text-sm font-bold">{trip.driver_name}</p></div></div>
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary"><Car size={18} className="text-primary" /></div><div><p className="text-xs text-muted-foreground">Vehicle</p><p className="text-sm font-bold">{trip.vehicle_model} · {trip.vehicle_number}</p></div></div>
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary"><MapPin size={18} className="text-primary" /></div><div><p className="text-xs text-muted-foreground">Pickup point</p><p className="text-sm font-bold">{trip.pickup_point}</p></div></div>
        </div>

        <div className={`rounded-2xl border p-4 ${live ? 'border-green-200 bg-green-50' : 'border-border bg-card'}`}>
          <div className="flex items-start gap-3">
            <LocateFixed size={19} className={live ? 'text-green-700' : 'text-muted-foreground'} />
            <div className="flex-1"><p className={`text-sm font-bold ${live ? 'text-green-900' : 'text-foreground'}`}>{live ? 'Live driver location available' : 'Live GPS temporarily unavailable'}</p><p className={`mt-1 text-xs ${live ? 'text-green-800' : 'text-muted-foreground'}`}>{live && location?.captured_at ? `Updated ${new Date(location.captured_at).toLocaleTimeString()}.` : 'Route progress below continues to update even when GPS is unavailable.'}</p></div>
          </div>
          {live && mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="btn-outline mt-3 w-full"><ExternalLink size={16} />Open live location on map</a>}
        </div>

        <div className="feature-card p-4">
          <div className="flex items-center justify-between"><p className="section-label">Journey progress</p>{trip.started_at && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 size={11} />Started {new Date(trip.started_at).toLocaleTimeString()}</span>}</div>
          <div className="mt-4 space-y-0">
            {stops.map((stop, index) => (
              <div key={`${stop.stop_order}-${stop.name}`} className="flex gap-3">
                <div className="flex w-5 flex-col items-center"><div className={`h-3 w-3 rounded-full ${stop.is_current ? 'bg-primary' : stop.is_passed ? 'bg-accent' : 'bg-border'}`} />{index < stops.length - 1 && <div className={`h-8 w-0.5 ${stop.is_passed ? 'bg-accent' : 'bg-border'}`} />}</div>
                <div className="pb-4"><p className={`text-sm font-semibold ${stop.is_current ? 'text-primary' : stop.is_passed ? 'text-muted-foreground' : 'text-foreground'}`}>{stop.name}</p>{stop.is_current && <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Driver here now</p>}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="px-2 text-center text-[11px] text-muted-foreground">This secure link shows only this trip. No phone numbers or Raahi booking history are shared.</p>
      </main>
    </div>
  );
}
