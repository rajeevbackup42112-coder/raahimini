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
        <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-7 text-center card-shadow-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary"><AppLogo size={34} /></div>
          <p className="section-label mt-5">Secure trip link</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">This Raahi trip link is no longer active</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">The passenger may have revoked it, the trip may have been cancelled, or the secure link may have expired.</p>
        </div>
      </div>
    );
  }

  const stops = trip.stops || [];
  const location = trip.location;
  const live = Boolean(location?.is_fresh && trip.trip_status === 'IN_PROGRESS');
  const destination = stops[stops.length - 1]?.name || 'Destination';
  const statusLabel = trip.trip_status === 'COMPLETED' ? 'Arrived safely' : trip.trip_status === 'IN_PROGRESS' ? 'On the way' : 'Preparing to depart';
  const embedMapUrl = live && location ? (() => {
    const lat = Number(location.latitude); const lon = Number(location.longitude);
    const params = new URLSearchParams({ bbox: `${lon - 0.012},${lat - 0.008},${lon + 0.012},${lat + 0.008}`, layer: 'mapnik', marker: `${lat},${lon}` });
    return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
  })() : '';
  const mapUrl = location ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(location.latitude))}&mlon=${encodeURIComponent(String(location.longitude))}#map=16/${encodeURIComponent(String(location.latitude))}/${encodeURIComponent(String(location.longitude))}` : '';

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5"><AppLogo size={34} /><div><p className="font-extrabold text-primary">Raahi</p><p className="text-[10px] text-muted-foreground">Shared trip · read only</p></div></div>
          <div className="hidden items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-primary sm:flex"><ShieldCheck size={14} /> Secure trip view</div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-5 sm:px-6 sm:py-7 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
        <div className="space-y-4">
          <section className="hero-surface overflow-hidden">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ShieldCheck size={16} className="text-amber-200" /><p className="text-xs font-bold uppercase tracking-wide text-amber-200">Shared by {trip.passenger_name}</p></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white">{statusLabel}</span></div>
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{trip.route_label || trip.route_code}</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/75">Follow this Raahi journey without signing in. This view cannot change the trip or booking.</p>
          </section>

          <section className="feature-card p-4 sm:p-5">
            <p className="section-label">Trip details</p>
            <div className="mt-4 space-y-4">
              <InfoRow icon={<User size={17} />} label="Raahi driver" value={trip.driver_name || 'Raahi driver'} />
              <InfoRow icon={<Car size={17} />} label="Vehicle" value={`${trip.vehicle_model || 'Raahi car'} · ${trip.vehicle_number || ''}`} />
              <InfoRow icon={<MapPin size={17} />} label="Pickup point" value={trip.pickup_point || 'Pickup point'} />
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><ShieldCheck size={18} className="text-primary" /></div>
              <div><p className="text-sm font-extrabold text-foreground">Private by design</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">This secure link shows only this trip. No phone numbers or Raahi booking history are shared.</p></div>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="overflow-hidden rounded-3xl border border-border bg-card card-shadow-sm">
            {embedMapUrl ? (
              <div className="relative h-64 bg-muted sm:h-80">
                <iframe title="Shared live driver location" src={embedMapUrl} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full border-0 saturate-[0.85] contrast-[0.96]" />
                <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-800 shadow-sm"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-green-600" /></span>Live driver location</div>
                {location?.accuracy_meters ? <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-card/95 px-2.5 py-1.5 text-[10px] font-bold shadow-sm">GPS ±{Math.round(location.accuracy_meters)} m</div> : null}
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center bg-muted/70 px-6 text-center"><div><LocateFixed size={26} className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-bold">Live GPS temporarily unavailable</p><p className="mt-1 text-xs text-muted-foreground">Route progress continues to refresh automatically.</p></div></div>
            )}
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${live ? 'bg-green-100' : 'bg-muted'}`}><LocateFixed size={18} className={live ? 'text-green-700' : 'text-muted-foreground'} /></div>
                <div className="min-w-0 flex-1"><p className="section-label">Live journey</p><p className="mt-1 text-base font-extrabold tracking-tight">{live ? `On the way to ${destination}` : statusLabel}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{live && location?.captured_at ? `Updated ${new Date(location.captured_at).toLocaleTimeString()}. This view refreshes automatically.` : 'Route progress below continues to update even when GPS is unavailable.'}</p></div>
              </div>
              {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="btn-outline w-full"><ExternalLink size={16} />Open live location on map</a>}
            </div>
          </section>

          <section className="feature-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="section-label">Journey progress</p><h2 className="mt-1 text-lg font-extrabold tracking-tight">Where the Raahi is now</h2></div>{trip.started_at && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 size={11} />Started {new Date(trip.started_at).toLocaleTimeString()}</span>}</div>
            <div className="mt-5 space-y-0">
              {stops.map((stop, index) => (
                <div key={`${stop.stop_order}-${stop.name}`} className="flex gap-3">
                  <div className="flex w-6 flex-col items-center"><div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${stop.is_current ? 'border-primary bg-secondary' : stop.is_passed ? 'border-primary bg-primary' : 'border-border bg-card'}`}>{stop.is_current && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}</div>{index < stops.length - 1 && <div className={`h-10 w-0.5 ${stop.is_passed ? 'bg-primary' : 'bg-border'}`} />}</div>
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pb-5"><div><p className={`text-sm font-semibold ${stop.is_current ? 'text-primary' : stop.is_passed ? 'text-muted-foreground' : 'text-foreground'}`}>{stop.name}</p>{stop.is_current && <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">Driver here now</p>}</div>{stop.is_passed && <span className="text-[10px] font-semibold text-muted-foreground">Passed</span>}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">{icon}</div>
      <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 truncate text-sm font-bold text-foreground">{value}</p></div>
    </div>
  );
}
