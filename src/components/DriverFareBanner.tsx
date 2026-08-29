'use client';

import { useEffect, useState } from 'react';
import { IndianRupee } from 'lucide-react';
import { getDriverActiveCar } from '@/lib/raahiApi';

export default function DriverFareBanner() {
  const [fare, setFare] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);

  useEffect(() => {
    let alive = true;
    getDriverActiveCar().then((trip: any) => {
      if (!alive) return;
      setFare(typeof trip?.fare_per_seat === 'number' ? trip.fare_per_seat : null);
      setCollecting(trip?.status === 'ACTIVE_COLLECTING');
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  if (loading || !collecting || fare == null) return null;

  return (
    <div className="mx-auto max-w-screen-lg px-4 pt-4 sm:px-6">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 card-shadow-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <IndianRupee size={18} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="section-label">Payment rule</p>
          <p className="mt-0.5 text-sm font-extrabold text-foreground sm:text-base">₹{fare} per seat · collect in person</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground sm:hidden">Confirm the request only after receiving payment in person.</p>
        </div>
        <p className="hidden max-w-xs text-right text-[11px] leading-relaxed text-muted-foreground sm:block">Confirm the request only after receiving payment in person.</p>
      </div>
    </div>
  );
}
