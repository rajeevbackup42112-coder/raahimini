'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { driverCancelTrip, getDriverActiveCar, type DriverActiveTrip } from '@/lib/raahiApi';
import { useAuth } from '@/contexts/AuthContext';

export default function DriverCancelTripPanel() {
  const { user, profile, loading: authLoading } = useAuth();
  const [trip, setTrip] = useState<DriverActiveTrip | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    if (!user) return;
    const data = await getDriverActiveCar();
    setTrip(data);
  };

  useEffect(() => {
    if (!authLoading && user && (profile?.role === 'driver' || profile?.role === 'admin')) load();
  }, [authLoading, user, profile?.role]);

  if (!trip?.has_active_trip || trip.status !== 'ACTIVE_COLLECTING' || !trip.trip_id) return null;

  const confirmedSeats = trip.confirmed_count ?? 0;

  const cancelTrip = async () => {
    setCancelling(true);
    const result = await driverCancelTrip(trip.trip_id!);
    setCancelling(false);
    setShowConfirm(false);

    if (!result.success) {
      toast.error(result.error || 'Could not cancel trip');
      return;
    }

    if ((result.confirmed_seats_affected ?? 0) > 0) {
      toast.warning(`Trip cancelled. ${result.confirmed_seats_affected} confirmed seat(s) affected.`);
    } else {
      toast.success('Trip cancelled. Next queued driver activated.');
    }
    setTrip({ has_active_trip: false });
    window.location.href = '/driver-route-selection';
  };

  return (
    <div className="mx-auto max-w-screen-lg px-4 pb-4 pt-1 sm:px-6">
      <button
        onClick={() => setShowConfirm(true)}
        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
      >
        <XCircle size={17} />
        Cancel This Car
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h2 className="text-lg font-bold">Cancel this car?</h2>
                {confirmedSeats > 0 ? (
                  <p className="text-sm text-muted-foreground mt-1">
                    {confirmedSeats} confirmed seat{confirmedSeats === 1 ? '' : 's'} will be affected. Passengers will be told that you cancelled, shown the next car, and given refund/contact options.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    There are no confirmed passengers. Held requests will be released and the next queued driver will be activated.
                  </p>
                )}
              </div>
            </div>

            {confirmedSeats > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                If any passenger already paid you directly, you remain responsible for refunding them.
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} disabled={cancelling} className="btn-outline flex-1">Keep Car</button>
              <button onClick={cancelTrip} disabled={cancelling} className="btn-danger flex-1">
                {cancelling ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
