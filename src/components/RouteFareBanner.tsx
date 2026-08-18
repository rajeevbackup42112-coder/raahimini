'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { IndianRupee, Loader2 } from 'lucide-react';
import { getPublicActiveCar } from '@/lib/raahiApi';

export default function RouteFareBanner() {
  const searchParams = useSearchParams();
  const routeId = searchParams.get('route_id');
  const [fare, setFare] = useState<number | null>(null);
  const [loading, setLoading] = useState(Boolean(routeId));

  useEffect(() => {
    let alive = true;
    if (!routeId) { setLoading(false); return; }
    setLoading(true);
    getPublicActiveCar(routeId).then((car: any) => {
      if (!alive) return;
      setFare(typeof car?.fare_per_seat === 'number' ? car.fare_per_seat : null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [routeId]);

  if (!routeId || (!loading && fare == null)) return null;

  return (
    <div className="max-w-screen-2xl mx-auto px-4 pt-4">
      <div className="rounded-2xl border border-border bg-card px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
          {loading ? <Loader2 size={18} className="animate-spin text-primary" /> : <IndianRupee size={18} className="text-primary" />}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Fare</p>
          <p className="text-base font-bold">{loading ? 'Loading…' : `₹${fare} per seat`}</p>
          <p className="text-[11px] text-muted-foreground">Pay the driver directly after you meet.</p>
        </div>
      </div>
    </div>
  );
}
