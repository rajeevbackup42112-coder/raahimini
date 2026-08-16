import React from 'react';

interface SeatCountBadgeProps {
  label: string;
  count: number;
  variant: 'available' | 'held' | 'confirmed' | 'closed' | 'capacity';
}

export default function SeatCountBadge({ label, count, variant }: SeatCountBadgeProps) {
  const variantClasses: Record<string, string> = {
    available: 'status-available',
    held: 'status-held',
    confirmed: 'status-confirmed',
    closed: 'status-driver-closed',
    capacity: 'bg-muted text-foreground',
  };

  return (
    <div className={`stat-badge ${variantClasses[variant]} min-w-[60px]`}>
      <span className="text-2xl font-bold tabular-nums leading-none">{count}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide mt-0.5 opacity-80">{label}</span>
    </div>
  );
}