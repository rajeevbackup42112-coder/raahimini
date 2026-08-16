'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Car, ChevronRight, Clock3, Loader2, MapPin, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  getActiveLocations,
  getDriverDepartingRoutes,
  getDriverHomeContext,
  joinDriverQueue,
  leaveDriverQueue,
  type DriverDepartingRoute,
  type DriverHomeContext,
  type Location,
} from '@/lib/raahiApi';

export default function DriverRouteSelectionContent() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [context, setContext] = useState<DriverHomeContext>({});
  const [locationId, setLocationId] = useState('');
  const [routes, setRoutes] = useState<DriverDepartingRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [locs, ctx] = await Promise.all([getActiveLocations(), getDriverHomeContext()]);
    setLocations(locs);
    setContext(ctx);

    if (ctx.has_active_trip) {
      router.replace('/driver-active-car-screen');
      return;
    }

    const saved = localStorage.getItem('raahi_driver_location_id');
    const preferred = ctx.suggested_location_id || saved || locs[0]?.id || '';
    setLocationId(preferred);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (!authLoading && user && (profile?.role === 'driver' || profile?.role === 'admin')) load();
    else if (!authLoading) setLoading(false);
  }, [authLoading, user, profile?.role, load]);

  useEffect(() => {
    if (!locationId || context.queue_status === 'WAITING') {
      setRoutes([]);
      return;
    }
    localStorage.setItem('raahi_driver_location_id', locationId);
    getDriverDepartingRoutes(locationId).then(setRoutes);
  }, [locationId, context.queue_status]);

  const join = async (route: DriverDepartingRoute) => {
    setJoining(route.route_id);
    const result = await joinDriverQueue(route.route_id, locationId);
    setJoining(null);
    if (!result.success) {
      toast.error(result.error || 'Could not join queue');
      return;
    }

    const ctx = await getDriverHomeContext();
    setContext(ctx);
    if (ctx.has_active_trip) {
      toast.success(`You are now collecting on ${route.direction_label}`);
      router.push('/driver-active-car-screen');
    } else {
      toast.success(`Joined queue for ${route.direction_label}`);
    }
  };

  const leaveQueue = async () => {
    if (!context.queue_route_id) return;
    setLeaving(true);
    const result = await leaveDriverQueue(context.queue_route_id);
    setLeaving(false);
    if (!result.success) {
      toast.error(result.error || 'Could not leave queue');
      return;
    }
    toast.success('Left driver queue');
    await load();
  };

  if (authLoading || loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;
  if (!user) return <Access title="Driver Sign In Required" text="Sign in with your driver account to choose a route." />;
  if (profile?.role !== 'driver' && profile?.role !== 'admin') return <Access title="Driver Access Only" text="This screen is only available to registered drivers." />;

  if (context.queue_status === 'WAITING') {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-8 space-y-4">
        <div className="card p-5 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-secondary mx-auto flex items-center justify-center">
            <Clock3 size={22} className="text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Driver Queue</p>
            <h1 className="text-xl font-bold mt-1">You are waiting</h1>
            <p className="text-sm text-muted-foreground mt-1">{context.queue_route_label}</p>
          </div>
          <div className="bg-muted rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">Queue position</p>
            <p className="text-3xl font-bold text-primary">#{context.queue_position ?? '—'}</p>
          </div>
          <p className="text-sm text-muted-foreground">Raahi will move you to the active car automatically when your turn starts.</p>
          <div className="flex gap-2">
            <button className="btn-outline flex-1" onClick={load}><RefreshCw size={16}/>Refresh</button>
            <button className="btn-outline flex-1" disabled={leaving} onClick={leaveQueue}>{leaving?<Loader2 size={16} className="animate-spin"/>:null}Leave Queue</button>
          </div>
        </div>
      </div>
    );
  }

  const selected = locations.find(l => l.id === locationId);

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-5 space-y-5">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Driver</p>
        <h1 className="text-xl font-bold text-foreground">Where are you now?</h1>
        <p className="text-sm text-muted-foreground mt-1">Choose your current location. Raahi will show only routes departing from there.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {locations.map(loc => (
          <button key={loc.id} onClick={() => setLocationId(loc.id)} className={`card p-4 text-left border-2 ${locationId === loc.id ? 'border-primary bg-secondary/40' : 'border-transparent'}`}>
            <MapPin size={18} className="text-primary mb-2" />
            <p className="font-bold text-sm">{loc.name}</p>
            <p className="text-xs text-muted-foreground">I am here</p>
          </button>
        ))}
      </div>

      {selected && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="section-label">Going from {selected.name}</p>
            <button onClick={() => getDriverDepartingRoutes(locationId).then(setRoutes)} aria-label="Refresh routes"><RefreshCw size={15} className="text-muted-foreground" /></button>
          </div>
          <div className="space-y-2">
            {routes.length === 0 && <div className="card p-5 text-center text-sm text-muted-foreground">No active routes depart from {selected.name} right now.</div>}
            {routes.map(route => (
              <button key={route.route_id} disabled={!!joining} onClick={() => join(route)} className="card p-4 w-full text-left flex items-center gap-3 active:scale-[.99] transition-transform">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center"><Car size={18} className="text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{route.from_location_name} → {route.to_location_name}</p>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users size={12}/>{route.waiting_drivers} waiting</span>
                    <span>{route.has_active_car ? 'Car collecting now' : 'You can become active now'}</span>
                  </div>
                </div>
                {joining === route.route_id ? <Loader2 size={18} className="animate-spin"/> : <ChevronRight size={18} className="text-muted-foreground"/>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Access({title,text}:{title:string;text:string}) {
  return <div className="max-w-screen-sm mx-auto px-4 py-12 text-center space-y-3"><ShieldCheck size={40} className="mx-auto text-muted-foreground opacity-40"/><p className="font-semibold">{title}</p><p className="text-sm text-muted-foreground">{text}</p></div>;
}
