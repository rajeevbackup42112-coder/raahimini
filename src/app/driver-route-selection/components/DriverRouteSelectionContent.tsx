'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
  getMyDriverRoutePreferences,
  joinDriverQueue,
  leaveDriverQueue,
  setMyDriverRoutePreference,
  type DriverDepartingRoute,
  type DriverHomeContext,
  type DriverRoutePreference,
  type Location,
} from '@/lib/raahiApi';
import DriverRouteCard from './DriverRouteCard';
import { useLegalAcceptanceGate } from '@/components/legal/LegalAcceptanceGate';
import { useRegulatoryLaunchGate } from '@/components/launch/RegulatoryLaunchGate';
import { getMyDriverLaunchCompliance } from '@/lib/driverComplianceApi';

export default function DriverRouteSelectionContent() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { guard: guardLegal, dialog: legalDialog } = useLegalAcceptanceGate('driver');
  const { guard: guardLaunch, dialog: launchDialog } = useRegulatoryLaunchGate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [context, setContext] = useState<DriverHomeContext>({});
  const [locationId, setLocationId] = useState('');
  const [routes, setRoutes] = useState<DriverDepartingRoute[]>([]);
  const [preferences, setPreferences] = useState<DriverRoutePreference[]>([]);
  const [demandByRoute, setDemandByRoute] = useState<Record<string, RouteDemandSummary>>({});
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [preferenceBusy, setPreferenceBusy] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [launchCompliant, setLaunchCompliant] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [locs, ctx, prefs] = await Promise.all([getActiveLocations(), getDriverHomeContext(), getMyDriverRoutePreferences()]);
    setLocations(locs);
    setContext(ctx);
    setPreferences(prefs);
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

  }, []);

  useEffect(() => {
    if (!authLoading && user && (profile?.role === 'driver' || profile?.role === 'admin')) {
      if (profile?.role === 'driver') void getMyDriverLaunchCompliance().then(c => setLaunchCompliant(Boolean(c.launch_compliant))).catch(() => setLaunchCompliant(false));
      else setLaunchCompliant(true);
      void load();
    } else if (!authLoading) setLoading(false);
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
      return;
    }
    localStorage.setItem('raahi_driver_location_id', locationId);
    loadRoutes(locationId);
  }, [locationId, context.queue_status, loadRoutes]);

  const join = async (route: DriverDepartingRoute) => {
    try { const compliance=await getMyDriverLaunchCompliance(); if(!compliance.launch_compliant){toast.error('Complete Driver launch compliance before joining Shared Ride FIFO.');router.push('/driver-verification');return;} await guardLaunch(async () => { await guardLegal(async () => {
      setJoining(route.route_id);
      const result = await joinDriverQueue(route.route_id, locationId);
      setJoining(null);
      if (!result.success) { toast.error(result.error || 'Could not join queue'); return; }
      const ctx = await getDriverHomeContext();
      setContext(ctx);
      if (ctx.has_active_trip) {
        toast.success(`You are now collecting on ${route.direction_label}`);
        router.push('/driver-active-car-screen');
      } else { toast.success(`Joined queue for ${route.direction_label}`); }
    }); }); } catch (e: any) { setJoining(null); toast.error(e?.message || 'Could not check launch or Driver access.'); }
  };

  const toggleRouteAlert = async (route: DriverDepartingRoute) => {
    if (profile?.role !== 'driver') return;
    const subscribed = preferences.some(pref => pref.route_id === route.route_id);
    setPreferenceBusy(route.route_id);
    const result = await setMyDriverRoutePreference(route.route_id, !subscribed);
    setPreferenceBusy(null);
    if (!result.success) {
      toast.error(result.error || 'Could not update route alerts');
      return;
    }
    setPreferences(await getMyDriverRoutePreferences());
    toast.success(!subscribed ? `Demand alerts on for ${route.direction_label}` : `Demand alerts off for ${route.direction_label}`);
  };

  useEffect(() => {
    if (!user || profile?.role !== 'driver' || context.queue_status === 'WAITING' || preferences.length === 0) return;

    const preferenceByRouteId = new Map(preferences.map(pref => [pref.route_id, pref]));
    const visibleRouteById = new Map(routes.map(route => [route.route_id, route]));
    const supabase = createClient();
    const channel = supabase
      .channel(`driver_demand_notifications_${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'raahi_invalidation_events' }, async payload => {
        const event = payload.new as { route_id?: string; source_table?: string; event_kind?: string };
        if (event.source_table !== 'demand_notification' || !event.route_id || !event.event_kind) return;
        if (!['DEMAND_LOW', 'DEMAND_MEDIUM', 'DEMAND_HIGH', 'DEMAND_URGENCY'].includes(event.event_kind)) return;

        const preference = preferenceByRouteId.get(event.route_id);
        if (!preference) return;
        const visibleRoute = visibleRouteById.get(event.route_id);
        if (visibleRoute?.has_active_car) return;

        const summary = await getRouteDemandSummary(preference.route_id);
        if (summary.now_count < 1) return;
        setDemandByRoute(previous => ({ ...previous, [preference.route_id]: summary }));

        const passengerText = `${summary.now_count} passenger${summary.now_count === 1 ? '' : 's'} ${summary.now_count === 1 ? 'is' : 'are'} looking for ${preference.from_location_name} -> ${preference.to_location_name}.`;
        const message = event.event_kind === 'DEMAND_URGENCY' ? `Demand is getting more urgent. ${passengerText}` : passengerText;
        toast(message, {
          action: visibleRoute && locationId === preference.from_location_id
            ? { label: 'Go Available', onClick: () => { void join(visibleRoute); } }
            : { label: 'View route', onClick: () => setLocationId(preference.from_location_id) },
        });
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [context.queue_status, locationId, preferences, profile?.role, routes, user]);

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
      <div className="mx-auto max-w-screen-sm px-4 py-6 sm:px-6 sm:py-8">
        <section className="overflow-hidden rounded-3xl border border-border bg-card card-shadow-md">
          <div className="bg-gradient-to-br from-primary to-[#267746] px-5 py-6 text-white sm:px-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">Driver queue</p><h1 className="mt-2 text-2xl font-extrabold tracking-tight">You’re in line</h1><p className="mt-2 text-sm text-white/75">{context.queue_route_label}</p></div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15"><Clock3 size={20} /></div>
            </div>
            <div className="mt-6 rounded-3xl border border-white/10 bg-white/10 p-5 text-center backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/65">Queue position</p>
              <p className="mt-1 text-5xl font-extrabold tracking-tight">#{context.queue_position ?? '—'}</p>
            </div>
          </div>
          <div className="space-y-4 p-5 sm:p-6">
            <div className="rounded-2xl bg-secondary/60 px-4 py-3"><p className="text-sm font-bold text-primary">Raahi is watching your turn</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">This updates automatically. When your turn starts, Raahi opens your active car.</p></div>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-outline" onClick={refreshContext}><RefreshCw size={16}/>Refresh</button>
              <button className="btn-outline text-red-600" disabled={leaving} onClick={leaveQueue}>{leaving ? <Loader2 size={16} className="animate-spin"/> : null}Leave queue</button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const selected = locations.find(l => l.id === locationId);

  return (
    <>{launchDialog}{legalDialog}<div className="mx-auto max-w-screen-lg space-y-5 px-4 py-5 sm:px-6">
      <section className="hero-surface">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">Driver home</p><h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{profile?.display_name ? `Ready, ${profile.display_name}?` : 'Ready to drive?'}</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">Choose your current stand, choose which routes you want demand alerts for, then take the next route action. FIFO stays route-specific.</p></div>
          <div className="hidden rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80 sm:block">Operational mode</div>
        </div>
      </section>

      <Link href="/driver-verification" className="feature-card flex items-center gap-3 p-4 transition hover:border-primary/30 sm:p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><ShieldCheck size={20}/></div>
        <div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-foreground">Driver verification</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Complete core trust plus vehicle permit, fitness, insurance and PUC review before paid ride operations.</p></div>
        <span className="text-xs font-bold text-primary">Open</span>
      </Link>

      <section>
        <div className="mb-2 flex items-center justify-between"><div><p className="section-label">Current stand</p><p className="mt-1 text-sm font-bold text-foreground">Where are you starting from?</p></div></div>
        <div className="grid grid-cols-2 gap-2">
          {locations.map(loc => {
            const active = locationId === loc.id;
            return (
              <button key={loc.id} onClick={() => setLocationId(loc.id)} className={`rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.99] ${active ? 'border-primary bg-secondary brand-ring' : 'border-border bg-card hover:border-primary/30'}`}>
                <div className="flex items-start justify-between gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-primary text-white' : 'bg-secondary text-primary'}`}><MapPin size={17} /></div>{active && <span className="rounded-full bg-primary px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white">Here</span>}</div>
                <p className="mt-3 text-sm font-bold text-foreground">{loc.name}</p>
              </button>
            );
          })}
        </div>
      </section>

      {selected && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div><p className="section-label">Routes from {selected.name}</p><p className="mt-1 text-sm font-bold text-foreground">Choose your next action</p></div>
            <button onClick={() => loadRoutes(locationId)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card" aria-label="Refresh routes"><RefreshCw size={15} className="text-muted-foreground" /></button>
          </div>
          <div className="space-y-3">
            {routes.length === 0 && <div className="card p-5 text-center text-sm text-muted-foreground">No active routes depart from {selected.name} right now.</div>}
            {routes.map(route => (
              <DriverRouteCard
                key={route.route_id}
                route={route}
                demand={demandByRoute[route.route_id]}
                joining={joining === route.route_id}
                alertsAvailable={profile?.role === 'driver'}
                subscribed={preferences.some(pref => pref.route_id === route.route_id)}
                preferenceBusy={preferenceBusy === route.route_id}
                launchCompliant={launchCompliant}
                onToggleSubscription={() => toggleRouteAlert(route)}
                onJoin={() => join(route)}
              />
            ))}
          </div>
        </div>
      )}
    </div></>
  );
}

function Access({title,text}:{title:string;text:string}) {
  return <div className="max-w-screen-sm mx-auto px-4 py-12 text-center space-y-3"><ShieldCheck size={40} className="mx-auto text-muted-foreground opacity-40"/><p className="font-semibold">{title}</p><p className="text-sm text-muted-foreground">{text}</p></div>;
}
