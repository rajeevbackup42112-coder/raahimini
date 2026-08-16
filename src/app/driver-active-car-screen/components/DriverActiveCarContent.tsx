'use client';
import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2, X, MapPin, Users, Phone, ChevronRight,
  AlertTriangle, Loader2, Car, Lock, Navigation
} from 'lucide-react';
import { MOCK_DRIVER_TRIP, PassengerRequest } from '@/lib/mockData';
import SeatCountBadge from '@/components/ui/SeatCountBadge';
import StatusBadge from '@/components/ui/StatusBadge';

// BACKEND INTEGRATION POINT: All actions call canonical RPCs:
// driver_arrive_at_stop(), driver_advance_stop(), driver_confirm_payment(request_id),
// driver_mark_passenger_absent(request_id), driver_close_empty_seats(), start_trip(), complete_trip()

export default function DriverActiveCarContent() {
  const [trip, setTrip] = useState(MOCK_DRIVER_TRIP);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showCloseSeatsModal, setShowCloseSeatsModal] = useState(false);
  const [showStartTripModal, setShowStartTripModal] = useState(false);

  const heldRequests = trip.passenger_requests.filter((r) => r.status === 'HELD');
  const confirmedRequests = trip.passenger_requests.filter((r) => r.status === 'CONFIRMED');

  const canCloseSeats = trip.available_count > 0 && heldRequests.length === 0;
  const canStartTrip = trip.departure_eligible;
  const heldBlocking = heldRequests.length > 0;

  const handleConfirmPayment = (requestId: string) => {
    setLoadingAction(`confirm-${requestId}`);
    // BACKEND: driver_confirm_payment(request_id) RPC
    setTimeout(() => {
      setTrip((prev) => ({
        ...prev,
        confirmed_count: prev.confirmed_count + 1,
        held_count: prev.held_count - 1,
        available_count: prev.available_count,
        passenger_requests: prev.passenger_requests.map((r) =>
          r.request_id === requestId ? { ...r, status: 'CONFIRMED' as const } : r
        ),
        departure_eligible: prev.confirmed_count + 1 + prev.driver_closed_count === prev.capacity && prev.held_count - 1 === 0,
        held_count_blocking: Math.max(0, prev.held_count_blocking - 1),
      }));
      setLoadingAction(null);
      toast.success('Payment confirmed — seat is now CONFIRMED');
    }, 800);
  };

  const handleMarkAbsent = (requestId: string) => {
    setLoadingAction(`absent-${requestId}`);
    // BACKEND: driver_mark_passenger_absent(request_id) RPC
    setTimeout(() => {
      setTrip((prev) => ({
        ...prev,
        held_count: prev.held_count - 1,
        available_count: prev.available_count + 1,
        passenger_requests: prev.passenger_requests.filter((r) => r.request_id !== requestId),
        held_count_blocking: Math.max(0, prev.held_count_blocking - 1),
      }));
      setLoadingAction(null);
      toast.info('Passenger marked absent — seat released');
    }, 800);
  };

  const handleAdvanceStop = () => {
    setLoadingAction('advance-stop');
    // BACKEND: driver_advance_stop(trip_id) RPC
    setTimeout(() => {
      setTrip((prev) => ({
        ...prev,
        current_stop_order: Math.min(prev.current_stop_order + 1, prev.stops.length),
        current_stop_name: prev.stops[prev.current_stop_order]?.name ?? prev.current_stop_name,
        stops: prev.stops.map((s, idx) => ({
          ...s,
          is_passed: s.stop_order < prev.current_stop_order + 1,
          is_current: s.stop_order === prev.current_stop_order + 1,
        })),
      }));
      setLoadingAction(null);
      toast.success('Stop advanced');
    }, 600);
  };

  const handleCloseSeats = () => {
    setLoadingAction('close-seats');
    // BACKEND: driver_close_empty_seats(trip_id) RPC
    setTimeout(() => {
      setTrip((prev) => ({
        ...prev,
        driver_closed_count: prev.driver_closed_count + prev.available_count,
        available_count: 0,
        departure_eligible: prev.confirmed_count + prev.driver_closed_count + prev.available_count === prev.capacity && prev.held_count === 0,
      }));
      setLoadingAction(null);
      setShowCloseSeatsModal(false);
      toast.success('Empty seats closed — ready to depart');
    }, 800);
  };

  const handleStartTrip = () => {
    setLoadingAction('start-trip');
    // BACKEND: start_trip(trip_id) RPC — PostgreSQL validates departure invariant
    setTimeout(() => {
      setLoadingAction(null);
      setShowStartTripModal(false);
      toast.success('Trip started — next driver is now collecting');
    }, 1000);
  };

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
          <SeatCountBadge label="Total" count={trip.capacity} variant="capacity" />
          <SeatCountBadge label="Confirmed" count={trip.confirmed_count} variant="confirmed" />
          <SeatCountBadge label="Held" count={trip.held_count} variant="held" />
          <SeatCountBadge label="Available" count={trip.available_count} variant="available" />
          <SeatCountBadge label="Closed" count={trip.driver_closed_count} variant="closed" />
        </div>
      </div>

      {/* Departure Eligibility */}
      {!canStartTrip && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Not Yet Ready to Depart</p>
            <ul className="text-xs text-amber-700 mt-1 space-y-0.5 list-disc list-inside">
              {heldBlocking && <li>{heldRequests.length} held request{heldRequests.length > 1 ? 's' : ''} must be confirmed, withdrawn, or expired</li>}
              {trip.available_count > 0 && <li>{trip.available_count} seat{trip.available_count > 1 ? 's' : ''} still available — confirm passengers or close empty seats</li>}
            </ul>
          </div>
        </div>
      )}

      {canStartTrip && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-green-800">All seats accounted for — Ready to Start Trip</p>
        </div>
      )}

      {/* Passenger Requests */}
      <div>
        <p className="section-label mb-2">Passenger Requests ({trip.passenger_requests.length})</p>
        <div className="space-y-2">
          {trip.passenger_requests.length === 0 && (
            <div className="card p-6 text-center">
              <Users size={32} className="mx-auto text-muted-foreground opacity-40 mb-2" />
              <p className="text-sm text-muted-foreground">No passenger requests yet</p>
            </div>
          )}
          {trip.passenger_requests.map((req) => (
            <PassengerRequestRow
              key={req.request_id}
              request={req}
              loadingAction={loadingAction}
              onConfirm={handleConfirmPayment}
              onAbsent={handleMarkAbsent}
            />
          ))}
        </div>
      </div>

      {/* Stop Progression */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Pickup Progress</p>
          <span className="text-xs text-muted-foreground">
            Stop {trip.current_stop_order} of {trip.stops.length}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-4 bg-secondary rounded-xl px-3 py-2">
          <Navigation size={14} className="text-primary" />
          <p className="text-sm font-semibold text-secondary-foreground">
            Currently at: <strong>{trip.current_stop_name}</strong>
          </p>
        </div>
        <div className="flex gap-1 mb-2">
          {trip.stops.map((stop) => (
            <div
              key={stop.stop_id}
              className={`flex-1 h-2.5 rounded-full ${
                stop.is_passed ? 'bg-accent' : stop.is_current ?'bg-primary': 'bg-border'
              }`}
              title={stop.name}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{trip.stops[0]?.name}</span>
          <span>{trip.stops[trip.stops.length - 1]?.name}</span>
        </div>
        <button
          onClick={handleAdvanceStop}
          disabled={!!loadingAction || trip.current_stop_order >= trip.stops.length}
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

      {/* Close Empty Seats */}
      {trip.available_count > 0 && (
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
          Close {trip.available_count} Empty Seat{trip.available_count > 1 ? 's' : ''} & Go
          {heldBlocking && <span className="text-xs">(resolve held requests first)</span>}
        </button>
      )}

      {/* Start Trip */}
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
        {loadingAction === 'start-trip' ? 'Starting Trip...' : 'Start Trip to Dhanbad'}
      </button>

      {/* Close Seats Modal */}
      {showCloseSeatsModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
          <div className="w-full max-w-md bg-card rounded-t-3xl p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-bold text-foreground">Close Empty Seats?</h2>
            <p className="text-sm text-muted-foreground">
              You are about to close <strong>{trip.available_count} empty seat{trip.available_count > 1 ? 's' : ''}</strong>. This is irreversible for this trip. Actual occupancy will be recorded as {trip.confirmed_count} of {trip.capacity}.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowCloseSeatsModal(false)} className="btn-outline flex-1">Cancel</button>
              <button
                onClick={handleCloseSeats}
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
              This will mark the trip as IN_PROGRESS and the next queued driver will immediately become ACTIVE_COLLECTING.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowStartTripModal(false)} className="btn-outline flex-1">Not Yet</button>
              <button
                onClick={handleStartTrip}
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
      isConfirmed ? 'border-l-green-500' : isHeld ?'border-l-amber-500': 'border-l-border'
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
        <a
          href={`tel:${request.phone_masked.replace(/\s/g, '')}`}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-accent/10 hover:bg-accent/20 transition-colors duration-150"
          aria-label={`Call ${request.passenger_display_name}`}
        >
          <Phone size={16} className="text-accent" />
        </a>
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