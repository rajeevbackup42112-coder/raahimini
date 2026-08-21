'use client';

import Link from 'next/link';
import { ArrowRight, Car, ChevronRight, IndianRupee } from 'lucide-react';
import type { RouteForLocation } from '@/lib/raahiApi';

export default function PassengerRouteCard({ route }: { route: RouteForLocation }) {
  const isCollecting = route.active_car_status === 'ACTIVE_COLLECTING';
  const isTransit = route.active_car_status === 'IN_PROGRESS';
  const health = !route.has_active_car
    ? { label: 'No driver yet', cls: 'bg-muted text-muted-foreground' }
    : isCollecting && route.available_seats <= 1
      ? { label: 'Limited availability', cls: 'bg-amber-50 text-amber-700' }
      : isCollecting
        ? { label: 'Good availability', cls: 'bg-green-50 text-green-700' }
        : { label: 'Car in transit', cls: 'bg-blue-50 text-blue-700' };

  const nextText = !route.has_active_car
    ? 'No active car right now. Check again shortly.'
    : isCollecting
      ? `${route.available_seats} seat${route.available_seats === 1 ? '' : 's'} available now`
      : 'Current car has left. The next car will appear here.';

  return (
    <Link
      href={`/active-car-screen?route_id=${route.route_id}`}
      className="group block rounded-3xl border border-border bg-card p-4 card-shadow transition-all active:scale-[0.99] hover:border-primary/30"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary">
          <Car size={20} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{route.route_code}</span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${health.cls}`}>{health.label}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-base font-bold text-foreground">
            <span className="truncate">{route.from_location_name}</span>
            <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
            <span className="truncate">{route.to_location_name}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{nextText}</span>
            <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-foreground"><IndianRupee size={11} />{route.fare_per_seat}/seat</span>
          </div>
        </div>
        <ChevronRight size={18} className="mt-7 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-muted/60 px-3 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">What happens next</p>
          <p className="text-xs font-semibold text-foreground">{isCollecting ? 'Open the live car and book a seat' : isTransit ? 'See live progress' : 'Check route status'}</p>
        </div>
        <span className="text-xs font-bold text-primary">View live ride</span>
      </div>
    </Link>
  );
}
