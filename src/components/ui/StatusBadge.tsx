import React from 'react';

type StatusVariant = 'held' | 'confirmed' | 'available' | 'expired' | 'cancelled' | 'driver-closed' | 'in-progress' | 'collecting' | 'completed';

interface StatusBadgeProps {
  status: StatusVariant;
  label?: string;
}

const STATUS_CONFIG: Record<StatusVariant, { label: string; classes: string }> = {
  held: { label: 'Held', classes: 'status-held' },
  confirmed: { label: 'Confirmed', classes: 'status-confirmed' },
  available: { label: 'Available', classes: 'status-available' },
  expired: { label: 'Expired', classes: 'status-expired' },
  cancelled: { label: 'Cancelled', classes: 'status-cancelled' },
  'driver-closed': { label: 'Driver Closed', classes: 'status-driver-closed' },
  'in-progress': { label: 'In Progress', classes: 'status-in-progress' },
  collecting: { label: 'Collecting', classes: 'bg-orange-50 text-orange-700' },
  completed: { label: 'Completed', classes: 'bg-gray-100 text-gray-600' },
};

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.available;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${config.classes}`}>
      {label ?? config.label}
    </span>
  );
}