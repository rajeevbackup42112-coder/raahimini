'use client';

import React from 'react';
import { ArrowRight, Car, IndianRupee, MapPin, Users } from 'lucide-react';

type Tone = 'good' | 'limited' | 'transit' | 'none';

interface Props {
  from: string;
  to: string;
  statusLabel: string;
  statusTone?: Tone;
  vehicleLabel?: string;
  seatsFilled?: number;
  seatsTotal?: number;
  seatsLeft?: number;
  farePerSeat?: number | null;
  pickupLabel?: string;
  confidenceLabel?: string;
  children?: React.ReactNode;
}

const toneClass: Record<Tone, string> = {
  good: 'bg-green-50 text-green-700 border-green-100',
  limited: 'bg-amber-50 text-amber-700 border-amber-100',
  transit: 'bg-blue-50 text-blue-700 border-blue-100',
  none: 'bg-muted text-muted-foreground border-border',
};

export default function UnifiedTripCard({
  from,
  to,
  statusLabel,
  statusTone = 'good',
  vehicleLabel,
  seatsFilled,
  seatsTotal,
  seatsLeft,
  farePerSeat,
  pickupLabel,
  confidenceLabel,
  children,
}: Props) {
  const hasSeatStats = typeof seatsFilled === 'number' || typeof seatsLeft === 'number';

  return (
    <div className="feature-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Live Raahi</p>
          <div className="mt-1 flex items-center gap-2 text-lg font-bold text-foreground">
            <span className="truncate">{from}</span>
            <ArrowRight size={16} className="shrink-0 text-muted-foreground" />
            <span className="truncate">{to}</span>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${toneClass[statusTone]}`}>
          {statusLabel}
        </span>
      </div>

      {vehicleLabel && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Car size={14} className="text-primary" />
          <span className="font-semibold text-foreground">{vehicleLabel}</span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {hasSeatStats && (
          <div className="rounded-2xl bg-muted/70 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users size={13} /> Seats</div>
            <p className="mt-1 text-sm font-bold text-foreground">
              {typeof seatsFilled === 'number' && typeof seatsTotal === 'number'
                ? `${seatsFilled} / ${seatsTotal} filled`
                : `${seatsLeft ?? 0} left`}
            </p>
            {typeof seatsLeft === 'number' && <p className="text-[11px] text-muted-foreground">{seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left</p>}
          </div>
        )}
        {typeof farePerSeat === 'number' && (
          <div className="rounded-2xl bg-muted/70 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><IndianRupee size={13} /> Fare</div>
            <p className="mt-1 text-sm font-bold text-foreground">₹{farePerSeat} / seat</p>
            <p className="text-[11px] text-muted-foreground">Pay driver directly</p>
          </div>
        )}
      </div>

      {(pickupLabel || confidenceLabel) && (
        <div className="mt-3 space-y-1.5 text-xs">
          {pickupLabel && <p className="flex items-center gap-2 text-muted-foreground"><MapPin size={13} className="text-primary" /><span>Pickup: <strong className="text-foreground">{pickupLabel}</strong></span></p>}
          {confidenceLabel && <p className="font-semibold text-primary">{confidenceLabel}</p>}
        </div>
      )}

      {children && <div className="mt-4 space-y-3">{children}</div>}
    </div>
  );
}
