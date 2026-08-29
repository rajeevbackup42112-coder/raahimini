'use client';

import { ArrowRight, Car, IndianRupee, Loader2, Users } from 'lucide-react';
import type { RouteDemandSummary } from '@/lib/demandApi';
import type { DriverDepartingRoute } from '@/lib/raahiApi';

interface Props {
  route: DriverDepartingRoute;
  joining: boolean;
  onJoin: () => void;
  demand?: RouteDemandSummary;
}

export default function DriverRouteCard({ route, joining, onJoin, demand }: Props) {
  const nextAction = route.has_active_car ? 'Join queue' : 'Go available now';
  const queueText = route.has_active_car
    ? `${route.waiting_drivers} driver${route.waiting_drivers === 1 ? '' : 's'} waiting`
    : 'No active car — you can become current';
  const interested = demand?.now_count ?? 0;
  const planned = demand?.scheduled_count ?? 0;
  const urgency = demand?.min_wait_tolerance_minutes ?? null;
  const capacity = route.vehicle_capacity || 4;
  const fullCarValue = route.fare_per_seat * capacity;

  return (
    <button disabled={joining} onClick={onJoin} className="w-full overflow-hidden rounded-3xl border border-border bg-card text-left card-shadow-sm transition-all active:scale-[0.99] disabled:opacity-60">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Car size={20} className="text-primary" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{route.route_code}</p><div className="mt-1 flex items-center gap-1.5 text-lg font-extrabold tracking-tight text-foreground"><span className="truncate">{route.from_location_name}</span><ArrowRight size={15} className="shrink-0 text-muted-foreground" /><span className="truncate">{route.to_location_name}</span></div></div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${route.has_active_car ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>{route.has_active_car ? 'Queue active' : 'Available now'}</span>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Users size={12} />{queueText}</p>
          </div>
        </div>

        {(interested > 0 || planned > 0) && (
          <div className="mt-4 rounded-2xl border border-primary/10 bg-secondary/60 px-3.5 py-3">
            <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Passenger demand</p>{demand?.demand_label && <span className="text-[10px] font-bold text-primary">{demand.demand_label}</span>}</div>
            <p className="mt-1 text-sm font-extrabold text-primary">{interested} now{planned > 0 ? ` · ${planned} planned` : ''}</p>
            {urgency && interested > 0 && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Shortest stated wait: <strong className="text-foreground">{urgency} min</strong>. Advisory only — FIFO is unchanged.</p>}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-muted/60 px-3 py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Current fare</p><p className="mt-1 inline-flex items-center text-base font-extrabold text-foreground"><IndianRupee size={14} />{route.fare_per_seat}<span className="ml-0.5 text-xs font-semibold text-muted-foreground">/seat</span></p></div>
          <div className="rounded-2xl bg-muted/60 px-3 py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Full {capacity}-seat car</p><p className="mt-1 inline-flex items-center text-base font-extrabold text-foreground"><IndianRupee size={14} />{fullCarValue}</p></div>
        </div>
      </div>

      <div className={`flex items-center justify-between gap-3 border-t px-4 py-3.5 sm:px-5 ${route.has_active_car ? 'border-border bg-secondary/60 text-primary' : 'border-primary bg-primary text-white'}`}>
        <div><p className={`text-[10px] font-semibold uppercase tracking-wide ${route.has_active_car ? 'text-muted-foreground' : 'text-white/65'}`}>Next action</p><p className="mt-0.5 text-sm font-extrabold">{nextAction}</p></div>
        {joining ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
      </div>
    </button>
  );
}
