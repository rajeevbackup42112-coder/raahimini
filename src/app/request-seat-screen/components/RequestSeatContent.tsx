'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MapPin, Users, Phone, Lock, X, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getPublicActiveCar, requestSeats, type ActiveCarPublic, type StopWithEta } from '@/lib/raahiApi';
import { useAuth } from '@/contexts/AuthContext';
import PayWarningBanner from '@/components/ui/PayWarningBanner';
import SeatCountBadge from '@/components/ui/SeatCountBadge';

export default function RequestSeatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeId = searchParams.get('route_id');
  const tripId = searchParams.get('trip_id');

  const { user, signInWithGoogle, requestPhoneVerification, verifyPhoneChange } = useAuth();

  const [car, setCar] = useState<ActiveCarPublic | null>(null);
  const [loadingCar, setLoadingCar] = useState(true);
  const [selectedStopId, setSelectedStopId] = useState('');
  const [seatCount, setSeatCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  // Load active car data
  useEffect(() => {
    if (!routeId) { setLoadingCar(false); return; }
    getPublicActiveCar(routeId).then((data) => {
      setCar(data);
      setLoadingCar(false);
    });
  }, [routeId]);

  // Continue the in-page flow after authentication. Phone verification remains
  // a separate account-enrollment step; the server independently enforces it.
  useEffect(() => {
    if (!user || !pendingSubmit || !selectedStopId || !car?.trip_id) return;
    setShowAuthModal(false);
    if (!user.phone || !user.phone_confirmed_at) {
      setShowPhoneModal(true);
      return;
    }
    setPendingSubmit(false);
    setShowPhoneModal(false);
    doSubmitRequest();
  }, [user, user?.phone, user?.phone_confirmed_at, pendingSubmit]);

  const doSubmitRequest = async () => {
    const effectiveTripId = tripId || car?.trip_id;
    if (!effectiveTripId || !selectedStopId) return;

    setSubmitting(true);
    const result = await requestSeats(effectiveTripId, selectedStopId, seatCount);
    setSubmitting(false);

    if (result.success) {
      toast.success(`${seatCount} seat${seatCount > 1 ? 's' : ''} held — meet the driver at your stop`);
      // Store request_id for status screen
      if (result.request_id) {
        localStorage.setItem('raahi_active_request_id', result.request_id);
      }
      router.push('/request-status-screen');
    } else {
      toast.error(result.error || 'Could not request seat. Please try again.');
    }
  };

  const savePendingContext = () => {
    if (routeId) localStorage.setItem('raahi_pending_route_id', routeId);
    if (tripId || car?.trip_id) localStorage.setItem('raahi_pending_trip_id', tripId || car?.trip_id || '');
    localStorage.setItem('raahi_pending_stop_id', selectedStopId);
    localStorage.setItem('raahi_pending_seat_count', String(seatCount));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStopId) {
      toast.error('Please select a pickup point');
      return;
    }
    if (!user) {
      savePendingContext();
      setPendingSubmit(true);
      setShowAuthModal(true);
      return;
    }
    if (!user.phone || !user.phone_confirmed_at) {
      savePendingContext();
      setPendingSubmit(true);
      setShowPhoneModal(true);
      return;
    }
    doSubmitRequest();
  };

  const handleAuthComplete = () => {
    setShowAuthModal(false);
    // pendingSubmit will trigger the useEffect above
  };

  if (loadingCar) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!car?.has_active_car) {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 py-8 text-center space-y-3">
        <p className="text-base font-semibold text-foreground">No Active Car</p>
        <p className="text-sm text-muted-foreground">Go back and select a route with an active car.</p>
      </div>
    );
  }

  const availableStops = (car.stops ?? []).filter((s) => !s.is_passed);
  const selectedStop = (car.stops ?? []).find((s) => s.stop_id === selectedStopId);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-4 space-y-4 animate-fade-in">
      {/* Trip Summary */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
            <MapPin size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Active Car</p>
            <p className="text-sm font-bold text-foreground">{car.driver_display_name} · {car.vehicle_number}</p>
            <p className="text-xs text-muted-foreground">{car.vehicle_model} · {car.vehicle_type}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3 pt-3 border-t border-border">
          <SeatCountBadge label="Available" count={car.available_count ?? 0} variant="available" />
          <SeatCountBadge label="Held" count={car.held_count ?? 0} variant="held" />
          <SeatCountBadge label="Confirmed" count={car.confirmed_count ?? 0} variant="confirmed" />
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pickup Stop */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">
            Your Pickup Point <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Only stops not yet passed by the driver are shown
          </p>
          {availableStops.length === 0 ? (
            <div className="card p-4 text-center text-sm text-muted-foreground">
              <AlertTriangle size={18} className="mx-auto mb-2 text-amber-500" />
              Driver has passed all pickup stops
            </div>
          ) : (
            <div className="space-y-2">
              {availableStops.map((stop) => {
                const isSelected = selectedStopId === stop.stop_id;
                return (
                  <label
                    key={stop.stop_id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                      isSelected ? 'border-primary bg-secondary' : 'border-border bg-card hover:border-primary/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pickup_stop"
                      value={stop.stop_id}
                      checked={isSelected}
                      onChange={() => setSelectedStopId(stop.stop_id)}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'border-primary' : 'border-muted-foreground'
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                        {stop.name}
                      </p>
                      {stop.is_current && (
                        <p className="text-xs text-primary font-medium">Driver here now</p>
                      )}
                      {!stop.is_current && stop.eta_minutes !== null && (
                        <p className="text-xs text-muted-foreground">~{stop.eta_minutes} min away</p>
                      )}
                    </div>
                    <MapPin size={14} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Seat Count */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">
            Number of Seats <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Maximum {car.available_count} available. Multi-seat requests are all-or-nothing.
          </p>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((n) => {
              const disabled = n > (car.available_count ?? 0);
              return (
                <button
                  key={`seat-count-${n}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSeatCount(n)}
                  className={`flex-1 py-3 rounded-xl border-2 font-bold text-base transition-all duration-150 active:scale-95 ${
                    seatCount === n
                      ? 'border-primary bg-secondary text-primary'
                      : disabled
                      ? 'border-border bg-muted text-muted-foreground opacity-40 cursor-not-allowed'
                      : 'border-border bg-card text-foreground hover:border-primary/40'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        {/* Warning */}
        <PayWarningBanner />

        {/* Info note */}
        <div className="flex items-start gap-2 bg-muted rounded-xl px-3 py-3">
          <Users size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Requesting a seat holds it temporarily. It becomes confirmed only after the driver receives your payment in person.
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || availableStops.length === 0}
          className="btn-primary w-full"
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Requesting...
            </>
          ) : user ? (
            <>
              <CheckCircle2 size={18} />
              Request Seat
            </>
          ) : (
            <>
              <Lock size={18} />
              Request Seat — Sign In Required
            </>
          )}
        </button>
      </form>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onComplete={handleAuthComplete}
          onClose={() => { setShowAuthModal(false); setPendingSubmit(false); }}
          signInWithGoogle={signInWithGoogle}
        />
      )}
      {showPhoneModal && (
        <PhoneVerificationModal
          onComplete={() => {
            setShowPhoneModal(false);
            setPendingSubmit(false);
            doSubmitRequest();
          }}
          onClose={() => { setShowPhoneModal(false); setPendingSubmit(false); }}
          requestPhoneVerification={requestPhoneVerification}
          verifyPhoneChange={verifyPhoneChange}
        />
      )}
    </div>
  );
}

function AuthModal({
  onComplete,
  onClose,
  signInWithGoogle,
}: {
  onComplete: () => void;
  onClose: () => void;
  signInWithGoogle: (redirectTo?: string) => Promise<any>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle(window.location.pathname + window.location.search);
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
      <div className="w-full max-w-md bg-card rounded-t-3xl p-6 space-y-5 animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Sign In to Continue</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Your pickup and seat selection have been saved. Sign in with Google to continue.
        </p>
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertTriangle size={14} className="text-red-500" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}
        <button type="button" className="btn-primary w-full" onClick={handleGoogle} disabled={loading}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : <span className="text-sm font-bold">G</span>}
          {loading ? 'Opening Google...' : 'Continue with Google'}
        </button>
        <p className="text-xs text-center text-muted-foreground">
          A verified mobile number is required once before your first booking.
        </p>
      </div>
    </div>
  );
}

function PhoneVerificationModal({
  onComplete,
  onClose,
  requestPhoneVerification,
  verifyPhoneChange,
}: {
  onComplete: () => void;
  onClose: () => void;
  requestPhoneVerification: (phone: string) => Promise<any>;
  verifyPhoneChange: (phone: string, token: string) => Promise<any>;
}) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendOtp = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (phone.length !== 10) return;
    setLoading(true);
    setError('');
    try {
      await requestPhoneVerification(phone);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Could not send verification OTP.');
    } finally {
      setLoading(false);
    }
  };

  const verify = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (otp.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      await verifyPhoneChange(phone, otp);
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
      <div className="w-full max-w-md bg-card rounded-t-3xl p-6 space-y-5 animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Verify Your Mobile Number</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Drivers need a verified contact number. You only enroll it once; OTP is required again only when you choose phone login.
        </p>
        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">{error}</div>}
        {step === 'phone' ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <span className="flex items-center px-3 rounded-xl bg-muted border border-border text-sm">+91</span>
              <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="98765 43210" className="input-field flex-1" />
            </div>
            <button type="button" onClick={sendOtp} disabled={loading || phone.length !== 10} className="btn-primary w-full">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Phone size={18} />}
              {loading ? 'Sending OTP...' : 'Send verification OTP'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter the code sent to +91 {phone}</p>
            <input inputMode="numeric" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" className="input-field text-center text-xl tracking-[0.35em] font-bold" />
            <button type="button" onClick={verify} disabled={loading || otp.length !== 6} className="btn-primary w-full">
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? 'Verifying...' : 'Verify & Request Seat'}
            </button>
            <button type="button" onClick={() => { setStep('phone'); setOtp(''); setError(''); }} className="w-full text-sm text-muted-foreground">Change number</button>
          </div>
        )}
      </div>
    </div>
  );
}
