'use client';

import { useEffect, useState } from 'react';
import SupportIssueButton from '@/components/SupportIssueButton';
import { getDriverActiveCar, type DriverActiveTrip } from '@/lib/raahiApi';
import { useAuth } from '@/contexts/AuthContext';

export default function DriverSupportPanel() {
  const { user, profile, loading } = useAuth();
  const [trip, setTrip] = useState<DriverActiveTrip | null>(null);

  useEffect(() => {
    if (loading || !user || profile?.role !== 'driver') return;
    getDriverActiveCar().then(setTrip);
  }, [loading, user, profile?.role]);

  if (!trip?.has_active_trip || !trip.trip_id) return null;

  return (
    <div className="max-w-screen-2xl mx-auto px-4 pb-3">
      <SupportIssueButton role="driver" tripId={trip.trip_id} />
      <p className="mt-2 text-center text-[11px] text-muted-foreground">Reporting a problem does not cancel this car. Use Cancel This Car separately if the trip cannot continue.</p>
    </div>
  );
}
