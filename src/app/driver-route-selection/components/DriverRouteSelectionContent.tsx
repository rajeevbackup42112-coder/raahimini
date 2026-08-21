'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock3, Loader2, MapPin, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { getRouteDemandSummary, type RouteDemandSummary } from '@/lib/demandApi';
import {
  getActiveLocations,
  getDriverDepartingRoutes,
  getDriverHomeContext,
  getRoutesForLocation,
  joinDriverQueue,
  leaveDriverQueue,
  type DriverDepartingRoute,
  type DriverHomeContext,
  type Location,
} from '@/lib/raahiApi';
import DriverRouteCard from './DriverRouteCard';

export default function DriverRouteSelectionContent() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [context, setContext] = useState<DriverHomeContext>({});
  const [locationId, setLocationId] = useState('');
  const [routes, setRoutes] = useState<DriverDepartingRoute[]>([]);
  const [demandByRoute, setDemandByRoute] = useState<Record<string, RouteDemandSummary>>({});
  const [returnDemandByRoute, setReturnDemandByRoute] = useState<Record<string, RouteDemandSummary>>({});
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

  const refreshContext = useCallback(async () => {
    const ctx = await getDriverHomeContext();
    setContext(ctx);
    if (ctx.has_active_trip) router.replace('/driver-active-car-screen');
  }, [router]);

  const loadRoutes = useCallback(async (selectedLocationId: string) => {
    const nextRoutes = await getDriverDepartingRoutes(selectedLocationId);
    setRoutes(nextRoutes);

    const summaries = await Promise.all(nextRoutes.map(route => getRouteDemandSummary(route.route_id)));
    setDemandByRoute(Object.fromEntries(summaries.map(summary => [summary.route_id, summary])));

    const returnEntries = await Promise.all(nextRoutes.map(async route => {
      const destinationRoutes = await getRoutesForLocation(route.to_location_id);
      const reverse = destinationRoutes.find(candidate =>
        candidate.from_location_name === route.to_location_name &&
        candidate.to_location_name === route.from_location_name
      );
      if (!reverse) return null;
      const summary = await getRouteDemandSummary(reverse.route_id);
      return [route.route_id, summary] as const;
    }));
    setReturnDemandByRoute(Object.fromEntries(returnEntries.filter((entry): entry is readonly [string, RouteDemandSummary] => Boolean(entry))));
  }, []);

  useEffect(() => {
    if (!authLoading && user && (profile?.role === 'driver' || profile?.role === 'admin')) load();
    else if (!authLoading) setLoading(false);
  }, [authLoading, user, profile?.role, load]);

  useEffect(() => {
    if (context.queue_status !== 'WAITING') return;
    const timer = window.setInterval(refreshContext, 7000);
    return () => window.clearInterval(timer);
  }, [context.queue_status, refreshContext]);

  useEffect(() => {
    if (!locationId || context.queue_status === 'WAITING') {
      setRoutes([]);
      setDemandByRoute({});
      setReturnDemandByRoute({});
      return;
    }
    localStorage.setItem('raahi_driver_location_id', locationId);
    loadRoutes(locationId);
  }, [locationId, context.queue_status, loadRoutes]);

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

  useEffect(() => {
    if (!user || profile?.role !== 'driver' || !locationId || context.queue_status === 'WAITING' || routes.length === 0) return;

    const routeById = new Map(routes.map(route => [route.route_id, route]));
    const supabase = createClient();
    const channel = supabase
      .channel(`driver_demand_notifications_${user.id}_${locationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'raahi_invalidation_events' }, async payload => {
        const event = payload.new as { route_id?: string; source_table?: string; event_kind?: string };
        if (event.source_table !== 'demand_notification' || !event.route_id || !event.event_kind) return;
        if (!['DEMAND_LOW', 'DEMAND_MEDIUM', 'DEMAND_HIGH', 'DEMAND_URGENCY'].includes(event.event_kind)) return;

        const route = routeById.get(event.route_id);
        if (!route || route.has_active_car) return;

        const summary = await getRouteDemandSummary(route.route_id);
        if (summary.now_count < 1) return;
        setDemandByRoute(previous => ({ ...previous, [route.route_id]: summary }));

        const passengerText = `${summary.now_count} passenger${summary.now_count === 1 ? '' : 's'} ${summary.now_count === 1 ? 'is' : 'are'} looking for ${route.from_location_name} -> ${route.to_location_name}.`;
        const message = event.event_kind === 'DEMAND_URGENCY' ? `Demand is getting more urgent. ${passengerText}` : passengerText;
        toast(message, {
          action: { label: 'Go Available', onClick: () => { void join(route); } },
        });
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [context.queue_status, locationId, profile?.role, routes, user]);

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
          <div className="w-12 h-12 rounded-2xl bg-secondary mx-auto flex items-center justify-center"><Clock3 size={22} className="text-primary" /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Driver Queue</p>
            <h1 className="text-xl font-bold mt-1">You are waiting</h1>
            <p className="text-sm text-muted-foreground mt-1">{context.queue_route_label}</p>
          </div>
          <div className="bg-muted rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">Queue position</p>
            <p className="text-3xl font-bold text-primary">#{context.queue_position ?? '—'}</p>
          </div>
          <p className="text-sm text-muted-foreground">This updates automatically. When your turn starts, Raahi will open your active car.</p>
          <div className="flex gap-2">
            <button className="btn-outline flex-1" onClick={refreshContext}><RefreshCw size={16}/>Refresh</button>
            <button className="btn-outline flex-1" disabled={leaving} onClick={leaveQueue}>{leaving ? <Loader2 size={16} className="animate-spin"/> : null}Leave Queue</button>
          </div>
        </div>
      </div>
    );
  }

  const selected = locations.find(l => l.id === locationId);

  return (
    <div className="mx-auto max-w-screen-lg space-y-5 px-4 py-5 sm:px-6">
      <div className="hero-surface">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-200">Driver home</p>
        <h1 className="mt-2 text-2xl font-extrabold text-white">{profile?.display_name ? `Ready, ${profile.display_name}?` : 'Ready to drive?'}</h1>
        <p className="mt-1 text-sm text-white/75">Choose where you are. Raahi will show your next action, outbound demand and possible return demand.</p>
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
            <button onClick={() => loadRoutes(locationId)} aria-label="Refresh routes"><RefreshCw size={15} className="text-muted-foreground" /></button>
          </div>
          <div className="space-y-3">
            {routes.length === 0 && <div className="card p-5 text-center text-sm text-muted-foreground">No active routes depart from {selected.name} right now.</div>}
            {routes.map(route => (
              <DriverRouteCard
                key={route.route_id}
                route={route}
                demand={demandByRoute[route.route_id]}
                returnDemand={returnDemandByRoute[route.route_id]}
                joining={joining === route.route_id}
                onJoin={() => join(route)}
              />
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
