'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Car, ChevronRight, ArrowRight, Navigation, CheckCircle2, Loader2 } from 'lucide-react';
import { getActiveLocations, getRoutesForLocation, type Location, type RouteForLocation } from '@/lib/raahiApi';
import { createClient } from '@/lib/supabase/client';
import { RouteListSkeleton } from '@/components/ui/LoadingSkeleton';
import { useAuth } from '@/contexts/AuthContext';

export default function LocationContent() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<RouteForLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  // OAuth callbacks can fall back to the landing page on some hosting
  // redirects. Resume any authenticated passenger request saved before sign-in.
  useEffect(() => {
    if (authLoading || !user || profile?.role !== 'passenger') return;
    const tripId = localStorage.getItem('raahi_pending_trip_id');
    const stopId = localStorage.getItem('raahi_pending_stop_id');
    if (tripId && stopId) router.replace('/resume-seat-request');
  }, [authLoading, user, profile?.role, router]);

  // Load locations on mount
  useEffect(() => {
    getActiveLocations().then((data) => {
      setLocations(data);
      setLoadingLocations(false);
    });
  }, []);

  // Restore last selected location from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('raahi_last_location_id');
    if (saved) setSelectedLocationId(saved);
  }, []);

  // Load routes when location changes
  const loadRoutes = useCallback(async (locationId: string) => {
    setLoadingRoutes(true);
    const data = await getRoutesForLocation(locationId);
    setRoutes(data);
    setLoadingRoutes(false);
  }, []);

  useEffect(() => {
    if (selectedLocationId) loadRoutes(selectedLocationId);
  }, [selectedLocationId, loadRoutes]);

  // Realtime: subscribe to trips table changes → refetch routes
  useEffect(() => {
    if (!selectedLocationId) return;
    const supabase = createClient();
    const channel = supabase
      .channel('location_trips_watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        loadRoutes(selectedLocationId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedLocationId, loadRoutes]);

  const handleSelectLocation = (locId: string) => {
    setSelectedLocationId(locId);
    localStorage.setItem('raahi_last_location_id', locId);
    // Also store name for display
    const loc = locations.find((l) => l.id === locId);
    if (loc) localStorage.setItem('raahi_last_location_name', loc.name);
  };

  const selectedLoc = locations.find((l) => l.id === selectedLocationId);

  const goingFrom = routes.filter((r) => selectedLoc && r.from_location_name === selectedLoc.name);
  const comingTo = routes.filter((r) => selectedLoc && r.to_location_name === selectedLoc.name);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-5 space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 bg-secondary rounded-full px-4 py-1.5 mb-3">
          <Navigation size={14} className="text-primary" />
          <span className="text-sm font-semibold text-secondary-foreground">Shared Seats — Pay the Driver Directly</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Where are you?</h1>
        <p className="text-sm text-muted-foreground mt-1">Choose your location to see available rides</p>
      </div>

      {/* Location Cards */}
      {loadingLocations ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {locations.map((loc) => {
            const isSelected = selectedLocationId === loc.id;
            return (
              <button
                key={loc.id}
                onClick={() => handleSelectLocation(loc.id)}
                className={`relative flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? 'border-primary bg-secondary shadow-md'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-muted card-shadow'
                }`}
              >
                {isSelected && (
                  <CheckCircle2 size={16} className="absolute top-3 right-3 text-primary" />
                )}
                <MapPin size={28} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                <span className={`mt-2 text-base font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {loc.name}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">{loc.state}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Routes */}
      {selectedLoc && (
        <div className="space-y-5 animate-slide-up">
          {loadingRoutes ? (
            <RouteListSkeleton />
          ) : (
            <>
              {goingFrom.length > 0 && (
                <RouteGroup title={`Going from ${selectedLoc.name}`} routes={goingFrom} />
              )}
              {comingTo.length > 0 && (
                <RouteGroup title={`Coming to ${selectedLoc.name}`} routes={comingTo} />
              )}
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
  return (
    <div>
      <p className="section-label mb-3">{title}</p>
      <div className="space-y-2">
        {routes.map((route) => {
          const isCollecting = route.active_car_status === 'ACTIVE_COLLECTING';
          const isInProgress = route.active_car_status === 'IN_PROGRESS';
          const hasActiveCar = route.has_active_car;

          return (
            <Link
              key={route.route_id}
              href={`/active-car-screen?route_id=${route.route_id}`}
              className="flex items-center gap-4 card p-4 hover:border-primary/30 transition-all duration-150 active:scale-[0.99] group"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Car size={20} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">{route.route_code}</span>
                  {hasActiveCar && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isCollecting ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isCollecting ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`} />
                      {isCollecting ? 'Collecting' : 'In Transit'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm font-semibold text-foreground">{route.from_location_name}</span>
                  <ArrowRight size={12} className="text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">{route.to_location_name}</span>
                </div>
                {hasActiveCar && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isCollecting
                      ? `${route.available_seats} seat${route.available_seats !== 1 ? 's' : ''} available`
                      : 'Car en route — next car soon'}
                  </p>
                )}
                {!hasActiveCar && (
                  <p className="text-xs text-muted-foreground mt-0.5">No active car right now</p>
                )}
              </div>
              <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors duration-150" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}