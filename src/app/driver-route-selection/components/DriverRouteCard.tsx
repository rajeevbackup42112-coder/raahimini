'use client';

import { ArrowRight, BellRing, Car, Loader2, Users } from 'lucide-react';
import type { DriverDepartingRoute } from '@/lib/raahiApi';
import type { RouteDemandSummary } from '@/lib/demandApi';

interface Props {
  route: DriverDepartingRoute;
  demand?: RouteDemandSummary;
  joining: boolean;
  onJoin: () => void;
}

export default function DriverRouteCard({ route, demand, joining, onJoin }: Props) {
  const nextAction = route.has_active_car ? 'Join queue' : 'Go available now';
  const queueText = route.has_active_car
    ? `${route.waiting_drivers} driver${route.waiting_drivers === 1 ? '' : 's'} waiting`
    : 'No active car — you can become current';
  const interested = demand?.now_count ?? 0;

  return (
    <button
      disabled={joining}
      onClick={onJoin}
      className="w-full rounded-3xl border border-border bg-card p-4 text-left card-shadow transition-all active:scale-[0.99] disabled:opacity-60"
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
          {interested > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
              <BellRing size={12} /> {interested} passenger{interested === 1 ? '' : 's'} looking for this route
            </p>
          )}
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
