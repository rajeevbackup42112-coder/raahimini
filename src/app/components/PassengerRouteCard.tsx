'use client';

import Link from 'next/link';
import { ArrowRight, Car, IndianRupee } from 'lucide-react';
import type { RouteForLocation } from '@/lib/raahiApi';

export default function PassengerRouteCard({ route }: { route: RouteForLocation }) {
  const isCollecting = route.active_car_status === 'ACTIVE_COLLECTING';
  const isTransit = route.active_car_status === 'IN_PROGRESS';
  const health = !route.has_active_car
    ? { label: 'No car right now', cls: 'bg-muted text-muted-foreground' }
    : isCollecting && route.available_seats <= 1
      ? { label: 'Almost full', cls: 'bg-amber-50 text-amber-700' }
      : isCollecting
        ? { label: 'Seats available', cls: 'bg-green-50 text-green-700' }
        : { label: 'On the way', cls: 'bg-blue-50 text-blue-700' };
  const availability = !route.has_active_car
    ? 'No car is collecting yet'
    : isCollecting
      ? `${route.available_seats} seat${route.available_seats === 1 ? '' : 's'} available now`
      : 'Current car has departed';
  const action = isCollecting ? 'Book a seat' : isTransit ? 'See live trip' : 'Check route';

  return (
    <Link href={`/active-car-screen?route_id=${route.route_id}`} className="group block rounded-2xl border border-border bg-card p-4 card-shadow transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md active:scale-[0.99]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Car size={19} className="text-primary" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{route.route_code}</span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${health.cls}`}>{health.label}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-base font-extrabold tracking-tight text-foreground">
            <span className="truncate">{route.from_location_name}</span><ArrowRight size={14} className="shrink-0 text-muted-foreground" /><span className="truncate">{route.to_location_name}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-muted-foreground">{availability}</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-foreground"><IndianRupee size={11} />{route.fare_per_seat}<span className="font-medium text-muted-foreground">/seat</span></span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
        <span className="text-xs font-semibold text-muted-foreground">Live route status</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary">{action}<ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></span>
      </div>
    </Link>
  );
}
