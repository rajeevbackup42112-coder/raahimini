'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ExternalLink, LocateFixed, MapPin, RefreshCw, WifiOff } from 'lucide-react';
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

  const fullMapUrl = useMemo(() => {
    if (!hasCoordinates) return null;
    const lat = Number(location.latitude);
    const lon = Number(location.longitude);
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
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
        <div className="relative h-60 w-full overflow-hidden bg-muted sm:h-72">
          <iframe
            key={`${location.latitude}-${location.longitude}`}
            title="Live driver location map"
            src={mapUrl}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full border-0 saturate-[0.85] contrast-[0.96]"
          />
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-2">
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${fresh ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
              {fresh && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-green-600" /></span>}
              {fresh ? 'Live driver location' : 'Last known location'}
            </div>
            {accuracyLabel && <div className="rounded-full bg-card/95 px-2.5 py-1.5 text-[10px] font-bold text-foreground shadow-sm">GPS {accuracyLabel}</div>}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
          <p className="pointer-events-none absolute bottom-3 left-4 text-xs font-semibold text-white drop-shadow-sm">{fresh ? `Updated ${updatedLabel ?? 'just now'}` : updatedLabel ? `Last updated ${updatedLabel}` : 'Waiting for live GPS'}</p>
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

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${fresh ? 'bg-green-100' : 'bg-muted'}`}>
            {fresh ? <LocateFixed size={18} className="text-green-700" /> : <MapPin size={18} className="text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="section-label">Live journey</p>
            <p className="mt-1 text-base font-extrabold tracking-tight text-foreground">
              {fresh ? `On the way to ${destinationName ?? 'your destination'}` : 'Showing the last known driver location'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {fresh
                ? `Driver GPS is active${accuracyLabel ? ` with ${accuracyLabel} accuracy` : ''}. Raahi refreshes this location automatically.`
                : updatedLabel
                  ? `Last updated ${updatedLabel}. Live GPS will return automatically when the driver has a usable signal.`
                  : 'Live GPS will appear here when a usable driver location is available.'}
            </p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card hover:bg-muted" aria-label="Refresh live location">
            <RefreshCw size={15} className={loading ? 'animate-spin text-primary' : 'text-muted-foreground'} />
          </button>
        </div>

        {(pickupName || destinationName) && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-muted/60 p-3 text-xs">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Boarded at</p>
              <p className="mt-1 truncate font-semibold text-foreground">{pickupName ?? 'Your pickup'}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-primary shadow-sm"><ArrowRight size={14} /></div>
            <div className="min-w-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Destination</p>
              <p className="mt-1 truncate font-semibold text-foreground">{destinationName ?? 'Destination'}</p>
            </div>
          </div>
        )}

        {fullMapUrl && (
          <a href={fullMapUrl} target="_blank" rel="noopener noreferrer" className="quiet-action w-full">
            <ExternalLink size={15} /> Open full map
          </a>
        )}
      </div>
    </div>
  );
}
