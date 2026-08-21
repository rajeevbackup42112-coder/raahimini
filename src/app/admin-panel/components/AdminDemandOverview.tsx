'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Users } from 'lucide-react';
import { getRouteDemandSummary, type RouteDemandSummary } from '@/lib/demandApi';
import { getActiveLocations, getRoutesForLocation, type RouteForLocation } from '@/lib/raahiApi';

type DemandRow = RouteForLocation & { demand: RouteDemandSummary };

export default function AdminDemandOverview() {
  const [rows, setRows] = useState<DemandRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const locations = await getActiveLocations();
    const routeLists = await Promise.all(locations.map(location => getRoutesForLocation(location.id)));
    const uniqueRoutes = Array.from(
      new Map(routeLists.flat().map(route => [route.route_id, route])).values()
    );
    const demand = await Promise.all(uniqueRoutes.map(route => getRouteDemandSummary(route.route_id)));
    const byRoute = Object.fromEntries(demand.map(summary => [summary.route_id, summary]));
    setRows(uniqueRoutes.map(route => ({ route, demand: byRoute[route.route_id] })).map(({ route, demand }) => ({ ...route, demand })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const unserved = rows
    .filter(row => !row.has_active_car && ((row.demand?.now_count ?? 0) > 0 || (row.demand?.scheduled_count ?? 0) > 0))
    .sort((a, b) => (b.demand.now_count + b.demand.scheduled_count) - (a.demand.now_count + a.demand.scheduled_count));

  return (
    <section className="mx-auto max-w-screen-2xl px-4 pt-4">
      <div className="feature-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Unserved demand</p>
            <h2 className="mt-1 text-lg font-bold text-foreground">Where Raahi needs supply</h2>
            <p className="mt-1 text-xs text-muted-foreground">Aggregate passenger interest only. This does not change FIFO or create trips.</p>
          </div>
          <button onClick={load} disabled={loading} aria-label="Refresh demand" className="btn-outline px-3 py-2">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
        ) : unserved.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">No unserved passenger demand is visible right now.</div>
        ) : (
          <div className="mt-4 space-y-2">
            {unserved.map(row => (
              <div key={row.route_id} className="rounded-2xl border border-border px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">{row.from_location_name} → {row.to_location_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.route_code}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">{row.demand.demand_label}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-muted/60 px-3 py-2">
                    <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><Users size={11}/> Need ride now</p>
                    <p className="mt-0.5 text-lg font-bold text-foreground">{row.demand.now_count}</p>
                  </div>
                  <div className="rounded-xl bg-muted/60 px-3 py-2">
                    <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><AlertTriangle size={11}/> Planned</p>
                    <p className="mt-0.5 text-lg font-bold text-foreground">{row.demand.scheduled_count}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
