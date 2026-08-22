'use client';

import { useCallback, useEffect, useState } from 'react';
import { LocateFixed, RefreshCw, WifiOff } from 'lucide-react';
import { getActiveTripLocation, type TripLiveLocation } from '@/lib/raahiApi';

export default function PassengerLiveLocationStatus({ tripId, active }: { tripId: string; active: boolean }) {
  const [location, setLocation] = useState<TripLiveLocation>({ has_location: false });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setLocation(await getActiveTripLocation(tripId));
    setLoading(false);
  }, [active, tripId]);

  useEffect(() => {
    if (!active) return;
    void load();
    const timer = window.setInterval(() => { void load(); }, 15000);
    return () => window.clearInterval(timer);
  }, [active, load]);

  if (!active) return null;

  const fresh = Boolean(location.has_location && location.is_fresh);
  return (
    <div className={`rounded-2xl border px-4 py-3 ${fresh ? 'border-green-200 bg-green-50' : 'border-border bg-muted/60'}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${fresh ? 'bg-green-100' : 'bg-background'}`}>
          {fresh ? <LocateFixed size={17} className="text-green-700" /> : <WifiOff size={17} className="text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold ${fresh ? 'text-green-900' : 'text-foreground'}`}>{fresh ? 'Driver location is live' : 'Live location temporarily unavailable'}</p>
          <p className={`mt-1 text-xs ${fresh ? 'text-green-800' : 'text-muted-foreground'}`}>
            {fresh && location.captured_at
              ? `Updated ${new Date(location.captured_at).toLocaleTimeString()}. Route and stop progress remain the fallback if GPS drops.`
              : 'Raahi will keep showing route and stop progress. GPS will return automatically when the driver has a usable signal.'}
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl hover:bg-background" aria-label="Refresh live location">
          <RefreshCw size={15} className={loading ? 'animate-spin text-primary' : 'text-muted-foreground'} />
        </button>
      </div>
    </div>
  );
}
