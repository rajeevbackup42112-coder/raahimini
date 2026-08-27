'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LocateFixed, MapPin, RefreshCw, WifiOff } from 'lucide-react';
import { getActiveTripLocation, type TripLiveLocation } from '@/lib/raahiApi';

type Props = {
  tripId: string;
  active: boolean;
  pickupName?: string;
  destinationName?: string;
};

export default function PassengerLiveLocationStatus({ tripId, active, pickupName, destinationName }: Props) {
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

  const hasCoordinates = Boolean(
    location.has_location &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  );
  const fresh = Boolean(hasCoordinates && location.is_fresh);

  const mapUrl = useMemo(() => {
    if (!hasCoordinates) return null;
    const lat = Number(location.latitude);
    const lon = Number(location.longitude);
    const latDelta = 0.008;
    const lonDelta = 0.012;
    const params = new URLSearchParams({
      bbox: `${lon - lonDelta},${lat - latDelta},${lon + lonDelta},${lat + latDelta}`,
      layer: 'mapnik',
      marker: `${lat},${lon}`,
    });
    return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
  }, [hasCoordinates, location.latitude, location.longitude]);

  if (!active) return null;

  const updatedLabel = location.captured_at
    ? new Date(location.captured_at).toLocaleTimeString()
    : null;
  const accuracyLabel = location.accuracy_meters
    ? `±${Math.round(location.accuracy_meters)} m`
    : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {mapUrl ? (
        <div className="relative h-56 w-full bg-muted">
          <iframe
            key={`${location.latitude}-${location.longitude}`}
            title="Live driver location map"
            src={mapUrl}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full border-0"
          />
          <div className={`pointer-events-none absolute left-3 top-3 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${fresh ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
            {fresh ? 'Live driver location' : 'Last known location'}
          </div>
        </div>
      ) : (
        <div className="flex h-44 items-center justify-center bg-muted/70 px-6 text-center">
          <div>
            <WifiOff size={28} className="mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm font-bold text-foreground">Live map temporarily unavailable</p>
            <p className="mt-1 text-xs text-muted-foreground">Raahi will retry automatically while your trip is active.</p>
          </div>
        </div>
      )}

      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${fresh ? 'bg-green-100' : 'bg-muted'}`}>
            {fresh ? <LocateFixed size={17} className="text-green-700" /> : <MapPin size={17} className="text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">
              {fresh ? `On the way to ${destinationName ?? 'your destination'}` : 'Showing the last known driver location'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {fresh
                ? `Updated ${updatedLabel ?? 'just now'}${accuracyLabel ? ` · ${accuracyLabel}` : ''}.`
                : updatedLabel
                  ? `Last updated ${updatedLabel}. Live GPS will return automatically when the driver has a usable signal.`
                  : 'Live GPS will appear here when a usable driver location is available.'}
            </p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl hover:bg-muted" aria-label="Refresh live location">
            <RefreshCw size={15} className={loading ? 'animate-spin text-primary' : 'text-muted-foreground'} />
          </button>
        </div>

        {(pickupName || destinationName) && (
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-3 text-xs">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Boarded at</p>
              <p className="mt-1 font-semibold text-foreground">{pickupName ?? 'Your pickup'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Destination</p>
              <p className="mt-1 font-semibold text-foreground">{destinationName ?? 'Destination'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
