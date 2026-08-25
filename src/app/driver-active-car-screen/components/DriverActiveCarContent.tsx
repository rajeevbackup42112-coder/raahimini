'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2, X, MapPin, Users, Phone,
  Loader2, Car, Lock, Navigation, RefreshCw, ShieldCheck
} from 'lucide-react';
import { getDriverActiveCar, getDriverReturnDemandSignal, driverConfirmPayment, driverMarkPassengerAbsent, driverAdvanceStop, driverCloseEmptySeats, startTrip, completeTrip, type DriverActiveTrip, type PassengerRequest } from '@/lib/raahiApi';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/ui/StatusBadge';
import UnifiedTripCard from '@/components/UnifiedTripCard';

export default function DriverActiveCarContent({ locationReady = false }: { locationReady?: boolean }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [trip, setTrip] = useState<DriverActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showCloseSeatsModal, setShowCloseSeatsModal] = useState(false);
  const [showStartTripModal, setShowStartTripModal] = useState(false);
  const [showCompleteTripModal, setShowCompleteTripModal] = useState(false);
  const [returnDemandLevel, setReturnDemandLevel] = useState<'Low'|'Medium'|'High'|null>(null);

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
  const canStartTrip = (trip.departure_eligible ?? false) && locationReady;
  const heldBlocking = heldRequests.length > 0;
  const atFinalStop = trip.next_action === 'COMPLETE_TRIP';
  const nextStop = trip.next_operational_stop;
  const nextAction = trip.next_action === 'PICKUP_NOW'
    ? `Pick up at ${nextStop?.name ?? trip.current_stop_name ?? 'this stop'}`
    : trip.next_action === 'DRIVE_TO_PICKUP'
      ? `Next pickup: ${nextStop?.name ?? 'passenger stop'}`
      : trip.next_action === 'READY_TO_START'
        ? (locationReady ? 'Ready to start' : 'All aboard · enable location')
        : trip.next_action === 'WAIT_OR_CLOSE_SEATS'
          ? 'Wait for a passenger or close empty seats'
          : trip.next_action === 'DRIVE_TO_DESTINATION'
            ? `Drive to ${nextStop?.name ?? trip.to_location ?? 'destination'}`
            : trip.next_action === 'COMPLETE_TRIP'
              ? 'Trip complete at destination'
              : 'Get ready';
  return (
    <div className="mobile-page space-y-3 animate-fade-in">
      <UnifiedTripCard
        from={trip.from_location ?? 'Origin'}
        to={trip.to_location ?? 'Destination'}
        statusLabel={trip.status === 'ACTIVE_COLLECTING' ? 'Collecting passengers' : 'Trip in progress'}
        statusTone={trip.status === 'ACTIVE_COLLECTING' ? (canStartTrip ? 'good' : 'limited') : 'transit'}
        vehicleLabel={`${trip.vehicle_model ?? 'Raahi car'}${trip.vehicle_number ? ` · ${trip.vehicle_number}` : ''}`}
        seatsFilled={trip.confirmed_count ?? 0}
        seatsTotal={trip.capacity ?? 0}
        seatsLeft={trip.available_count ?? 0}
        farePerSeat={trip.fare_per_seat ?? null}
        pickupLabel={trip.current_stop_name}
        confidenceLabel={nextAction}
      >
        {(trip.held_count ?? 0) > 0 && (
          <p className="border-t border-border pt-3 text-xs font-semibold text-amber-700">Resolve {trip.held_count} held seat{trip.held_count === 1 ? '' : 's'} before departure.</p>
        )}
      </UnifiedTripCard>

      {trip.status === 'IN_PROGRESS' && returnDemandLevel && (
        <div className="compact-card">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Return demand after arrival</p>
          <p className="mt-1 text-base font-bold text-foreground">{trip.to_location} → {trip.from_location}: {returnDemandLevel}</p>
          <p className="mt-1 text-xs text-muted-foreground">Advisory only · never changes FIFO.</p>
        </div>
      )}

      {trip.status === 'ACTIVE_COLLECTING' && !canStartTrip && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {heldBlocking
            ? `Resolve ${heldRequests.length} held passenger${heldRequests.length === 1 ? '' : 's'} before you go.`
            : `${trip.available_count ?? 0} seat${(trip.available_count ?? 0) === 1 ? '' : 's'} still open.`}
        </div>
      )}

      {trip.status === 'ACTIVE_COLLECTING' && canStartTrip && (
        <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
          <CheckCircle2 size={17} /> Ready to start
        </div>
      )}

      {/* One meaningful next stop only */}
      {nextStop && (
        <div className="compact-card">
          <p className="section-label">{nextStop.action === 'PICKUP' ? 'Next pickup' : 'Destination'}</p>
          <div className="mt-2 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
              <Navigation size={18} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-foreground">{nextStop.name}</p>
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
            <div className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
              You are here. Confirm or mark the waiting passenger absent below.
            </div>
          )}
        </div>
      )}


      {/* Passenger Requests */}
      <div>
        <p className="section-label mb-2">Passenger Requests ({(trip.passenger_requests ?? []).length})</p>
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
          className={`w-full flex items-center justify-center gap-2 rounded-2xl px-5 py-4 font-semibold text-base transition-all duration-150 active:scale-95 ${
            heldBlocking
              ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
              : 'bg-secondary border border-border text-accent hover:bg-secondary/70'
          }`}
        >
          <Lock size={18} />
          Close {trip.available_count} Empty Seat{(trip.available_count ?? 0) > 1 ? 's' : ''}
          {heldBlocking && <span className="text-xs">(resolve held requests first)</span>}
        </button>
      )}

      {/* Start Trip */}
      {trip.status === 'ACTIVE_COLLECTING' && (
        <button
          onClick={() => setShowStartTripModal(true)}
          disabled={!canStartTrip || !!loadingAction}
          className="btn-primary w-full"
        >
          {loadingAction === 'start-trip' ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Car size={18} />
          )}
          {loadingAction === 'start-trip' ? 'Starting Trip...' : `Start Trip to ${trip.to_location}`}
        </button>
      )}

      {/* Complete Trip */}
      {trip.status === 'IN_PROGRESS' && atFinalStop && (
        <button
          onClick={() => setShowCompleteTripModal(true)}
          disabled={!!loadingAction}
          className="btn-primary w-full"
        >
          {loadingAction === 'complete-trip' ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <CheckCircle2 size={18} />
          )}
          {loadingAction === 'complete-trip' ? 'Completing...' : 'Complete Trip'}
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
                  handleAction('close-seats', () => driverCloseEmptySeats(trip.trip_id!), 'Empty seats closed — ready to depart');
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

      {/* Start Trip Modal */}
      {showStartTripModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
          <div className="w-full max-w-md bg-card rounded-t-3xl p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-bold text-foreground">Start Trip?</h2>
            <p className="text-sm text-muted-foreground">
              This starts your journey. Once you leave, the next FIFO driver for this direction can begin collecting the next car.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowStartTripModal(false)} className="btn-outline flex-1">Not Yet</button>
              <button
                onClick={() => {
                  setShowStartTripModal(false);
                  handleAction('start-trip', () => startTrip(trip.trip_id!), 'Trip started successfully');
                }}
                disabled={loadingAction === 'start-trip'}
                className="btn-primary flex-1"
              >
                {loadingAction === 'start-trip' ? <Loader2 size={16} className="animate-spin" /> : <Car size={16} />}
                Start Trip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Trip Modal */}
      {showCompleteTripModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
          <div className="w-full max-w-md bg-card rounded-t-3xl p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-bold text-foreground">Complete Trip?</h2>
            <p className="text-sm text-muted-foreground">
              Confirm that you have arrived at the destination and the trip is complete.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowCompleteTripModal(false)} className="btn-outline flex-1">Not Yet</button>
              <button
                onClick={() => {
                  setShowCompleteTripModal(false);
                  handleAction('complete-trip', () => completeTrip(trip.trip_id!), 'Trip completed successfully!');
                }}
                disabled={loadingAction === 'complete-trip'}
                className="btn-primary flex-1"
              >
                {loadingAction === 'complete-trip' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Complete Trip
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
    <div className={`card p-4 border-l-4 ${
      isConfirmed ? 'border-l-green-500' : isHeld ? 'border-l-amber-500' : 'border-l-border'
    }`}>
      <div className="flex items-start justify-between mb-3">
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
