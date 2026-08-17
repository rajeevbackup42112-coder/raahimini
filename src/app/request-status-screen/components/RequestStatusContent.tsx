'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Phone, X, Clock, MapPin, Car, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { getMyActiveRequest, withdrawSeatRequest, type PassengerRideStatus } from '@/lib/raahiApi';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import PayWarningBanner from '@/components/ui/PayWarningBanner';
import StatusBadge from '@/components/ui/StatusBadge';

export default function RequestStatusContent() {
  const { user, loading: authLoading } = useAuth();
  const [rideStatus, setRideStatus] = useState<(PassengerRideStatus & { has_active_request: boolean }) | null>(null);
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

  // Realtime: subscribe to seat_requests and trips changes → refetch
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const channel = supabase
      .channel('request_status_watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seat_requests' }, () => {
        fetchStatus();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        fetchStatus();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchStatus]);

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
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
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

  if (!rideStatus?.has_active_request) {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 py-8 text-center space-y-3">
        <Car size={40} className="mx-auto text-muted-foreground opacity-40" />
        <p className="text-base font-semibold text-foreground">No Active Request</p>
        <p className="text-sm text-muted-foreground">You do not have an active seat request right now.</p>
        <button onClick={fetchStatus} className="btn-outline mx-auto">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
    );
  }

  const req = rideStatus;
  const isHeld = req.status === 'HELD';
  const isConfirmed = req.status === 'CONFIRMED';
  const isExpired = req.status === 'EXPIRED' || req.status === 'WITHDRAWN';
  const pickupIsPassed = req.current_stop_order > req.pickup_stop_order;
  const pickupIsCurrent = req.current_stop_order === req.pickup_stop_order;
  const pickupProgressText = pickupIsPassed
    ? 'Pickup stop passed — trip is in progress'
    : pickupIsCurrent
      ? 'Driver is here now'
      : `~${req.eta_minutes} min`;

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-4 space-y-4 animate-fade-in">
      {/* Status Card */}
      <div className={`card p-4 border-l-4 ${
        isExpired ? 'border-l-gray-400' : isConfirmed ? 'border-l-green-500' : 'border-l-amber-500'
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isExpired ? (
                <StatusBadge status="expired" label={req.status === 'WITHDRAWN' ? 'Withdrawn' : 'Expired'} />
              ) : isConfirmed ? (
                <StatusBadge status="confirmed" />
              ) : (
                <StatusBadge status="held" />
              )}
            </div>
            <h2 className="text-lg font-bold text-foreground mt-1">
              {req.seat_count} Seat{req.seat_count > 1 ? 's' : ''}
            </h2>
          </div>
          <button onClick={fetchStatus} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted">
            <RefreshCw size={14} className="text-muted-foreground" />
          </button>
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

      {/* Expired/Withdrawn State */}
      {isExpired && (
        <div className="flex items-start gap-3 bg-muted border border-border rounded-2xl px-4 py-3">
          <AlertCircle size={20} className="text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-foreground">
              {req.status === 'WITHDRAWN' ? 'Request Withdrawn' : 'Request Expired'}
            </p>
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
            <p className="text-sm font-bold text-foreground">{req.pickup_stop_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Car size={18} className="text-accent flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Driver · Vehicle</p>
            <p className="text-sm font-bold text-foreground">{req.driver_display_name} · {req.vehicle_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Clock size={18} className="text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">{pickupIsPassed ? 'Pickup Progress' : 'ETA to Your Stop'}</p>
            <p className="text-sm font-bold text-foreground">{pickupProgressText}</p>
          </div>
        </div>
      </div>

      {/* Driver Progress */}
      {req.stops && req.stops.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">Driver Progress</p>
            <span className="text-xs text-muted-foreground">
              Stop {req.current_stop_order} of {req.stops.length}
            </span>
          </div>
          <div className="flex gap-1">
            {req.stops.map((stop) => (
              <div
                key={stop.stop_id}
                className={`flex-1 h-2 rounded-full transition-colors duration-300 ${
                  stop.is_passed ? 'bg-accent' : stop.is_current ? 'bg-primary' : 'bg-border'
                }`}
                title={stop.name}
              />
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
              {pickupIsPassed
                ? ' — Passed; trip is in progress'
                : pickupIsCurrent
                  ? ' — Driver is here!'
                  : ` — ~${req.eta_minutes} min`}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {req.driver_phone && (
          <a
            href={`tel:+91${req.driver_phone.replace(/\D/g, '')}`}
            className="btn-accent w-full"
          >
            <Phone size={18} />
            Call Driver
          </a>
        )}

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