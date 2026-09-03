'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BellRing, Car, RotateCcw } from 'lucide-react';
import { getActiveLocations, getRoutesForLocation, getMyActiveRequest, type PassengerRideStatus, type RouteForLocation } from '@/lib/raahiApi';
import PassengerRouteCard from './PassengerRouteCard';
import { RouteListSkeleton } from '@/components/ui/LoadingSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { getMyActiveNowDemand } from '@/lib/demandApi';

export default function LocationContent() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [routes, setRoutes] = useState<RouteForLocation[]>([]);
  const [activeRequest, setActiveRequest] = useState<PassengerRideStatus | null>(null);
  const [recentTrip, setRecentTrip] = useState<PassengerRideStatus | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
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
    let alive = true;
    const loadCorridors = async () => {
      setLoadingRoutes(true);
      const locations = await getActiveLocations();
      const rows = await Promise.all(locations.map(async (location) => {
        const candidates = await getRoutesForLocation(location.id);
        return candidates.filter((route) => route.from_location_name === location.name);
      }));
      if (!alive) return;
      const unique = new Map<string, RouteForLocation>();
      rows.flat().forEach((route) => unique.set(route.route_id, route));
      setRoutes([...unique.values()].sort((a, b) => `${a.from_location_name}-${a.to_location_name}`.localeCompare(`${b.from_location_name}-${b.to_location_name}`)));
      setLoadingRoutes(false);
    };
    void loadCorridors();
    return () => { alive = false; };
  }, []);

  const recentFrom = recentTrip?.stops?.[0]?.name;
  const recentTo = recentTrip?.stops?.[(recentTrip?.stops?.length ?? 1) - 1]?.name;

  return (
    <div className="page-shell space-y-5 animate-fade-in">
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
              <h2 className="mt-1 text-base font-bold text-foreground">{watchedCarAvailable ? 'A Raahi car is available' : 'Raahi is watching this corridor'}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{watchedCarAvailable ? `${watchedSeatsAvailable} seat${watchedSeatsAvailable === 1 ? '' : 's'} available now. Nothing is booked until you choose a seat.` : 'You can continue using Raahi. This request will expire automatically if no car becomes available.'}</p>
            </div>
          </div>
          <div className={`mt-3 flex items-center justify-between rounded-2xl px-3 py-2.5 ${watchedCarAvailable ? 'bg-green-100/70' : 'bg-secondary/60'}`}><div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Next</p><p className={`text-sm font-bold ${watchedCarAvailable ? 'text-green-800' : 'text-primary'}`}>{watchedCarAvailable ? 'View car & book a seat' : 'Check this corridor'}</p></div><ArrowRight size={18} className={watchedCarAvailable ? 'text-green-700' : 'text-primary'} /></div>
        </button>
      )}

      {!activeRequest && !watchedRouteId && recentTrip?.repeat_route_id && recentFrom && recentTo && (
        <button onClick={() => router.push(`/active-car-screen?route_id=${recentTrip.repeat_route_id}`)} className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left card-shadow transition-all hover:border-primary/20 hover:shadow-md active:scale-[0.99]">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary"><RotateCcw size={18} className="text-primary" /></div>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Ride again</p><h2 className="mt-0.5 truncate text-sm font-bold text-foreground sm:text-base">{recentFrom} → {recentTo}</h2><p className="mt-0.5 truncate text-xs text-muted-foreground">Pickup · {recentTrip.pickup_stop_name}</p></div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary transition-transform group-hover:translate-x-0.5"><ArrowRight size={17} /></div>
        </button>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div><p className="section-label">Shared Ride · Published now</p><h2 className="mt-1 text-lg font-extrabold tracking-tight text-foreground">Current Shared Ride corridors</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Browse what is already published. For a new journey, use the From/To planner above and Raahi will choose the right travel flow.</p></div>
          <Car size={22} className="shrink-0 text-primary" />
        </div>
        {loadingRoutes ? <RouteListSkeleton /> : routes.length > 0 ? <div className="grid gap-3 lg:grid-cols-2">{routes.map((route) => <PassengerRouteCard key={route.route_id} route={route} />)}</div> : <div className="feature-card p-6 text-center text-sm text-muted-foreground">No Shared Ride corridors are published right now.</div>}
      </section>
    </div>
  );
}
