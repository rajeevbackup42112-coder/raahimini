'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Car, Navigation, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { getActiveLocations, getRoutesForLocation, getMyActiveRequest, type Location, type RouteForLocation, type PassengerRideStatus } from '@/lib/raahiApi';
import PassengerRouteCard from './PassengerRouteCard';
import { RouteListSkeleton } from '@/components/ui/LoadingSkeleton';
import { useAuth } from '@/contexts/AuthContext';

export default function LocationContent() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<RouteForLocation[]>([]);
  const [activeRequest, setActiveRequest] = useState<PassengerRideStatus | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  useEffect(() => {
    if (authLoading || !user || profile?.role !== 'passenger') return;
    const tripId = localStorage.getItem('raahi_pending_trip_id');
    const stopId = localStorage.getItem('raahi_pending_stop_id');
    if (tripId && stopId) router.replace('/resume-seat-request');
  }, [authLoading, user, profile?.role, router]);

  useEffect(() => {
    if (authLoading || !user || profile?.role !== 'passenger') {
      setActiveRequest(null);
      return;
    }
    let alive = true;
    getMyActiveRequest().then((request) => {
      if (!alive) return;
      setActiveRequest(request?.has_active_request ? request : null);
    });
    return () => { alive = false; };
  }, [authLoading, user, profile?.role]);

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
  const comingTo = routes.filter((r) => selectedLoc && r.to_location_name === selectedLoc.name);

  return (
    <div className="page-shell space-y-6 animate-fade-in">
      <div className="hero-surface">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5">
          <Navigation size={14} className="text-primary" />
          <span className="text-xs font-bold text-primary">Clear fare · No platform fee</span>
        </div>
        <h1 className="mt-4 text-2xl font-extrabold text-white">
          {user && profile?.display_name ? `Hi, ${profile.display_name}` : 'Find your Raahi'}
        </h1>
        <p className="mt-1 text-sm text-white/75">
          {activeRequest ? 'Your current ride is live below. Raahi will keep the next step clear.' : 'Choose where you are. Raahi will show the clearest live ride option first.'}
        </p>
        {selectedLoc && !activeRequest && <p className="mt-3 text-xs font-semibold text-amber-200">Your current choice: {selectedLoc.name}</p>}
      </div>

      {activeRequest && (
        <button
          onClick={() => router.push('/request-status-screen')}
          className="feature-card w-full text-left active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-primary">My Raahi · Live now</p>
              <h2 className="mt-1 text-lg font-bold text-foreground">
                {activeRequest.seat_count} seat{activeRequest.seat_count === 1 ? '' : 's'} · {activeRequest.pickup_stop_name}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeRequest.status === 'CONFIRMED' ? 'Seat confirmed' : 'Seat held'} · {activeRequest.driver_display_name} · {activeRequest.vehicle_number}
              </p>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-primary">
              {activeRequest.trip_status === 'IN_PROGRESS' ? 'Trip started' : 'Active'}
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-secondary/60 px-3 py-2.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Next</p>
              <p className="text-sm font-bold text-primary">View live ride status</p>
            </div>
            <ArrowRight size={18} className="text-primary" />
          </div>
        </button>
      )}

      {loadingLocations ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {locations.map((loc) => {
            const isSelected = selectedLocationId === loc.id;
            return (
              <button
                key={loc.id}
                onClick={() => handleSelectLocation(loc.id)}
                className={`relative flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all duration-200 active:scale-95 ${isSelected ? 'border-primary bg-secondary shadow-md' : 'border-border bg-card hover:border-primary/40 hover:bg-muted card-shadow'}`}
              >
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
        <div className="space-y-5 animate-slide-up">
          {loadingRoutes ? <RouteListSkeleton /> : (
            <>
              {goingFrom.length > 0 && <RouteGroup title={`Going from ${selectedLoc.name}`} routes={goingFrom} />}
              {comingTo.length > 0 && <RouteGroup title={`Coming to ${selectedLoc.name}`} routes={comingTo} />}
              {routes.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <Car size={32} className="mx-auto mb-2 opacity-30" />
                  <p>No routes available for this location yet</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!selectedLocationId && !loadingLocations && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Car size={40} className="mx-auto mb-3 opacity-30" />
          <p>Select a location above to see available routes</p>
        </div>
      )}
    </div>
  );
}

function RouteGroup({ title, routes }: { title: string; routes: RouteForLocation[] }) {
  const sorted = [...routes].sort((a, b) => Number(b.has_active_car) - Number(a.has_active_car));
  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="section-label">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">Live availability, clear fare and what happens next.</p>
        </div>
      </div>
      <div className="space-y-3">
        {sorted.map((route) => <PassengerRouteCard key={route.route_id} route={route} />)}
      </div>
    </div>
  );
}
