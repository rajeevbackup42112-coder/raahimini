'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2, X, MapPin, Users, Phone, ChevronRight,
  AlertTriangle, Loader2, Car, Lock, Navigation, RefreshCw, ShieldCheck
} from 'lucide-react';
import { getDriverActiveCar, driverConfirmPayment, driverMarkPassengerAbsent, driverAdvanceStop, driverCloseEmptySeats, startTrip, completeTrip, type DriverActiveTrip, type PassengerRequest } from '@/lib/raahiApi';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import SeatCountBadge from '@/components/ui/SeatCountBadge';
import StatusBadge from '@/components/ui/StatusBadge';

export default function DriverActiveCarContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const [trip, setTrip] = useState<DriverActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showCloseSeatsModal, setShowCloseSeatsModal] = useState(false);
  const [showStartTripModal, setShowStartTripModal] = useState(false);
  const [showCompleteTripModal, setShowCompleteTripModal] = useState(false);

  const fetchTrip = useCallback(async () => {
    const data = await getDriverActiveCar();
    setTrip(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && user) fetchTrip();
    else if (!authLoading) setLoading(false);
  }, [authLoading, user, fetchTrip]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const channel = supabase
      .channel('driver_trip_watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => fetchTrip())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seat_requests' }, () => fetchTrip())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchTrip]);

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
  const confirmedRequests = (trip.passenger_requests ?? []).filter((r) => r.status === 'CONFIRMED');
  const canCloseSeats = (trip.available_count ?? 0) > 0 && heldRequests.length === 0;
  const canStartTrip = trip.departure_eligible ?? false;
  const heldBlocking = heldRequests.length > 0;
  const stopCount = trip.stops?.length ?? 0;
  const finalStopOrder = trip.stops?.[stopCount - 1]?.stop_order;
  const atFinalStop = finalStopOrder != null && trip.current_stop_order === finalStopOrder;

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-4 space-y-4 animate-fade-in">
      {/* Route Info */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
            <Car size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">{trip.route_code} · {trip.vehicle_number}</p>
            <p className="text-sm font-bold text-foreground">{trip.route_label}</p>
            <p className="text-xs text-muted-foreground">{trip.vehicle_model} · {trip.vehicle_type}</p>
          </div>
          <div className="ml-auto">
            <StatusBadge status={trip.status === 'ACTIVE_COLLECTING' ? 'collecting' : 'in-progress'} />
          </div>
        </div>
      </div>

      {/* Seat Stats */}
      <div>
        <p className="section-label mb-2">Seat Accounting</p>
        <div className="grid grid-cols-5 gap-1.5">
          <SeatCountBadge label="Total" count={trip.capacity ?? 0} variant="capacity" />
          <SeatCountBadge label="Confirmed" count={trip.confirmed_count ?? 0} variant="confirmed" />
          <SeatCountBadge label="Held" count={trip.held_count ?? 0} variant="held" />
          <SeatCountBadge label="Available" count={trip.available_count ?? 0} variant="available" />
          <SeatCountBadge label="Closed" count={trip.driver_closed_count ?? 0} variant="closed" />
        </div>
      </div>

      {/* Departure Eligibility */}
      {!canStartTrip && trip.status === 'ACTIVE_COLLECTING' && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Not Yet Ready to Depart</p>
            <ul className="text-xs text-amber-700 mt-1 space-y-0.5 list-disc list-inside">
              {heldBlocking && <li>{heldRequests.length} held request{heldRequests.length > 1 ? 's' : ''} must be confirmed, withdrawn, or expired</li>}
              {(trip.available_count ?? 0) > 0 && <li>{trip.available_count} seat{(trip.available_count ?? 0) > 1 ? 's' : ''} still available — confirm passengers or close empty seats</li>}
            </ul>
          </div>
        </div>
      )}

      {canStartTrip && trip.status === 'ACTIVE_COLLECTING' && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-green-800">All seats accounted for — Ready to Start Trip</p>
        </div>
      )}

      {/* Passenger Requests */}
      <div>
        <p className="section-label mb-2">Passenger Requests ({(trip.passenger_requests ?? []).length})</p>
        <div className="space-y-2">
          {(trip.passenger_requests ?? []).length === 0 && (
            <div className="card p-6 text-center">
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

      {/* Stop Progression */}
      {(trip.status === 'ACTIVE_COLLECTING' || trip.status === 'IN_PROGRESS') && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">{trip.status === 'IN_PROGRESS' ? 'Trip Progress' : 'Pickup Progress'}</p>
            <span className="text-xs text-muted-foreground">
              Stop {trip.current_stop_order} of {(trip.stops ?? []).length}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-4 bg-secondary rounded-xl px-3 py-2">
            <Navigation size={14} className="text-primary" />
            <p className="text-sm font-semibold text-secondary-foreground">
              Currently at: <strong>{trip.current_stop_name}</strong>
            </p>
          </div>
          <div className="flex gap-1 mb-2">
            {(trip.stops ?? []).map((stop) => (
              <div
                key={stop.stop_id}
                className={`flex-1 h-2.5 rounded-full ${
                  stop.is_passed ? 'bg-accent' : stop.is_current ? 'bg-primary' : 'bg-border'
                }`}
                title={stop.name}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{trip.stops?.[0]?.name}</span>
            <span>{trip.stops?.[trip.stops.length - 1]?.name}</span>
          </div>
          <button
            onClick={() => handleAction(
              'advance-stop',
              () => driverAdvanceStop(trip.trip_id!),
              'Stop advanced'
            )}
            disabled={!!loadingAction || (trip.current_stop_order ?? 0) >= (trip.stops?.length ?? 0)}
            className="btn-accent w-full mt-3"
          >
            {loadingAction === 'advance-stop' ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ChevronRight size={18} />
            )}
            {loadingAction === 'advance-stop' ? 'Advancing...' : 'Arrived at Next Stop'}
          </button>
        </div>
      )}

      {/* Close Empty Seats */}
      {trip.status === 'ACTIVE_COLLECTING' && (trip.available_count ?? 0) > 0 && (
        <button
          onClick={() => setShowCloseSeatsModal(true)}
          disabled={heldBlocking || !!loadingAction}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl px-5 py-4 font-semibold text-base transition-all duration-150 active:scale-95 ${
            heldBlocking
              ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
              : 'bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100'
          }`}
        >
          <Lock size={18} />
          Close {trip.available_count} Empty Seat{(trip.available_count ?? 0) > 1 ? 's' : ''} & Go
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
              This will mark the trip as in progress. If another driver is waiting, Raahi will activate that driver for passenger collection.
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

      {isHeld && (
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(request.request_id)}
            disabled={!!loadingAction}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white font-semibold rounded-xl px-3 py-2.5 text-sm transition-all duration-150 active:scale-95 hover:bg-green-700 disabled:opacity-50"
          >
            {isLoadingConfirm ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Payment Received
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

      {isConfirmed && (
        <div className="flex items-center gap-2 bg-green-50 rounded-xl px-3 py-2">
          <CheckCircle2 size={14} className="text-green-600" />
          <p className="text-xs font-semibold text-green-700">Confirmed — Payment received</p>
        </div>
      )}
    </div>
  );
}