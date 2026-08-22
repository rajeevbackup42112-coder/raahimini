'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Phone, X, MapPin, Car, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { getMyActiveRequest, withdrawSeatRequest, type PassengerRideStatus } from '@/lib/raahiApi';
import { useAuth } from '@/contexts/AuthContext';
import PayWarningBanner from '@/components/ui/PayWarningBanner';
import UnifiedTripCard from '@/components/UnifiedTripCard';

export default function RequestStatusContent() {
  const { user, loading: authLoading } = useAuth();
  const [rideStatus, setRideStatus] = useState<PassengerRideStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const data = await getMyActiveRequest();
    setRideStatus(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) fetchStatus();
  }, [authLoading, fetchStatus]);

  const handleWithdraw = async () => {
    if (!rideStatus?.request_id) return;
    setWithdrawing(true);
    const result = await withdrawSeatRequest(rideStatus.request_id);
    setWithdrawing(false);
    setShowWithdrawConfirm(false);
    if (result.success) {
      toast.success('Request withdrawn — seat is now available again');
      fetchStatus();
    } else {
      toast.error(result.error || 'Could not withdraw request');
    }
  };

  if (authLoading || loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div>;
  }

  if (!user) {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 py-8 text-center space-y-3">
        <AlertCircle size={40} className="mx-auto text-muted-foreground opacity-40" />
        <p className="text-base font-semibold text-foreground">Sign In Required</p>
        <p className="text-sm text-muted-foreground">Sign in to see your request status.</p>
      </div>
    );
  }

  if (!rideStatus || (!rideStatus.has_active_request && !rideStatus.has_completed_trip)) {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 py-8 text-center space-y-3">
        <Car size={40} className="mx-auto text-muted-foreground opacity-40" />
        <p className="text-base font-semibold text-foreground">No Active Request</p>
        <p className="text-sm text-muted-foreground">You do not have an active seat request right now.</p>
        <button onClick={fetchStatus} className="btn-outline mx-auto"><RefreshCw size={16} /> Refresh</button>
      </div>
    );
  }

  const req = rideStatus;
  const isHeld = req.status === 'HELD';
  const isConfirmed = req.status === 'CONFIRMED';
  const isExpired = req.status === 'EXPIRED' || req.status === 'WITHDRAWN';
  const isTripCompleted = req.has_completed_trip || req.trip_status === 'COMPLETED';
  const pickupIsPassed = req.current_stop_order > req.pickup_stop_order;
  const pickupIsCurrent = req.current_stop_order === req.pickup_stop_order;
  const pickupProgressText = isTripCompleted
    ? 'Trip completed — you have arrived'
    : pickupIsPassed
      ? 'Pickup stop passed — trip is in progress'
      : pickupIsCurrent
        ? 'Driver is here now'
        : `~${req.eta_minutes} min`;
  const routeFrom = req.stops?.[0]?.name ?? 'Raahi pickup';
  const routeTo = req.stops?.[(req.stops?.length ?? 1) - 1]?.name ?? 'Destination';
  const liveStatusLabel = isExpired
    ? req.status === 'WITHDRAWN' ? 'Request withdrawn' : 'Request expired'
    : isTripCompleted
      ? 'Destination reached'
      : req.trip_status === 'IN_PROGRESS'
        ? 'Trip started'
        : isConfirmed
          ? 'Seat confirmed'
          : 'Seat held';
  const liveStatusTone = isExpired ? 'none' : isConfirmed ? 'good' : 'limited';
  const journeyStep = isTripCompleted ? 4 : req.trip_status === 'IN_PROGRESS' ? 3 : isConfirmed ? 1 : 0;
  const seatLabel = req.seat_numbers?.length ? `Seat ${req.seat_numbers.join(', ')}` : `${req.seat_count} seat${req.seat_count === 1 ? '' : 's'}`;

  return (
    <div className="mobile-page space-y-3 animate-fade-in">
      <UnifiedTripCard
        from={routeFrom}
        to={routeTo}
        statusLabel={liveStatusLabel}
        statusTone={liveStatusTone}
        vehicleLabel={`${req.driver_display_name} · ${req.vehicle_number}`}
        pickupLabel={req.pickup_stop_name}
        confidenceLabel={pickupProgressText}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Your seat{req.seat_count === 1 ? '' : 's'}</p>
            <p className="text-sm font-bold text-foreground">{seatLabel}</p>
          </div>
          <button onClick={fetchStatus} className="btn-outline px-3 py-2" aria-label="Refresh ride status"><RefreshCw size={14} /> Refresh</button>
        </div>
        <div className="grid grid-cols-5 gap-1.5" aria-label="Journey progress">
          {['Held', 'Confirmed', 'Ready', 'Started', 'Arrived'].map((label, index) => (
            <div key={label} className="text-center">
              <div className={`h-1.5 rounded-full ${index <= journeyStep ? 'bg-primary' : 'bg-border'}`} />
              <p className={`mt-1 text-[9px] font-semibold ${index <= journeyStep ? 'text-primary' : 'text-muted-foreground'}`}>{label}</p>
            </div>
          ))}
        </div>
      </UnifiedTripCard>

      {isHeld && (
        <div className="space-y-2">
          <PayWarningBanner />
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold text-amber-800">Your selected seat{req.seat_count === 1 ? ' is' : 's are'} held until the driver passes your pickup stop.</p>
            <p className="text-xs text-amber-700 mt-1">Meet the driver and pay directly. If you no longer need the ride, withdraw before your stop so the seat can be offered to someone else.</p>
          </div>
        </div>
      )}

      {isConfirmed && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-green-800">{isTripCompleted ? 'Trip Completed' : 'Booking Confirmed'}</p>
            <p className="text-xs text-green-700 mt-0.5">
              {isTripCompleted ? 'You have arrived at the destination. Thank you for riding with Raahi!' : `${seatLabel} confirmed. The driver has received your payment. Enjoy your ride!`}
            </p>
          </div>
        </div>
      )}

      {isExpired && (
        <div className="flex items-start gap-3 bg-muted border border-border rounded-2xl px-4 py-3">
          <AlertCircle size={20} className="text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-foreground">{req.status === 'WITHDRAWN' ? 'Request Withdrawn' : 'Request Expired'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Your seat has been released. You can request again if seats are still available.</p>
          </div>
        </div>
      )}

      {req.stops && req.stops.length > 0 && (
        <div className="compact-card">
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">Driver Progress</p>
            <span className="text-xs text-muted-foreground">Stop {req.current_stop_order} of {req.stops.length}</span>
          </div>
          <div className="flex gap-1">
            {req.stops.map((stop) => (
              <div key={stop.stop_id} className={`flex-1 h-2 rounded-full transition-colors duration-300 ${stop.is_passed ? 'bg-accent' : stop.is_current ? 'bg-primary' : 'bg-border'}`} title={stop.name} />
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-muted-foreground">{req.stops[0]?.name}</span>
            <span className="text-xs font-semibold text-foreground">At: {req.current_stop_name}</span>
            <span className="text-xs text-muted-foreground">{req.stops[req.stops.length - 1]?.name}</span>
          </div>
          <div className="mt-3 flex items-center gap-2 bg-secondary rounded-xl px-3 py-2">
            <MapPin size={14} className="text-primary" />
            <p className="text-xs text-secondary-foreground font-medium">
              Your stop: <strong>{req.pickup_stop_name}</strong>
              {isTripCompleted ? ' — Journey completed' : pickupIsPassed ? ' — Passed; trip is in progress' : pickupIsCurrent ? ' — Driver is here!' : ` — ~${req.eta_minutes} min`}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {req.driver_phone && !isTripCompleted && (
          <a href={`tel:+91${req.driver_phone.replace(/\D/g, '')}`} className="btn-accent w-full min-h-12"><Phone size={18} /> Call Driver</a>
        )}
        {isHeld && (
          <button onClick={() => setShowWithdrawConfirm(true)} className="quiet-action w-full text-red-600 hover:bg-red-50"><X size={18} /> Withdraw Request</button>
        )}
      </div>

      {showWithdrawConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
          <div className="w-full max-w-md bg-card rounded-t-3xl p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-bold text-foreground">Withdraw Request?</h2>
            <p className="text-sm text-muted-foreground">
              Your {rideStatus?.seat_count === 1 ? 'held seat will' : `${rideStatus?.seat_count ?? 0} held seats will`} be released and become available for other passengers. You can request again if seats remain.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowWithdrawConfirm(false)} className="btn-outline flex-1">Keep Request</button>
              <button onClick={handleWithdraw} disabled={withdrawing} className="btn-danger flex-1">
                {withdrawing ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                {withdrawing ? 'Withdrawing...' : 'Yes, Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}