'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, LocateFixed, MapPin, ShieldCheck } from 'lucide-react';
import { getDriverActiveCar, updateDriverTripLocation, type DriverActiveTrip } from '@/lib/raahiApi';

const SEND_INTERVAL_MS = 15000;

export default function DriverTripLocationPanel({ onReadyChange, refreshToken = 0 }: { onReadyChange?: (ready: boolean) => void; refreshToken?: number }) {
  const [trip, setTrip] = useState<DriverActiveTrip | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const lastSendRef = useRef(0);

  const load = useCallback(async () => {
    const next = await getDriverActiveCar();
    setTrip(next);
  }, []);

  useEffect(() => { void load(); }, [load, refreshToken]);

  const sendPosition = useCallback(async (position: GeolocationPosition) => {
    if (!trip?.trip_id) return false;
    const result = await updateDriverTripLocation(
      trip.trip_id,
      position.coords.latitude,
      position.coords.longitude,
      Math.max(position.coords.accuracy || 1, 1),
      new Date(position.timestamp).toISOString()
    );
    if (!result.success) {
      setError(result.error || 'Raahi could not save this location fix.');
      return false;
    }
    lastSendRef.current = Date.now();
    setLastSentAt(new Date().toISOString());
    const nextReady = Boolean(result.usable_for_start) || trip.status === 'IN_PROGRESS';
    setReady(nextReady);
    onReadyChange?.(nextReady);
    setError(result.usable_for_start === false && trip.status === 'ACTIVE_COLLECTING'
      ? 'Location found, but accuracy is still too low to start. Try again in an open area.'
      : '');
    return true;
  }, [trip?.trip_id, trip?.status, onReadyChange]);

  const enableLocation = () => {
    if (!trip?.trip_id || !navigator.geolocation) {
      setError('Location is not available on this device.');
      return;
    }
    setReady(false);
    onReadyChange?.(false);
    setBusy(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => { await sendPosition(position); setBusy(false); },
      () => { setError('Turn on location permission so Raahi can get a usable fix.'); setBusy(false); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  };

  useEffect(() => {
    if (!ready || trip?.status !== 'ACTIVE_COLLECTING' || !lastSentAt) return;
    const age = Date.now() - new Date(lastSentAt).getTime();
    const timer = window.setTimeout(() => {
      setReady(false);
      onReadyChange?.(false);
      setError('Location fix expired. Refresh location to continue.');
    }, Math.max(0, 50000 - age));
    return () => window.clearTimeout(timer);
  }, [ready, trip?.status, lastSentAt, onReadyChange]);

  useEffect(() => {
    if (trip?.status !== 'IN_PROGRESS' || !trip.trip_id || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (Date.now() - lastSendRef.current >= SEND_INTERVAL_MS) void sendPosition(position);
      },
      () => setError('Location temporarily unavailable. Route progress still works.'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    const refresh = window.setInterval(() => { void load(); }, 15000);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(refresh);
    };
  }, [trip?.status, trip?.trip_id, sendPosition, load]);

  if (!trip?.has_active_trip || !trip.trip_id) return null;

  const tracking = trip.status === 'IN_PROGRESS';
  return (
    <div className="mx-auto max-w-screen-2xl px-4 pt-3">
      <div className={`rounded-2xl border p-4 ${tracking || ready ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tracking || ready ? 'bg-green-100' : 'bg-amber-100'}`}>
            {tracking || ready ? <LocateFixed size={19} className="text-green-700" /> : <MapPin size={19} className="text-amber-700" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${tracking || ready ? 'text-green-900' : 'text-amber-900'}`}>
              {tracking ? 'Trip location sharing is active' : ready ? 'Location ready' : 'Location needed before departure'}
            </p>
            <p className={`mt-1 text-xs ${tracking || ready ? 'text-green-800' : 'text-amber-800'}`}>
              {tracking
                ? 'Location is shared only while this trip is active. Tracking stops automatically when the trip ends.'
                : ready
                  ? 'Keep location on. Raahi starts automatically when everyone is aboard.'
                  : 'Turn on location before departure. Raahi does not track you merely for waiting or using Driver Home.'}
            </p>
            {lastSentAt && <p className="mt-1 text-[11px] text-muted-foreground">Updated {new Date(lastSentAt).toLocaleTimeString()}</p>}
            {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
          </div>
          {(tracking || ready) && <CheckCircle2 size={18} className="mt-1 shrink-0 text-green-700" />}
        </div>
        {!tracking && (
          <button type="button" onClick={enableLocation} disabled={busy} className="btn-primary mt-3 w-full">
            {busy ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
            {busy ? 'Getting location…' : ready ? 'Refresh Location' : 'Turn On Location'}
          </button>
        )}
      </div>
    </div>
  );
}
