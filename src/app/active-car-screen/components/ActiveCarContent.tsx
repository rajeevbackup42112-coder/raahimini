'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Car, User, CheckCircle2, Clock, MapPin, RefreshCw, Loader2, BellRing, X, CalendarClock } from 'lucide-react';
import { getPublicActiveCar, type ActiveCarPublic, type StopWithEta } from '@/lib/raahiApi';
import { cancelDemandIntent, createNowDemandIntent, getMyActiveNowDemand, getRouteDemandSummary, type RouteDemandSummary } from '@/lib/demandApi';
import { useAuth } from '@/contexts/AuthContext';
import UnifiedTripCard from '@/components/UnifiedTripCard';
import { clearDemandWatch, saveDemandWatch } from '@/lib/demandWatch';

const WAIT_OPTIONS = [15, 30, 60] as const;

export default function ActiveCarContent() {
  const searchParams = useSearchParams();
  const routeId = searchParams.get('route_id');
  const { user, profile, signInWithGoogle } = useAuth();
  const [car, setCar] = useState<ActiveCarPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demandSummary, setDemandSummary] = useState<RouteDemandSummary | null>(null);
  const [demandBusy, setDemandBusy] = useState(false);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [waitTolerance, setWaitTolerance] = useState<number>(30);

  const fetchCar = useCallback(async (showRefreshing = false) => {
    if (!routeId) {
      setError('No route selected. Go back and choose a route.');
      setLoading(false);
      return;
    }
    if (showRefreshing) setRefreshing(true);
    const data = await getPublicActiveCar(routeId);
    setCar(data);
    if (!data.has_active_car) setDemandSummary(await getRouteDemandSummary(routeId));
    setLoading(false);
    setRefreshing(false);
  }, [routeId]);

  useEffect(() => { fetchCar(); }, [fetchCar]);

  useEffect(() => {
    if (!routeId || !user?.id || profile?.role !== 'passenger') return;
    let alive = true;
    getMyActiveNowDemand().then((demand) => {
      if (!alive) return;
      const matchesRoute = demand.has_active_demand && demand.route_id === routeId && demand.intent_id;
      setIntentId(matchesRoute ? demand.intent_id! : null);
      if (matchesRoute && demand.wait_tolerance_minutes) setWaitTolerance(demand.wait_tolerance_minutes);
    });
    return () => { alive = false; };
  }, [routeId, user?.id, profile?.role]);

  useEffect(() => {
    if (!intentId) return;
    const timer = window.setInterval(() => { fetchCar(); }, 15000);
    return () => window.clearInterval(timer);
  }, [intentId, fetchCar]);

  const createDemand = async () => {
    if (!routeId) return;
    if (!user) {
      await signInWithGoogle(`/active-car-screen?route_id=${routeId}`);
      return;
    }
    if (profile?.role !== 'passenger') {
      toast.error('Demand requests are available to passenger accounts.');
      return;
    }
    setDemandBusy(true);
    const result = await createNowDemandIntent(routeId, waitTolerance);
    setDemandBusy(false);
    if (!result.success || !result.intent_id) {
      toast.error(result.error || 'Could not save your ride request');
      return;
    }
    setIntentId(result.intent_id);
    saveDemandWatch(user.id, routeId, result.intent_id, waitTolerance);
    setDemandSummary(await getRouteDemandSummary(routeId));
    toast.success(`Raahi will watch this route for up to ${waitTolerance} minutes.`);
  };

  const cancelDemand = async () => {
    if (!intentId) return;
    setDemandBusy(true);
    const result = await cancelDemandIntent(intentId);
    setDemandBusy(false);
    if (!result.success) {
      toast.error(result.error || 'Could not cancel ride request');
      return;
    }
    if (user?.id) clearDemandWatch(user.id, intentId);
    setIntentId(null);
    if (routeId) setDemandSummary(await getRouteDemandSummary(routeId));
    toast.success('Ride request cancelled.');
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div>;

  if (error) {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 py-8 text-center">
        <Car size={40} className="mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link href="/" className="btn-primary mt-4 inline-flex">Choose Route</Link>
      </div>
    );
  }

  if (!car?.has_active_car) {
    const interested = demandSummary?.now_count ?? 0;
    const scheduled = demandSummary?.scheduled_count ?? 0;
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 animate-fade-in">
        <section className="overflow-hidden rounded-3xl border border-border bg-card card-shadow-md">
          <div className="bg-gradient-to-br from-secondary via-card to-card px-5 py-6 sm:px-7 sm:py-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-sm"><Car size={21} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Route availability</p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">No car is collecting yet</h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Tell Raahi how long you can wait. We’ll keep this route on your radar while you continue with your day.</p>
              </div>
            </div>
            {(interested > 0 || scheduled > 0) && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-white px-3 py-1.5 text-xs font-semibold text-primary shadow-sm">
                <BellRing size={13} />
                {interested > 0 ? `${interested} waiting now` : ''}{interested > 0 && scheduled > 0 ? ' · ' : ''}{scheduled > 0 ? `${scheduled} planning later` : ''}
              </div>
            )}
          </div>

          <div className="border-t border-border p-5 sm:p-7">
            {intentId ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-100"><BellRing size={17} className="text-green-700" /></div>
                    <div><p className="text-sm font-bold text-green-900">Raahi is watching this route</p><p className="mt-1 text-xs leading-relaxed text-green-800">For up to {waitTolerance} minutes. You can leave this screen. You still need to book explicitly when a car opens.</p></div>
                  </div>
                </div>
                <button onClick={cancelDemand} disabled={demandBusy} className="quiet-action w-full text-red-600 hover:bg-red-50">{demandBusy ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} Stop watching this route</button>
              </div>
            ) : (
              <div>
                <div className="flex items-end justify-between gap-3">
                  <div><p className="section-label">Your wait window</p><h2 className="mt-1 text-lg font-extrabold tracking-tight text-foreground">How long can you wait?</h2></div>
                  <span className="text-xs font-bold text-primary">Up to {waitTolerance} min</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {WAIT_OPTIONS.map((minutes) => (
                    <button key={minutes} type="button" onClick={() => setWaitTolerance(minutes)} className={`rounded-2xl border px-3 py-3 text-sm font-bold transition-all active:scale-95 ${waitTolerance === minutes ? 'border-primary bg-secondary text-primary brand-ring' : 'border-border bg-card text-foreground hover:border-primary/30'}`}>{minutes} min</button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Your wait time helps drivers read demand urgency. <strong className="font-semibold text-foreground">It never changes FIFO.</strong></p>
                <button onClick={createDemand} disabled={demandBusy} className="btn-primary mt-5 w-full py-3.5">
                  {demandBusy ? <Loader2 size={18} className="animate-spin" /> : <BellRing size={18} />}
                  {demandBusy ? 'Saving request…' : user ? 'Watch this route' : 'Sign in & watch this route'}
                </button>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">Watching does not reserve a seat. You choose and book only after a car opens.</p>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border pt-5">
              {routeId && <Link href={`/plan-ride?route_id=${routeId}`} className="btn-outline px-3 py-2.5 text-sm"><CalendarClock size={16} /> Plan for later</Link>}
              <button onClick={() => fetchCar(true)} className="btn-outline px-3 py-2.5 text-sm"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh</button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const isCollecting = car.status === 'ACTIVE_COLLECTING';
  const from = car.stops?.[0]?.name ?? 'Raahi pickup';
  const to = car.stops?.[(car.stops?.length ?? 1) - 1]?.name ?? 'Destination';
  const occupiedSeats = (car.confirmed_count ?? 0) + (car.held_count ?? 0);

  return (
    <div className="page-shell space-y-4 animate-fade-in">
      {intentId && isCollecting && (car.available_count ?? 0) > 0 && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <BellRing size={18} className="mt-0.5 shrink-0 text-green-700" />
            <div><p className="text-sm font-bold text-green-900">A Raahi car is available</p><p className="mt-1 text-xs text-green-800">You asked Raahi to watch this route. Nothing is booked yet.</p></div>
          </div>
        </div>
      )}
      <UnifiedTripCard
        from={from}
        to={to}
        statusLabel={isCollecting ? 'Collecting now' : 'Trip started'}
        statusTone={isCollecting ? ((car.available_count ?? 0) <= 1 ? 'limited' : 'good') : 'transit'}
        vehicleLabel={`${car.vehicle_model ?? 'Raahi car'}${car.vehicle_number ? ` · ${car.vehicle_number}` : ''}`}
        seatsFilled={occupiedSeats}
        seatsTotal={car.capacity ?? 0}
        seatsLeft={car.available_count ?? 0}
        farePerSeat={car.fare_per_seat ?? null}
        pickupLabel={car.current_stop_name}
        confidenceLabel={isCollecting ? ((car.available_count ?? 0) <= 1 ? 'Likely to leave soon' : 'Seats available now') : 'Car is on the way'}
      >
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary"><User size={16} className="text-primary" /></div>
            <div className="min-w-0"><p className="truncate text-sm font-bold text-foreground">{car.driver_display_name}</p><p className="text-xs text-muted-foreground">Your Raahi driver</p></div>
          </div>
          <button onClick={() => fetchCar(true)} className="btn-outline px-3 py-2" aria-label="Refresh live ride"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh</button>
        </div>
      </UnifiedTripCard>

      <details className="card p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="text-sm font-bold text-foreground">Route details</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} /> {car.current_stop_name}</span>
        </summary>
        <div className="mt-4 space-y-0 border-t border-border pt-4">{(car.stops ?? []).map((stop, idx) => <StopRow key={stop.stop_id} stop={stop} isLast={idx === (car.stops?.length ?? 0) - 1} />)}</div>
      </details>

      {isCollecting && (car.available_count ?? 0) > 0 ? (
        <Link href={`/request-seat-screen?route_id=${routeId}&trip_id=${car.trip_id}`} className="btn-primary w-full text-center"><Car size={18} /> Book Seat</Link>
      ) : isCollecting && (car.available_count ?? 0) === 0 ? (
        <div className="flex items-center justify-center gap-2 bg-muted rounded-2xl px-5 py-4 text-muted-foreground text-sm font-semibold"><CheckCircle2 size={18} /> Car is Full — Next car coming soon</div>
      ) : (
        <div className="flex items-center justify-center gap-2 bg-blue-50 rounded-2xl px-5 py-4 text-blue-700 text-sm font-semibold"><Car size={18} /> Car is En Route — Check back for next departure</div>
      )}

    </div>
  );
}

function StopRow({ stop, isLast }: { stop: StopWithEta; isLast: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center w-5 flex-shrink-0">
        <div className={stop.is_current ? 'stop-dot-active' : stop.is_passed ? 'stop-dot-passed' : 'stop-dot-upcoming'} />
        {!isLast && <div className={stop.is_passed ? 'stop-line-passed' : 'stop-line'} />}
      </div>
      <div className={`flex-1 flex items-start justify-between pb-4 ${isLast ? 'pb-0' : ''}`}>
        <div><p className={`text-sm font-semibold leading-tight ${stop.is_current ? 'text-primary' : stop.is_passed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{stop.name}</p>{stop.is_current && <span className="text-[10px] font-bold text-primary uppercase tracking-wide">Driver Here Now</span>}{stop.is_passed && !stop.is_current && <span className="text-[10px] text-muted-foreground">Passed</span>}</div>
        <div className="text-right">{stop.is_current && <span className="text-xs font-bold text-primary">Now</span>}{!stop.is_current && !stop.is_passed && stop.eta_minutes !== null && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock size={11} /><span>~{stop.eta_minutes} min</span></div>}</div>
      </div>
    </div>
  );
}
