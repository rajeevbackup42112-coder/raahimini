'use client';

import { ArrowRight, Car, IndianRupee, Loader2, RotateCcw, Users } from 'lucide-react';
import type { RouteDemandSummary } from '@/lib/demandApi';
import type { DriverDepartingRoute } from '@/lib/raahiApi';

interface Props {
  route: DriverDepartingRoute;
  joining: boolean;
  onJoin: () => void;
  demand?: RouteDemandSummary;
  returnDemand?: RouteDemandSummary;
}

function returnSignal(nowCount: number, plannedCount: number, capacity: number) {
  if (nowCount >= capacity) return { label: 'High', detail: 'enough current interest to fill your car' };
  if (nowCount >= Math.max(2, Math.ceil(capacity / 2))) return { label: 'Good', detail: 'meaningful return demand already visible' };
  if (nowCount > 0) return { label: 'Early', detail: 'some return interest is visible' };
  if (plannedCount > 0) return { label: 'Planned', detail: 'future return interest is visible' };
  return { label: 'None yet', detail: 'no return interest is visible right now' };
}

export default function DriverRouteCard({ route, joining, onJoin, demand, returnDemand }: Props) {
  const nextAction = route.has_active_car ? 'Join queue' : 'Go available now';
  const queueText = route.has_active_car
    ? `${route.waiting_drivers} driver${route.waiting_drivers === 1 ? '' : 's'} waiting`
    : 'No active car — you can become current';
  const interested = demand?.now_count ?? 0;
  const planned = demand?.scheduled_count ?? 0;
  const returnInterested = returnDemand?.now_count ?? 0;
  const returnPlanned = returnDemand?.scheduled_count ?? 0;
  const capacity = route.vehicle_capacity || 4;
  const fullCarValue = route.fare_per_seat * capacity;
  const returnFill = returnSignal(returnInterested, returnPlanned, capacity);

  return (
    <button
      disabled={joining}
      onClick={onJoin}
      className="feature-card w-full p-4 text-left active:scale-[0.99] disabled:opacity-60"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary">
          <Car size={20} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{route.route_code}</p>
          <div className="mt-1 flex items-center gap-1.5 text-base font-bold text-foreground">
            <span className="truncate">{route.from_location_name}</span>
            <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
            <span className="truncate">{route.to_location_name}</span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Users size={12} /> {queueText}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-secondary/60 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Current fare</p>
              <p className="mt-0.5 inline-flex items-center text-sm font-bold text-primary"><IndianRupee size={13} />{route.fare_per_seat}/seat</p>
            </div>
            <div className="rounded-xl bg-secondary/60 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Full {capacity}-seat car</p>
              <p className="mt-0.5 inline-flex items-center text-sm font-bold text-primary"><IndianRupee size={13} />{fullCarValue}</p>
            </div>
          </div>

          {(interested > 0 || planned > 0) && (
            <p className="mt-2 text-xs font-semibold text-primary">
              Passenger demand: {interested} now{planned > 0 ? ` · ${planned} planned` : ''}{demand?.demand_label ? ` · ${demand.demand_label.toLowerCase()}` : ''}
            </p>
          )}

          <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-muted/60 px-2.5 py-2">
            <RotateCcw size={12} className="mt-0.5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">
                Return demand: <strong className="text-foreground">{returnInterested} now{returnPlanned > 0 ? ` · ${returnPlanned} planned` : ''}</strong>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Likely fill: <strong className="text-foreground">{returnFill.label}</strong> · {returnFill.detail}. Advisory only — FIFO is unchanged.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-secondary/70 px-3 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Next action</p>
          <p className="text-sm font-bold text-primary">{nextAction}</p>
        </div>
        {joining ? <Loader2 size={18} className="animate-spin text-primary" /> : <span className="text-xs font-bold text-primary">Continue</span>}
      </div>
    </button>
  );
}
