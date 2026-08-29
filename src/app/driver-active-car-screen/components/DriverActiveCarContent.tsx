'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2, X, MapPin, Users, Phone,
  Loader2, Car, Lock, Navigation, RefreshCw, ShieldCheck
} from 'lucide-react';
import { getDriverActiveCar, getDriverReturnDemandSignal, driverConfirmPayment, driverMarkPassengerAbsent, driverAdvanceStop, driverCloseEmptySeats, startTrip, completeTrip, type DriverActiveTrip, type PassengerRequest } from '@/lib/raahiApi';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/ui/StatusBadge';
import UnifiedTripCard from '@/components/UnifiedTripCard';

export default function DriverActiveCarContent({ locationReady = false, onTripStarted }: { locationReady?: boolean; onTripStarted?: () => void }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [trip, setTrip] = useState<DriverActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showCloseSeatsModal, setShowCloseSeatsModal] = useState(false);
  const [autoCompleteError, setAutoCompleteError] = useState('');
  const [autoCompleteRetry, setAutoCompleteRetry] = useState(0);
  const [returnDemandLevel, setReturnDemandLevel] = useState<'Low'|'Medium'|'High'|null>(null);
  const autoStartAttemptRef = useRef<string | null>(null);
  const autoCompleteAttemptRef = useRef<string | null>(null);

  const fetchTrip = useCallback(async () => {
    const data = await getDriverActiveCar();
    setTrip(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && user) fetchTrip();
    else if (!authLoading) setLoading(false);
  }, [authLoading, user, fetchTrip]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (trip?.status !== 'IN_PROGRESS' || !trip.trip_id) { setReturnDemandLevel(null); return; }
      const signal = await getDriverReturnDemandSignal(trip.trip_id);
      if (!cancelled) setReturnDemandLevel(signal.has_signal ? signal.level ?? 'Low' : null);
    };
    void load();
    return () => { cancelled = true; };
  }, [trip?.status, trip?.trip_id]);

  const handleAction = async (actionKey: string, fn: () => Promise<any>, successMsg: string) => {
    setLoadingAction(actionKey);
    const result = await fn();
    setLoadingAction(null);
    if (result?.success) {
      toast.success(successMsg);
      fetchTrip();
    } else {
      toast.error(result?.error || 'Action failed');
    }
  };

  useEffect(() => {
    if (!trip?.trip_id || trip.status !== 'IN_PROGRESS' || trip.next_action !== 'COMPLETE_TRIP') {
      if (trip?.status !== 'IN_PROGRESS' || trip?.next_action !== 'COMPLETE_TRIP') {
        autoCompleteAttemptRef.current = null;
        setAutoCompleteError('');
      }
      return;
    }
    if (loadingAction || autoCompleteAttemptRef.current === trip.trip_id) return;
    autoCompleteAttemptRef.current = trip.trip_id;
    setAutoCompleteError('');
    setLoadingAction('auto-complete');
    void completeTrip(trip.trip_id).then((result) => {
      setLoadingAction(null);
      if (result?.success) {
        toast.success('Arrived - trip completed automatically');
        void fetchTrip();
      } else {
        setAutoCompleteError(result?.error || 'Could not finalize the trip automatically');
      }
    });
  }, [trip?.trip_id, trip?.status, trip?.next_action, loadingAction, fetchTrip, autoCompleteRetry]);

  useEffect(() => {
    if (!trip?.trip_id || trip.status !== 'ACTIVE_COLLECTING' || !trip.departure_eligible || !locationReady) {
      if (!locationReady || !trip?.departure_eligible || trip?.status !== 'ACTIVE_COLLECTING') autoStartAttemptRef.current = null;
      return;
    }
    if (loadingAction || autoStartAttemptRef.current === trip.trip_id) return;
    autoStartAttemptRef.current = trip.trip_id;
    setLoadingAction('auto-start');
    void startTrip(trip.trip_id).then((result) => {
      setLoadingAction(null);
      if (result?.success) {
        toast.success('Everyone is aboard - trip started automatically');
        onTripStarted?.();
        void fetchTrip();
      } else {
        toast.error(result?.error || 'Could not start trip automatically');
      }
    });
  }, [trip?.trip_id, trip?.status, trip?.departure_eligible, locationReady, loadingAction, fetchTrip, onTripStarted]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 py-8 text-center space-y-3">
        <ShieldCheck size={40} className="mx-auto text-muted-foreground opacity-40" />
        <p className="text-base font-semibold text-foreground">Driver Sign In Required</p>
        <p className="text-sm text-muted-foreground">Sign in with your driver account to access this screen.</p>
      </div>
    );
  }

  if (profile && profile.role !== 'driver' && profile.role !== 'admin') {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 py-8 text-center space-y-3">
        <ShieldCheck size={40} className="mx-auto text-muted-foreground opacity-40" />
        <p className="text-base font-semibold text-foreground">Driver Access Only</p>
        <p className="text-sm text-muted-foreground">This screen is only accessible to registered drivers.</p>
      </div>
    );
  }

  if (!trip?.has_active_trip) {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 py-8 text-center space-y-4">
        <Car size={40} className="mx-auto text-muted-foreground opacity-40" />
        <p className="text-base font-semibold text-foreground">No Active Trip</p>
        <p className="text-sm text-muted-foreground">Join the driver queue to start collecting passengers.</p>
        <button onClick={fetchTrip} className="btn-outline mx-auto">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
    );
  }

  const heldRequests = (trip.passenger_requests ?? []).filter((r) => r.status === 'HELD');
  const canAutoStart = (trip.departure_eligible ?? false) && locationReady;
  const heldBlocking = heldRequests.length > 0;
  const atFinalStop = trip.next_action === 'COMPLETE_TRIP';
  const nextStop = trip.next_operational_stop;
  const nextAction = trip.next_action === 'PICKUP_NOW'
    ? `Pick up at ${nextStop?.name ?? trip.current_stop_name ?? 'this stop'}`
    : trip.next_action === 'DRIVE_TO_PICKUP'
      ? `Next pickup: ${nextStop?.name ?? 'passenger stop'}`
      : trip.next_action === 'READY_TO_START'
        ? (locationReady ? 'Everyone aboard - starting automatically' : 'Everyone aboard - enable location')
        : trip.next_action === 'WAIT_OR_CLOSE_SEATS'
          ? 'Wait for a passenger or close empty seats'
          : trip.next_action === 'DRIVE_TO_DESTINATION'
            ? `Drive to ${nextStop?.name ?? trip.to_location ?? 'destination'}`
            : trip.next_action === 'COMPLETE_TRIP'
              ? 'Trip complete at destination'
              : 'Get ready';
  return (
    <div className="mx-auto w-full max-w-screen-lg space-y-3 px-4 py-3 pb-8 animate-fade-in sm:px-6 sm:py-5">
      <UnifiedTripCard
        eyebrow={trip.status === 'ACTIVE_COLLECTING' ? 'Collecting' : 'Live trip'}
        from={trip.from_location ?? 'Origin'}
        to={trip.to_location ?? 'Destination'}
        statusLabel={trip.status === 'ACTIVE_COLLECTING' ? 'Collecting passengers' : 'Trip in progress'}
        statusTone={trip.status === 'ACTIVE_COLLECTING' ? (canAutoStart ? 'good' : 'limited') : 'transit'}
        vehicleLabel={`${trip.vehicle_model ?? 'Raahi car'}${trip.vehicle_number ? ` · ${trip.vehicle_number}` : ''}`}
        seatsFilled={trip.confirmed_count ?? 0}
        seatsTotal={trip.capacity ?? 0}
        seatsLeft={trip.available_count ?? 0}
        farePerSeat={trip.status === 'ACTIVE_COLLECTING' ? trip.fare_per_seat ?? null : null}
        pickupLabel={trip.status === 'ACTIVE_COLLECTING' ? trip.current_stop_name : undefined}
        confidenceLabel={nextAction}
      >
        {(trip.held_count ?? 0) > 0 && (
          <p className="border-t border-border pt-3 text-xs font-semibold text-amber-700">Resolve {trip.held_count} held seat{trip.held_count === 1 ? '' : 's'} before departure.</p>
        )}
      </UnifiedTripCard>

      {trip.status === 'ACTIVE_COLLECTING' && (trip.departure_eligible ?? false) && !locationReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Everyone is aboard. Turn on location to continue; Raahi will start the trip automatically.
        </div>
      )}

      {trip.status === 'ACTIVE_COLLECTING' && canAutoStart && (
        <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
          <Loader2 size={17} className="animate-spin" /> Everyone is aboard - starting automatically
        </div>
      )}

      {/* One meaningful next stop only */}
      {nextStop && (
        <section className={`rounded-3xl border bg-card p-4 card-shadow-sm sm:p-5 ${trip.next_action === 'PICKUP_NOW' ? 'border-green-200' : 'border-border'}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="section-label">{trip.next_action === 'PICKUP_NOW' ? 'Pickup now' : nextStop.action === 'PICKUP' ? 'Next pickup' : 'Destination'}</p>
            {trip.next_action === 'PICKUP_NOW' && <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700">You are here</span>}
          </div>
          <div className="mt-3 flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${trip.next_action === 'PICKUP_NOW' ? 'bg-green-100 text-green-700' : 'bg-secondary text-primary'}`}>
              <Navigation size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">{nextStop.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {nextStop.action === 'PICKUP'
                  ? `${nextStop.request_count} passenger request${nextStop.request_count === 1 ? '' : 's'} · ${nextStop.seat_count} seat${nextStop.seat_count === 1 ? '' : 's'}`
                  : 'Final destination'}
              </p>
            </div>
          </div>
          {(trip.next_action === 'DRIVE_TO_PICKUP' || trip.next_action === 'DRIVE_TO_DESTINATION') && (
            <button
              onClick={() => handleAction('advance-stop', () => driverAdvanceStop(trip.trip_id!), `Arrived at ${nextStop.name}`)}
              disabled={!!loadingAction}
              className="btn-accent mt-4 w-full"
            >
              {loadingAction === 'advance-stop' ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
              {loadingAction === 'advance-stop' ? 'Updating...' : `Arrived at ${nextStop.name}`}
            </button>
          )}
          {trip.next_action === 'PICKUP_NOW' && (
            <div className="mt-4 rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
              Resolve the waiting passenger below, then Raahi will show the next action.
            </div>
          )}
        </section>
      )}

      {trip.status === 'IN_PROGRESS' && atFinalStop && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold text-green-800">
            <Loader2 size={17} className={loadingAction === 'auto-complete' ? 'animate-spin' : ''} />
            {autoCompleteError ? 'Arrival recorded - finalization needs a retry' : 'Arrived at destination - completing trip automatically'}
          </div>
          {autoCompleteError && (
            <div className="mt-2">
              <p className="text-xs text-red-700">{autoCompleteError}</p>
              <button
                onClick={() => {
                  autoCompleteAttemptRef.current = null;
                  setAutoCompleteRetry((n) => n + 1);
                }}
                className="btn-outline mt-2"
              >
                Retry finalization
              </button>
            </div>
          )}
        </div>
      )}

      {trip.status === 'IN_PROGRESS' && returnDemandLevel && (
        <div className="rounded-2xl border border-border bg-card px-4 py-3 card-shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div><p className="section-label">After arrival</p><p className="mt-1 text-sm font-extrabold text-foreground">Return demand: {returnDemandLevel}</p></div>
            <p className="text-xs font-semibold text-muted-foreground">{trip.to_location} → {trip.from_location}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Return demand after arrival · advisory only · never changes FIFO.</p>
        </div>
      )}

      {/* Passenger Requests */}
      <div>
        <div className="mb-2 flex items-end justify-between gap-3">
          <div><p className="section-label">Passengers</p><p className="mt-1 text-sm font-bold text-foreground">{heldRequests.length ? `${heldRequests.length} passenger${heldRequests.length === 1 ? '' : 's'} ${heldRequests.length === 1 ? 'needs' : 'need'} attention` : 'All current requests resolved'}</p></div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-primary">{trip.confirmed_count ?? 0} aboard</span>
        </div>
        <div className="space-y-2">
          {(trip.passenger_requests ?? []).length === 0 && (
            <div className="compact-card py-5 text-center">
              <Users size={32} className="mx-auto text-muted-foreground opacity-40 mb-2" />
              <p className="text-sm text-muted-foreground">No passenger requests yet</p>
            </div>
          )}
          {(trip.passenger_requests ?? []).map((req) => (
            <PassengerRequestRow
              key={req.request_id}
              request={req}
              loadingAction={loadingAction}
              onConfirm={(id) => handleAction(
                `confirm-${id}`,
                () => driverConfirmPayment(id),
                'Payment confirmed — seat is now CONFIRMED'
              )}
              onAbsent={(id) => handleAction(
                `absent-${id}`,
                () => driverMarkPassengerAbsent(id),
                'Passenger marked absent — seat released'
              )}
            />
          ))}
        </div>
      </div>

      {/* Close Empty Seats */}
      {trip.status === 'ACTIVE_COLLECTING' && (trip.available_count ?? 0) > 0 && (
        <button
          onClick={() => setShowCloseSeatsModal(true)}
          disabled={heldBlocking || !!loadingAction}
          className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all active:scale-[0.99] ${
            heldBlocking
              ? 'cursor-not-allowed border-border bg-muted/60 text-muted-foreground'
              : 'border-border bg-card text-foreground hover:border-primary/30'
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${heldBlocking ? 'bg-card' : 'bg-secondary text-primary'}`}><Lock size={16} /></div>
            <div className="min-w-0"><p className="text-sm font-bold">Close {trip.available_count} empty seat{(trip.available_count ?? 0) > 1 ? 's' : ''}</p><p className="mt-0.5 text-xs text-muted-foreground">{heldBlocking ? 'Resolve held requests first.' : 'Stop accepting more passengers for this trip.'}</p></div>
          </div>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide">{heldBlocking ? 'Locked' : 'Review'}</span>
        </button>
      )}

      {/* Close Seats Modal */}
      {showCloseSeatsModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
          <div className="w-full max-w-md bg-card rounded-t-3xl p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-bold text-foreground">Close Empty Seats?</h2>
            <p className="text-sm text-muted-foreground">
              You are about to close <strong>{trip.available_count} empty seat{(trip.available_count ?? 0) > 1 ? 's' : ''}</strong>. This is irreversible for this trip. Actual occupancy will be recorded as {trip.confirmed_count} of {trip.capacity}.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowCloseSeatsModal(false)} className="btn-outline flex-1">Cancel</button>
              <button
                onClick={() => {
                  setShowCloseSeatsModal(false);
                  handleAction('close-seats', () => driverCloseEmptySeats(trip.trip_id!), 'Empty seats closed - Raahi will depart automatically when location is ready');
                }}
                disabled={loadingAction === 'close-seats'}
                className="btn-primary flex-1"
              >
                {loadingAction === 'close-seats' ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                Confirm & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PassengerRequestRow({
  request,
  loadingAction,
  onConfirm,
  onAbsent,
}: {
  request: PassengerRequest;
  loadingAction: string | null;
  onConfirm: (id: string) => void;
  onAbsent: (id: string) => void;
}) {
  const isHeld = request.status === 'HELD';
  const isConfirmed = request.status === 'CONFIRMED';
  const isLoadingConfirm = loadingAction === `confirm-${request.request_id}`;
  const isLoadingAbsent = loadingAction === `absent-${request.request_id}`;

  return (
    <div className={`rounded-2xl border bg-card p-4 card-shadow-sm ${
      isConfirmed ? 'border-green-200' : isHeld && request.is_at_pickup ? 'border-amber-300' : 'border-border'
    }`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{request.passenger_display_name}</span>
            <StatusBadge status={isConfirmed ? 'confirmed' : 'held'} />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={11} />
              <span>{request.pickup_stop_name}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users size={11} />
              <span>{request.seat_count} seat{request.seat_count > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        {request.phone_masked && (
          <a
            href={`tel:${request.phone_masked.replace(/\s/g, '')}`}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-accent/10 hover:bg-accent/20 transition-colors duration-150"
            aria-label={`Call ${request.passenger_display_name}`}
          >
            <Phone size={16} className="text-accent" />
          </a>
        )}
      </div>

      {isHeld && request.is_at_pickup && (
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(request.request_id)}
            disabled={!!loadingAction}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white font-semibold rounded-xl px-3 py-2.5 text-sm transition-all duration-150 active:scale-95 hover:bg-green-700 disabled:opacity-50"
          >
            {isLoadingConfirm ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Boarded & Paid
          </button>
          <button
            onClick={() => onAbsent(request.request_id)}
            disabled={!!loadingAction}
            className="flex items-center justify-center gap-2 border border-red-200 text-red-600 font-semibold rounded-xl px-3 py-2.5 text-sm transition-all duration-150 active:scale-95 hover:bg-red-50 disabled:opacity-50"
          >
            {isLoadingAbsent ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
            Absent
          </button>
        </div>
      )}
      {isHeld && !request.is_at_pickup && (
        <div className="rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
          Waiting at {request.pickup_stop_name}
        </div>
      )}

      {isConfirmed && (
        <div className="flex items-center gap-2 bg-green-50 rounded-xl px-3 py-2">
          <CheckCircle2 size={14} className="text-green-600" />
          <p className="text-xs font-semibold text-green-700">Boarded · Payment received</p>
        </div>
      )}
    </div>
  );
}