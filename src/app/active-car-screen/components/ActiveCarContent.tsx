'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Car, User, CheckCircle2, Clock, MapPin, RefreshCw, Loader2, BellRing, X, CalendarClock } from 'lucide-react';
import { getPublicActiveCar, type ActiveCarPublic, type StopWithEta } from '@/lib/raahiApi';
import { cancelDemandIntent, createNowDemandIntent, getRouteDemandSummary, type RouteDemandSummary } from '@/lib/demandApi';
import { useAuth } from '@/contexts/AuthContext';
import UnifiedTripCard from '@/components/UnifiedTripCard';

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
    const result = await createNowDemandIntent(routeId, 30);
    setDemandBusy(false);
    if (!result.success || !result.intent_id) {
      toast.error(result.error || 'Could not save your ride request');
      return;
    }
    setIntentId(result.intent_id);
    setDemandSummary(await getRouteDemandSummary(routeId));
    toast.success('Raahi is now watching this route for you.');
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
    setIntentId(null);
    if (routeId) setDemandSummary(await getRouteDemandSummary(routeId));
    toast.success('Ride request cancelled.');
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div>;
  }

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
      <div className="max-w-screen-sm mx-auto px-4 py-8 space-y-4 animate-fade-in">
        <div className="rounded-3xl border border-border bg-card p-6 text-center card-shadow">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
            <Car size={22} className="text-primary" />
          </div>
          <p className="mt-4 text-lg font-bold text-foreground">No driver is available right now</p>
          <p className="mt-2 text-sm text-muted-foreground">Raahi can collect passenger interest and show drivers that this route needs a car.</p>

          {(interested > 0 || scheduled > 0) && (
            <div className="mt-4 rounded-2xl bg-secondary/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Route demand</p>
              {interested > 0 && <p className="mt-1 text-sm font-bold text-primary">{interested} passenger{interested === 1 ? '' : 's'} interested now</p>}
              {scheduled > 0 && <p className="mt-1 text-xs font-semibold text-foreground">{scheduled} upcoming travel plan{scheduled === 1 ? '' : 's'}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Interest does not reserve a seat. Booking starts only when a car becomes available.</p>
            </div>
          )}

          {intentId ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-left">
                <div className="flex items-start gap-2">
                  <BellRing size={17} className="mt-0.5 shrink-0 text-green-700" />
                  <div>
                    <p className="text-sm font-bold text-green-800">We’re checking with Raahi drivers</p>
                    <p className="mt-1 text-xs text-green-700">Keep this screen open and Raahi will check about every 15 seconds. You will still need to book explicitly when a car opens.</p>
                  </div>
                </div>
              </div>
              <button onClick={cancelDemand} disabled={demandBusy} className="quiet-action w-full text-red-600 hover:bg-red-50">
                {demandBusy ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} Cancel ride request
              </button>
            </div>
          ) : (
            <button onClick={createDemand} disabled={demandBusy} className="btn-primary mt-5 w-full">
              {demandBusy ? <Loader2 size={18} className="animate-spin" /> : <BellRing size={18} />}
              {demandBusy ? 'Saving request…' : user ? 'I need a ride' : 'Sign in & request a ride'}
            </button>
          )}

          {routeId && (
            <Link href={`/plan-ride?route_id=${routeId}`} className="quiet-action mt-2 w-full">
              <CalendarClock size={17} /> Plan a ride for later
            </Link>
          )}

          <button onClick={() => fetchCar(true)} className="btn-outline mx-auto mt-3">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh route
          </button>
        </div>
      </div>
    );
  }

  const isCollecting = car.status === 'ACTIVE_COLLECTING';
  const from = car.stops?.[0]?.name ?? 'Raahi pickup';
  const to = car.stops?.[(car.stops?.length ?? 1) - 1]?.name ?? 'Destination';
  const occupiedSeats = (car.confirmed_count ?? 0) + (car.held_count ?? 0);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-4 space-y-4 animate-fade-in">
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
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{car.driver_display_name}</p>
              <p className="text-xs text-muted-foreground">Your Raahi driver</p>
            </div>
          </div>
          <button onClick={() => fetchCar(true)} className="btn-outline px-3 py-2" aria-label="Refresh live ride">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </UnifiedTripCard>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Pickup Route</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin size={12} />
            <span>Driver at <strong className="text-foreground">{car.current_stop_name}</strong></span>
          </div>
        </div>
        <div className="space-y-0">
          {(car.stops ?? []).map((stop, idx) => <StopRow key={stop.stop_id} stop={stop} isLast={idx === (car.stops?.length ?? 0) - 1} />)}
        </div>
      </div>

      {isCollecting && (car.available_count ?? 0) > 0 ? (
        <Link href={`/request-seat-screen?route_id=${routeId}&trip_id=${car.trip_id}`} className="btn-primary w-full text-center">
          <Car size={18} /> Book Seat
        </Link>
      ) : isCollecting && (car.available_count ?? 0) === 0 ? (
        <div className="flex items-center justify-center gap-2 bg-muted rounded-2xl px-5 py-4 text-muted-foreground text-sm font-semibold">
          <CheckCircle2 size={18} /> Car is Full — Next car coming soon
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 bg-blue-50 rounded-2xl px-5 py-4 text-blue-700 text-sm font-semibold">
          <Car size={18} /> Car is En Route — Check back for next departure
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground pb-2">Live updates · Tap <RefreshCw size={10} className="inline" /> to refresh manually</p>
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
        <div>
          <p className={`text-sm font-semibold leading-tight ${stop.is_current ? 'text-primary' : stop.is_passed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{stop.name}</p>
          {stop.is_current && <span className="text-[10px] font-bold text-primary uppercase tracking-wide">Driver Here Now</span>}
          {stop.is_passed && !stop.is_current && <span className="text-[10px] text-muted-foreground">Passed</span>}
        </div>
        <div className="text-right">
          {stop.is_current && <span className="text-xs font-bold text-primary">Now</span>}
          {!stop.is_current && !stop.is_passed && stop.eta_minutes !== null && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock size={11} /><span>~{stop.eta_minutes} min</span></div>
          )}
        </div>
      </div>
    </div>
  );
}
