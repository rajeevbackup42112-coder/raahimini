'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Phone, X, Clock, MapPin, Car, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { getMyActiveRequest, withdrawSeatRequest, type PassengerRideStatus } from '@/lib/raahiApi';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import PayWarningBanner from '@/components/ui/PayWarningBanner';
import StatusBadge from '@/components/ui/StatusBadge';

type TimedRideStatus = PassengerRideStatus & { hold_expires_at?: string | null; server_now?: string | null };

export default function RequestStatusContent() {
  const { user, loading: authLoading } = useAuth();
  const [rideStatus, setRideStatus] = useState<TimedRideStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const expiringRef = useRef(false);

  const syncCountdown = useCallback((data: TimedRideStatus | null) => {
    if (!data || data.status !== 'HELD' || !data.hold_expires_at) {
      setRemainingSeconds(null);
      return;
    }
    const serverNow = data.server_now ? Date.parse(data.server_now) : Date.now();
    const expiresAt = Date.parse(data.hold_expires_at);
    setRemainingSeconds(Math.max(0, Math.ceil((expiresAt - serverNow) / 1000)));
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const data = await getMyActiveRequest() as TimedRideStatus | null;
    setRideStatus(data);
    syncCountdown(data);
    setLoading(false);
  }, [user, syncCountdown]);

  useEffect(() => { if (!authLoading) fetchStatus(); }, [authLoading, fetchStatus]);

  const expireHold = useCallback(async () => {
    if (!rideStatus?.request_id || expiringRef.current || rideStatus.status !== 'HELD') return;
    expiringRef.current = true;
    const supabase = createClient();
    const { data, error } = await supabase.rpc('expire_my_held_request', { p_request_id: rideStatus.request_id });
    expiringRef.current = false;
    if (error) {
      toast.error('Could not release the expired seat. Please refresh.');
      return;
    }
    if ((data as any)?.expired) {
      setRemainingSeconds(0);
      setRideStatus(prev => prev ? { ...prev, status: 'EXPIRED', has_active_request: true } : prev);
      toast.info('Hold expired — your seat has been released');
    } else {
      fetchStatus();
    }
  }, [rideStatus?.request_id, rideStatus?.status, fetchStatus]);

  useEffect(() => {
    if (rideStatus?.status !== 'HELD' || remainingSeconds === null) return;
    if (remainingSeconds <= 0) { expireHold(); return; }
    const timer = window.setInterval(() => {
      setRemainingSeconds(prev => prev === null ? null : Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [rideStatus?.status, remainingSeconds, expireHold]);

  const handleWithdraw = async () => {
    if (!rideStatus?.request_id) return;
    setWithdrawing(true);
    const result = await withdrawSeatRequest(rideStatus.request_id);
    setWithdrawing(false);
    setShowWithdrawConfirm(false);
    if (result.success) {
      toast.success('Request withdrawn — seat is now available again');
      fetchStatus();
    } else toast.error(result.error || 'Could not withdraw request');
  };

  if (authLoading || loading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div>;

  if (!user) return (
    <div className="max-w-screen-2xl mx-auto px-4 py-8 text-center space-y-3">
      <AlertCircle size={40} className="mx-auto text-muted-foreground opacity-40" />
      <p className="text-base font-semibold text-foreground">Sign In Required</p>
      <p className="text-sm text-muted-foreground">Sign in to see your request status.</p>
    </div>
  );

  if (!rideStatus || (!rideStatus.has_active_request && !rideStatus.has_completed_trip)) return (
    <div className="max-w-screen-2xl mx-auto px-4 py-8 text-center space-y-3">
      <Car size={40} className="mx-auto text-muted-foreground opacity-40" />
      <p className="text-base font-semibold text-foreground">No Active Request</p>
      <p className="text-sm text-muted-foreground">You do not have an active seat request right now.</p>
      <button onClick={() => window.location.assign('/')} className="btn-accent mx-auto">Choose a Ride</button>
    </div>
  );

  const req = rideStatus;
  const isHeld = req.status === 'HELD';
  const isConfirmed = req.status === 'CONFIRMED';
  const isExpired = req.status === 'EXPIRED' || req.status === 'WITHDRAWN';
  const isTripCompleted = req.has_completed_trip || req.trip_status === 'COMPLETED';
  const pickupIsPassed = req.current_stop_order > req.pickup_stop_order;
  const pickupIsCurrent = req.current_stop_order === req.pickup_stop_order;
  const pickupProgressText = isTripCompleted ? 'Trip completed — you have arrived' : pickupIsPassed ? 'Pickup stop passed — trip is in progress' : pickupIsCurrent ? 'Driver is here now' : `~${req.eta_minutes} min`;
  const mm = Math.floor((remainingSeconds ?? 0) / 60).toString().padStart(2, '0');
  const ss = ((remainingSeconds ?? 0) % 60).toString().padStart(2, '0');

  return (
    <div className="mobile-page space-y-3 animate-fade-in">
      <div className={`compact-card border-l-4 ${isExpired ? 'border-l-gray-400' : isConfirmed ? 'border-l-green-500' : 'border-l-amber-500'}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isExpired ? <StatusBadge status="expired" label={req.status === 'WITHDRAWN' ? 'Withdrawn' : 'Expired'} /> : isConfirmed ? <StatusBadge status="confirmed" /> : <StatusBadge status="held" />}
            </div>
            <h2 className="text-lg font-bold text-foreground mt-1">{req.seat_count} Seat{req.seat_count > 1 ? 's' : ''}</h2>
          </div>
          <button onClick={fetchStatus} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted"><RefreshCw size={14} className="text-muted-foreground" /></button>
        </div>
      </div>

      {isHeld && (
        <div className="space-y-2">
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-5 text-center">
            <p className="text-sm font-bold text-amber-900">Seat held for you</p>
            <div className="text-5xl sm:text-6xl font-black tabular-nums tracking-tight text-amber-700 my-2" aria-live="polite">{mm}:{ss}</div>
            <p className="text-sm font-semibold text-amber-900">Contact the driver now and complete payment.</p>
            <p className="text-xs text-amber-800 mt-2">Your seat will be released automatically when the timer reaches 00:00.</p>
          </div>
          <PayWarningBanner />
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold text-amber-800">Please request only when you are near your pickup stop and ready to travel.</p>
            <p className="text-xs text-amber-700 mt-1">Don’t request too early — another passenger may need this seat.</p>
          </div>
        </div>
      )}

      {isConfirmed && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div><p className="text-sm font-bold text-green-800">{isTripCompleted ? 'Trip Completed' : 'Booking Confirmed'}</p><p className="text-xs text-green-700 mt-0.5">{isTripCompleted ? 'You have arrived at the destination. Thank you for riding with Raahi!' : 'Your seat is confirmed. The driver has received your payment. Enjoy your ride!'}</p></div>
        </div>
      )}

      {isExpired && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 bg-muted border border-border rounded-2xl px-4 py-4">
            <AlertCircle size={20} className="text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-foreground">{req.status === 'WITHDRAWN' ? 'Request Withdrawn' : 'Seat Released'}</p>
              <p className="text-xs text-muted-foreground mt-1">{req.status === 'WITHDRAWN' ? 'Your held seat has been released.' : 'Your 5-minute hold expired and the seat is available to other passengers again.'}</p>
              {req.status === 'EXPIRED' && <p className="text-xs font-semibold text-foreground mt-2">Please book again only when you are near your pickup stop and ready to travel.</p>}
            </div>
          </div>
          <button onClick={() => window.location.assign('/')} className="btn-accent w-full">Choose Ride Again</button>
        </div>
      )}

      <div className="compact-card space-y-3">
        <p className="section-label">Your Journey Details</p>
        <div className="flex items-center gap-3"><MapPin size={18} className="text-primary flex-shrink-0" /><div><p className="text-xs text-muted-foreground">Your Pickup Stop</p><p className="text-sm font-bold text-foreground">{req.pickup_stop_name}</p></div></div>
        <div className="flex items-center gap-3"><Car size={18} className="text-accent flex-shrink-0" /><div><p className="text-xs text-muted-foreground">Driver · Vehicle</p><p className="text-sm font-bold text-foreground">{req.driver_display_name} · {req.vehicle_number}</p></div></div>
        <div className="flex items-center gap-3"><Clock size={18} className="text-muted-foreground flex-shrink-0" /><div><p className="text-xs text-muted-foreground">{isTripCompleted ? 'Trip Status' : pickupIsPassed ? 'Pickup Progress' : 'ETA to Your Stop'}</p><p className="text-sm font-bold text-foreground">{pickupProgressText}</p></div></div>
      </div>

      {req.stops && req.stops.length > 0 && (
        <div className="compact-card">
          <div className="flex items-center justify-between mb-3"><p className="section-label">Driver Progress</p><span className="text-xs text-muted-foreground">Stop {req.current_stop_order} of {req.stops.length}</span></div>
          <div className="flex gap-1">{req.stops.map(stop => <div key={stop.stop_id} className={`flex-1 h-2 rounded-full transition-colors duration-300 ${stop.is_passed ? 'bg-accent' : stop.is_current ? 'bg-primary' : 'bg-border'}`} title={stop.name} />)}</div>
          <div className="flex justify-between mt-2"><span className="text-xs text-muted-foreground">{req.stops[0]?.name}</span><span className="text-xs font-semibold text-foreground">At: {req.current_stop_name}</span><span className="text-xs text-muted-foreground">{req.stops[req.stops.length - 1]?.name}</span></div>
        </div>
      )}

      <div className="space-y-3">
        {req.driver_phone && !isTripCompleted && !isExpired && <a href={`tel:+91${req.driver_phone.replace(/\D/g, '')}`} className="btn-accent w-full min-h-12"><Phone size={18} />Call Driver</a>}
        {isHeld && <button onClick={() => setShowWithdrawConfirm(true)} className="quiet-action w-full text-red-600 hover:bg-red-50"><X size={18} />Withdraw Request</button>}
      </div>

      {showWithdrawConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
          <div className="w-full max-w-md bg-card rounded-t-3xl p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-bold text-foreground">Withdraw Request?</h2>
            <p className="text-sm text-muted-foreground">Your {rideStatus?.seat_count === 1 ? 'held seat will' : `${rideStatus?.seat_count ?? 0} held seats will`} be released and become available for other passengers.</p>
            <div className="flex gap-3"><button onClick={() => setShowWithdrawConfirm(false)} className="btn-outline flex-1">Keep Request</button><button onClick={handleWithdraw} disabled={withdrawing} className="btn-danger flex-1">{withdrawing ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}{withdrawing ? 'Withdrawing...' : 'Yes, Withdraw'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
