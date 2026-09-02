'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Car, Navigation, CheckCircle2, Loader2, ArrowRight, RotateCcw, BellRing } from 'lucide-react';
import { getActiveLocations, getRoutesForLocation, getMyActiveRequest, type Location, type RouteForLocation, type PassengerRideStatus } from '@/lib/raahiApi';
import PassengerRouteCard from './PassengerRouteCard';
import { RouteListSkeleton } from '@/components/ui/LoadingSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { getMyActiveNowDemand } from '@/lib/demandApi';

export default function LocationContent() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<RouteForLocation[]>([]);
  const [activeRequest, setActiveRequest] = useState<PassengerRideStatus | null>(null);
  const [recentTrip, setRecentTrip] = useState<PassengerRideStatus | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [watchedRouteId, setWatchedRouteId] = useState<string | null>(null);
  const [watchedCarAvailable, setWatchedCarAvailable] = useState(false);
  const [watchedSeatsAvailable, setWatchedSeatsAvailable] = useState(0);

  useEffect(() => {
    if (authLoading || !user || profile?.role !== 'passenger') return;
    const tripId = localStorage.getItem('raahi_pending_trip_id');
    const stopId = localStorage.getItem('raahi_pending_stop_id');
    if (tripId && stopId) router.replace('/resume-seat-request');
  }, [authLoading, user, profile?.role, router]);

  useEffect(() => {
    if (authLoading || !user || profile?.role !== 'passenger') {
      setActiveRequest(null);
      setRecentTrip(null);
      return;
    }
    let alive = true;
    getMyActiveRequest().then((request) => {
      if (!alive) return;
      setActiveRequest(request?.has_active_request ? request : null);
      setRecentTrip(!request?.has_active_request && request?.has_completed_trip ? request : null);
    });
    return () => { alive = false; };
  }, [authLoading, user, profile?.role]);

  useEffect(() => {
    if (authLoading || !user?.id || profile?.role !== 'passenger' || activeRequest) {
      setWatchedRouteId(null);
      setWatchedCarAvailable(false);
      setWatchedSeatsAvailable(0);
      return;
    }
    let alive = true;
    const refreshWatch = async () => {
      const demand = await getMyActiveNowDemand();
      if (!alive) return;
      if (!demand.has_active_demand || !demand.route_id) {
        setWatchedRouteId(null);
        setWatchedCarAvailable(false);
        setWatchedSeatsAvailable(0);
        return;
      }
      setWatchedRouteId(demand.route_id);
      setWatchedCarAvailable(Boolean(demand.supply_present));
      setWatchedSeatsAvailable(demand.available_count ?? 0);
    };
    void refreshWatch();
    const timer = window.setInterval(() => { void refreshWatch(); }, 15000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [authLoading, user?.id, profile?.role, activeRequest]);

  useEffect(() => {
    getActiveLocations().then((data) => {
      setLocations(data);
      setLoadingLocations(false);
    });
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('raahi_last_location_id');
    if (saved) setSelectedLocationId(saved);
  }, []);

  const loadRoutes = useCallback(async (locationId: string) => {
    setLoadingRoutes(true);
    const data = await getRoutesForLocation(locationId);
    setRoutes(data);
    setLoadingRoutes(false);
  }, []);

  useEffect(() => {
    if (selectedLocationId) loadRoutes(selectedLocationId);
  }, [selectedLocationId, loadRoutes]);

  const handleSelectLocation = (locId: string) => {
    setSelectedLocationId(locId);
    localStorage.setItem('raahi_last_location_id', locId);
    const loc = locations.find((l) => l.id === locId);
    if (loc) localStorage.setItem('raahi_last_location_name', loc.name);
  };

  const selectedLoc = locations.find((l) => l.id === selectedLocationId);
  const goingFrom = routes.filter((r) => selectedLoc && r.from_location_name === selectedLoc.name);
  const recentFrom = recentTrip?.stops?.[0]?.name;
  const recentTo = recentTrip?.stops?.[(recentTrip?.stops?.length ?? 1) - 1]?.name;

  return (
    <div className="page-shell space-y-6 animate-fade-in">
      <div className="hero-surface">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow-sm ring-1 ring-white/20">
          <Navigation size={14} className="text-primary" />
          <span className="text-xs font-bold text-primary">Clear fare · Pay the driver directly</span>
        </div>
        <p className="mt-5 text-sm font-semibold text-white/70">{user && profile?.display_name ? `Hi, ${profile.display_name}` : 'Welcome to Raahi'}</p>
        <h1 className="mt-1 max-w-xl text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {activeRequest ? 'Your Raahi is moving.' : 'Where are you travelling today?'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
          {activeRequest ? 'Your current ride is live below. We’ll keep the next step clear.' : 'Choose where you are. We’ll surface the clearest live ride option first.'}
        </p>
      </div>

      {activeRequest && (
        <button onClick={() => router.push('/request-status-screen')} className="feature-card w-full text-left active:scale-[0.99]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-primary">My Raahi · Live now</p>
              <h2 className="mt-1 text-lg font-bold text-foreground">{activeRequest.seat_count} seat{activeRequest.seat_count === 1 ? '' : 's'} · {activeRequest.pickup_stop_name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{activeRequest.status === 'CONFIRMED' ? 'Seat confirmed' : 'Seat held'} · {activeRequest.driver_display_name} · {activeRequest.vehicle_number}</p>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-primary">{activeRequest.trip_status === 'IN_PROGRESS' ? 'Trip started' : 'Active'}</span>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-secondary/60 px-3 py-2.5">
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Next</p><p className="text-sm font-bold text-primary">View live ride status</p></div>
            <ArrowRight size={18} className="text-primary" />
          </div>
        </button>
      )}

      {!activeRequest && watchedRouteId && (
        <button onClick={() => router.push(`/active-car-screen?route_id=${watchedRouteId}`)} className={`feature-card w-full text-left active:scale-[0.99] ${watchedCarAvailable ? 'border-green-200 bg-green-50' : ''}`}>
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${watchedCarAvailable ? 'bg-green-100' : 'bg-secondary'}`}><BellRing size={18} className={watchedCarAvailable ? 'text-green-700' : 'text-primary'} /></div>
            <div className="min-w-0 flex-1">
              <p className={`text-[11px] font-bold uppercase tracking-wide ${watchedCarAvailable ? 'text-green-700' : 'text-primary'}`}>My Raahi · Ride request</p>
              <h2 className="mt-1 text-base font-bold text-foreground">{watchedCarAvailable ? 'A Raahi car is available' : 'Raahi is watching this route'}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{watchedCarAvailable ? `${watchedSeatsAvailable} seat${watchedSeatsAvailable === 1 ? '' : 's'} available now. Nothing is booked until you choose a seat.` : 'You can continue using Raahi. This request will expire automatically if no car becomes available.'}</p>
            </div>
          </div>
          <div className={`mt-3 flex items-center justify-between rounded-2xl px-3 py-2.5 ${watchedCarAvailable ? 'bg-green-100/70' : 'bg-secondary/60'}`}><div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Next</p><p className={`text-sm font-bold ${watchedCarAvailable ? 'text-green-800' : 'text-primary'}`}>{watchedCarAvailable ? 'View car & book a seat' : 'Check this route'}</p></div><ArrowRight size={18} className={watchedCarAvailable ? 'text-green-700' : 'text-primary'} /></div>
        </button>
      )}

      {!activeRequest && !watchedRouteId && recentTrip?.repeat_route_id && recentFrom && recentTo && (
        <button onClick={() => router.push(`/active-car-screen?route_id=${recentTrip.repeat_route_id}`)} className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left card-shadow transition-all hover:border-primary/20 hover:shadow-md active:scale-[0.99]">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary"><RotateCcw size={18} className="text-primary" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Ride again</p>
            <h2 className="mt-0.5 truncate text-sm font-bold text-foreground sm:text-base">{recentFrom} → {recentTo}</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">Pickup · {recentTrip.pickup_stop_name}</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary transition-transform group-hover:translate-x-0.5"><ArrowRight size={17} /></div>
        </button>
      )}

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="section-label">Start here</p>
          <h2 className="mt-1 text-lg font-extrabold tracking-tight text-foreground">Where are you now?</h2>
        </div>
        {selectedLoc && <p className="text-xs font-semibold text-primary">{selectedLoc.name} selected</p>}
      </div>

      {loadingLocations ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {locations.map((loc) => {
            const isSelected = selectedLocationId === loc.id;
            return (
              <button key={loc.id} onClick={() => handleSelectLocation(loc.id)} className={`relative flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all duration-200 active:scale-95 ${isSelected ? 'border-primary bg-secondary shadow-md' : 'border-border bg-card hover:border-primary/40 hover:bg-muted card-shadow'}`}>
                {isSelected && <CheckCircle2 size={16} className="absolute top-3 right-3 text-primary" />}
                <MapPin size={28} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                <span className={`mt-2 text-base font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>{loc.name}</span>
                <span className="text-xs text-muted-foreground mt-0.5">{loc.state}</span>
              </button>
            );
          })}
        </div>
      )}

      {selectedLoc && (
        <div className="grid gap-5 animate-slide-up lg:grid-cols-2">
          {loadingRoutes ? <div className="lg:col-span-2"><RouteListSkeleton /></div> : (
            <>
              {goingFrom.length > 0 && <RouteGroup title={`From ${selectedLoc.name}`} routes={goingFrom} />}
              {goingFrom.length === 0 && <div className="text-center py-6 text-muted-foreground text-sm"><Car size={32} className="mx-auto mb-2 opacity-30" /><p>No Shared Ride routes depart from this location yet.</p></div>}
            </>
          )}
        </div>
      )}

      {!selectedLocationId && !loadingLocations && <div className="text-center py-8 text-muted-foreground text-sm"><Car size={40} className="mx-auto mb-3 opacity-30" /><p>Select a location above to see available routes</p></div>}
    </div>
  );
}

function RouteGroup({ title, routes }: { title: string; routes: RouteForLocation[] }) {
  const sorted = [...routes].sort((a, b) => Number(b.has_active_car) - Number(a.has_active_car));
  return <section><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-extrabold tracking-tight text-foreground">{title}</h3><p className="text-[11px] font-semibold text-muted-foreground">Live availability</p></div><div className="space-y-3">{sorted.map((route) => <PassengerRouteCard key={route.route_id} route={route} />)}</div></section>;
}
