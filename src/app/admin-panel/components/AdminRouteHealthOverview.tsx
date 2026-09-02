'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Car, CheckCircle2, Clock3, Loader2, RefreshCw, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type RouteHealth = {
  route_id: string;
  route_code: string;
  from_location_name: string;
  to_location_name: string;
  route_active: boolean;
  trip_id: string | null;
  trip_status: string | null;
  driver_name: string | null;
  vehicle_number: string | null;
  confirmed: number;
  held: number;
  available: number;
  capacity: number;
  current_stop_name: string | null;
  waiting_drivers: number;
  next_driver_name: string | null;
  now_demand: number;
  planned_demand: number;
  demand_label: string;
  exception_code: string | null;
};

const exceptionCopy: Record<string, string> = {
  ROUTE_PAUSED: 'Route is paused.',
  NO_DRIVER_WITH_DEMAND: 'Passengers need a ride, but no driver is available.',
  WAITING_DRIVER_NOT_ACTIVATED: 'A driver is waiting but no car is active. Check the queue.',
  NO_NEXT_DRIVER_WITH_DEMAND: 'Passengers are waiting for the next car, but no next driver is queued.',
};

export default function AdminRouteHealthOverview() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<RouteHealth[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (profile?.role !== 'admin') return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('admin_get_route_health');
    if (!error) setRows((data || []) as RouteHealth[]);
    setLoading(false);
  }, [profile?.role]);

  useEffect(() => { void load(); }, [load]);

  if (profile?.role !== 'admin') return null;

  const exceptions = rows.filter((row) => row.exception_code);
  const operatingNormally = !loading && exceptions.length === 0;

  return (
    <section className="mx-auto max-w-screen-2xl px-4 pt-4 space-y-4">
      <div className={`feature-card p-5 ${operatingNormally ? 'border-green-200' : exceptions.length ? 'border-amber-200' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${operatingNormally ? 'bg-green-50' : 'bg-secondary'}`}>
              {operatingNormally ? <CheckCircle2 size={21} className="text-green-700" /> : <Car size={21} className="text-primary" />}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Operations now</p>
              <h1 className="mt-1 text-xl font-extrabold text-foreground">
                {loading ? 'Checking route health…' : operatingNormally ? 'Route operations are healthy' : `${exceptions.length} route${exceptions.length === 1 ? '' : 's'} need attention`}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">Live route state, supply, demand and the next driver — without changing FIFO.</p>
            </div>
          </div>
          <button onClick={load} disabled={loading} className="btn-outline px-3 py-2" aria-label="Refresh route health">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          </button>
        </div>
      </div>

      {!loading && exceptions.length > 0 && (
        <div className="feature-card border-amber-200 p-4">
          <div className="flex items-center gap-2"><AlertTriangle size={17} className="text-amber-600" /><h2 className="text-sm font-bold text-foreground">Needs attention</h2></div>
          <div className="mt-3 space-y-2">
            {exceptions.map((row) => (
              <div key={row.route_id} className="rounded-2xl bg-amber-50 px-4 py-3">
                <p className="text-sm font-bold text-amber-900">{row.from_location_name} → {row.to_location_name}</p>
                <p className="mt-1 text-xs text-amber-800">{exceptionCopy[row.exception_code || ''] || 'This route needs an operational check.'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><p className="section-label">Route health</p><p className="mt-1 text-xs text-muted-foreground">What is happening on every route right now.</p></div>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((row) => <RouteHealthCard key={row.route_id} row={row} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function RouteHealthCard({ row }: { row: RouteHealth }) {
  const filled = row.confirmed + row.held;
  const status = !row.route_active ? 'Paused' : row.trip_status === 'IN_PROGRESS' ? 'Trip in progress' : row.trip_status === 'ACTIVE_COLLECTING' ? 'Collecting now' : 'No active car';
  const statusTone = row.exception_code ? 'bg-amber-50 text-amber-700' : row.trip_status ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground';

  return (
    <div className="feature-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{row.route_code}</p>
          <p className="mt-1 flex items-center gap-1.5 text-base font-bold text-foreground"><span>{row.from_location_name}</span><ArrowRight size={14} className="text-muted-foreground" /><span>{row.to_location_name}</span></p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone}`}>{status}</span>
      </div>

      {row.trip_id ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Metric label="Seats" value={`${filled}/${row.capacity} filled`} sub={`${row.available} available`} />
          <Metric label="Current car" value={row.driver_name || 'Driver'} sub={row.vehicle_number || 'Vehicle'} />
          <Metric label="Current stop" value={row.current_stop_name || '—'} sub={row.trip_status === 'IN_PROGRESS' ? 'On the way' : 'Collecting'} />
          <Metric label="Next driver" value={row.next_driver_name || 'None queued'} sub={`${row.waiting_drivers} waiting`} />
        </div>
      ) : (
        <div className="mt-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">No car is active on this route right now.</div>
      )}

      <div className="mt-3 flex items-center justify-between rounded-2xl bg-secondary/50 px-3 py-2.5">
        <div className="flex items-center gap-2"><Users size={14} className="text-primary" /><div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Passenger demand</p><p className="text-xs font-bold text-foreground">{row.now_demand} now · {row.planned_demand} planned</p></div></div>
        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary"><Clock3 size={12} />{row.demand_label}</div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="rounded-xl bg-muted/60 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-0.5 truncate text-sm font-bold text-foreground">{value}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p></div>;
}
