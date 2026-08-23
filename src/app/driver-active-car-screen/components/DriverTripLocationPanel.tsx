'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, LocateFixed, MapPin, ShieldCheck } from 'lucide-react';
import { getDriverActiveCar, updateDriverTripLocation, type DriverActiveTrip } from '@/lib/raahiApi';

const SEND_INTERVAL_MS = 15000;

export default function DriverTripLocationPanel() {
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

  useEffect(() => { void load(); }, [load]);

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
    setReady(Boolean(result.usable_for_start) || trip.status === 'IN_PROGRESS');
    setError(result.usable_for_start === false && trip.status === 'ACTIVE_COLLECTING'
      ? 'Location found, but accuracy is still too low to start. Try again in an open area.'
      : '');
    return true;
  }, [trip?.trip_id, trip?.status]);

  const enableLocation = () => {
    if (!trip?.trip_id || !navigator.geolocation) {
      setError('Location is not available on this device.');
      return;
    }
    setBusy(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => { await sendPosition(position); setBusy(false); },
      () => { setError('Turn on location permission so Raahi can get a usable fix.'); setBusy(false); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  };

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
              {tracking ? 'Trip location sharing is active' : ready ? 'Location ready for Start Trip' : 'Location required before Start Trip'}
            </p>
            <p className={`mt-1 text-xs ${tracking || ready ? 'text-green-800' : 'text-amber-800'}`}>
              {tracking
                ? 'Raahi updates your location only while this trip is active. Tracking stops automatically when the trip ends.'
                : 'Get one accurate location fix now. Raahi does not track you merely for waiting or using Driver Home.'}
            </p>
            {lastSentAt && <p className="mt-1 text-[11px] text-muted-foreground">Last location update: {new Date(lastSentAt).toLocaleTimeString()}</p>}
            {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
          </div>
          {(tracking || ready) && <CheckCircle2 size={18} className="mt-1 shrink-0 text-green-700" />}
        </div>
        {!tracking && (
          <button type="button" onClick={enableLocation} disabled={busy} className="btn-primary mt-3 w-full">
            {busy ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
            {busy ? 'Getting location…' : ready ? 'Refresh location fix' : 'Enable trip location'}
          </button>
        )}
      </div>
    </div>
  );
}
