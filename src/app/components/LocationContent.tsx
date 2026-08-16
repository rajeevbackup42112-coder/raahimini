'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, Car, ChevronRight, ArrowRight, Navigation, CheckCircle2 } from 'lucide-react';
import { LOCATIONS, ROUTES, MOCK_ACTIVE_CAR_GD01 } from '@/lib/mockData';
import { RouteListSkeleton } from '@/components/ui/LoadingSkeleton';


// BACKEND INTEGRATION POINT: Replace with get_routes_for_location(location_id) RPC

const ROUTE_SEAT_SUMMARY: Record<string, { available: number; status: 'ACTIVE_COLLECTING' | 'IN_PROGRESS' | null }> = {
  'route-gd01': { available: MOCK_ACTIVE_CAR_GD01.available_count, status: 'ACTIVE_COLLECTING' },
  'route-dg01': { available: 0, status: 'IN_PROGRESS' },
};

export default function LocationContent() {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('raahi_last_location');
    if (saved) setSelectedLocation(saved);
  }, []);

  const handleSelectLocation = (locId: string) => {
    setLoading(true);
    setSelectedLocation(locId);
    localStorage.setItem('raahi_last_location', locId);
    setTimeout(() => setLoading(false), 400);
  };

  const selectedLoc = LOCATIONS.find((l) => l.id === selectedLocation);

  const goingFrom = ROUTES.filter(
    (r) => selectedLoc && r.from_location === selectedLoc.name
  );
  const comingTo = ROUTES.filter(
    (r) => selectedLoc && r.to_location === selectedLoc.name
  );

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
      <div className="grid grid-cols-2 gap-3">
        {LOCATIONS.map((loc) => {
          const isSelected = selectedLocation === loc.id;
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
              <span className="text-xs text-muted-foreground mt-0.5">Jharkhand</span>
            </button>
          );
        })}
      </div>

      {/* Routes */}
      {selectedLoc && (
        <div className="space-y-5 animate-slide-up">
          {loading ? (
            <RouteListSkeleton />
          ) : (
            <>
              {goingFrom.length > 0 && (
                <RouteGroup
                  title={`Going from ${selectedLoc.name}`}
                  routes={goingFrom}
                  seatSummary={ROUTE_SEAT_SUMMARY}
                />
              )}
              {comingTo.length > 0 && (
                <RouteGroup
                  title={`Coming to ${selectedLoc.name}`}
                  routes={comingTo}
                  seatSummary={ROUTE_SEAT_SUMMARY}
                />
              )}
            </>
          )}
        </div>
      )}

      {!selectedLocation && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Car size={40} className="mx-auto mb-3 opacity-30" />
          <p>Select a location above to see available routes</p>
        </div>
      )}
    </div>
  );
}

function RouteGroup({
  title,
  routes,
  seatSummary,
}: {
  title: string;
  routes: typeof ROUTES;
  seatSummary: Record<string, { available: number; status: 'ACTIVE_COLLECTING' | 'IN_PROGRESS' | null }>;
}) {
  return (
    <div>
      <p className="section-label mb-3">{title}</p>
      <div className="space-y-2">
        {routes.map((route) => {
          const summary = seatSummary[route.id];
          const hasActiveCar = !!summary?.status;
          const isCollecting = summary?.status === 'ACTIVE_COLLECTING';

          return (
            <Link
              key={route.id}
              href="/active-car-screen"
              className="flex items-center gap-4 card p-4 hover:border-primary/30 transition-all duration-150 active:scale-[0.99] group"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Car size={20} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">{route.code}</span>
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
                  <span className="text-sm font-semibold text-foreground">{route.from_location}</span>
                  <ArrowRight size={12} className="text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">{route.to_location}</span>
                </div>
                {hasActiveCar && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isCollecting
                      ? `${summary.available} seat${summary.available !== 1 ? 's' : ''} available`
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