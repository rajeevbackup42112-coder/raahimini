'use client';
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Phone, X, Clock, MapPin, Car, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { MOCK_MY_REQUEST, MOCK_ACTIVE_CAR_GD01 } from '@/lib/mockData';
import PayWarningBanner from '@/components/ui/PayWarningBanner';
import StatusBadge from '@/components/ui/StatusBadge';

// BACKEND INTEGRATION POINT: Replace with get_passenger_ride_status(request_id) RPC
// BACKEND INTEGRATION POINT: Supabase Realtime — subscribe to trip changes and refetch on notification
// BACKEND INTEGRATION POINT: Withdraw calls withdraw_seat_request(request_id) RPC

export default function RequestStatusContent() {
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  const req = MOCK_MY_REQUEST;
  const car = MOCK_ACTIVE_CAR_GD01;

  const isHeld = req?.status === 'HELD' && !withdrawn;
  const isConfirmed = req?.status === 'CONFIRMED';

  const handleWithdraw = () => {
    setWithhdrawing(true);
    // BACKEND: call withdraw_seat_request(request_id) RPC
    setTimeout(() => {
      setWithhdrawing(false);
      setWithdrawn(true);
      setShowWithdrawConfirm(false);
      toast?.success('Request withdrawn — seat is now available again');
    }, 1000);
  };

  // Fix typo helper
  const setWithhdrawing = setWithdrawing;

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-4 space-y-4 animate-fade-in">
      {/* Status Card */}
      <div className={`card p-4 border-l-4 ${
        withdrawn ? 'border-l-gray-400' : isConfirmed ?'border-l-green-500': 'border-l-amber-500'
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {withdrawn ? (
                <StatusBadge status="expired" label="Withdrawn" />
              ) : isConfirmed ? (
                <StatusBadge status="confirmed" />
              ) : (
                <StatusBadge status="held" />
              )}
            </div>
            <h2 className="text-lg font-bold text-foreground mt-1">
              {req?.seat_count} Seat{req?.seat_count > 1 ? 's' : ''}
            </h2>
            <p className="text-sm text-muted-foreground">{req?.route_label}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Request ID</p>
            <p className="text-xs font-mono font-bold text-foreground">{req?.request_id?.toUpperCase()}</p>
          </div>
        </div>
      </div>
      {/* Pay Warning — only when held */}
      {isHeld && <PayWarningBanner />}
      {/* Confirmed Success Banner */}
      {isConfirmed && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-green-800">Booking Confirmed</p>
            <p className="text-xs text-green-700 mt-0.5">
              Your seat is confirmed. The driver has received your payment. Enjoy your ride!
            </p>
          </div>
        </div>
      )}
      {/* Withdrawn State */}
      {withdrawn && (
        <div className="flex items-start gap-3 bg-muted border border-border rounded-2xl px-4 py-3">
          <AlertCircle size={20} className="text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-foreground">Request Withdrawn</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your seat has been released. You can request again if seats are still available.
            </p>
          </div>
        </div>
      )}
      {/* Pickup Info */}
      <div className="card p-4 space-y-3">
        <p className="section-label">Your Journey Details</p>
        <div className="flex items-center gap-3">
          <MapPin size={18} className="text-primary flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Your Pickup Stop</p>
            <p className="text-sm font-bold text-foreground">{req?.pickup_stop_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Car size={18} className="text-accent flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Driver · Vehicle</p>
            <p className="text-sm font-bold text-foreground">{req?.driver_display_name} · {req?.vehicle_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Clock size={18} className="text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">ETA to Your Stop</p>
            <p className="text-sm font-bold text-foreground">
              {req?.eta_minutes === 0 ? 'Driver is here now' : `~${req?.eta_minutes} min`}
            </p>
          </div>
        </div>
      </div>
      {/* Driver Progress */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Driver Progress</p>
          <span className="text-xs text-muted-foreground">
            Stop {car?.current_stop_order} of {car?.stops?.length}
          </span>
        </div>
        <div className="flex gap-1">
          {car?.stops?.map((stop) => (
            <div
              key={stop?.stop_id}
              className={`flex-1 h-2 rounded-full transition-colors duration-300 ${
                stop?.is_passed ? 'bg-accent' : stop?.is_current ?'bg-primary': 'bg-border'
              }`}
              title={stop?.name}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-muted-foreground">{car?.stops?.[0]?.name}</span>
          <span className="text-xs font-semibold text-foreground">
            At: {car?.current_stop_name}
          </span>
          <span className="text-xs text-muted-foreground">{car?.stops?.[car?.stops?.length - 1]?.name}</span>
        </div>
        {/* Highlight passenger stop */}
        <div className="mt-3 flex items-center gap-2 bg-secondary rounded-xl px-3 py-2">
          <MapPin size={14} className="text-primary" />
          <p className="text-xs text-secondary-foreground font-medium">
            Your stop: <strong>{req?.pickup_stop_name}</strong>
            {req?.eta_minutes === 0 ? ' — Driver is here!' : ` — ~${req?.eta_minutes} min`}
          </p>
        </div>
      </div>
      {/* Actions */}
      <div className="space-y-3">
        <a
          href={`tel:${req?.driver_phone_masked?.replace(/\s/g, '')}`}
          className="btn-accent w-full"
        >
          <Phone size={18} />
          Call Driver ({req?.driver_phone_masked})
        </a>

        {isHeld && (
          <button
            onClick={() => setShowWithdrawConfirm(true)}
            className="btn-outline w-full border-red-200 text-red-600 hover:bg-red-50"
          >
            <X size={18} />
            Withdraw Request
          </button>
        )}
      </div>
      {/* Withdraw Confirm Modal */}
      {showWithdrawConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
          <div className="w-full max-w-md bg-card rounded-t-3xl p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-bold text-foreground">Withdraw Request?</h2>
            <p className="text-sm text-muted-foreground">
              Your held seat will be released and become available for other passengers. You can request again if seats remain.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWithdrawConfirm(false)}
                className="btn-outline flex-1"
              >
                Keep Request
              </button>
              <button
                onClick={handleWithdraw}
                disabled={withdrawing}
                className="btn-danger flex-1"
              >
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