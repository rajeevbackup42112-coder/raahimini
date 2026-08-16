'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MapPin, Users, Phone, Lock, X, Loader2, AlertTriangle } from 'lucide-react';
import { MOCK_ACTIVE_CAR_GD01 } from '@/lib/mockData';
import PayWarningBanner from '@/components/ui/PayWarningBanner';
import SeatCountBadge from '@/components/ui/SeatCountBadge';

// BACKEND INTEGRATION POINT: On submit, call request_seats(trip_id, pickup_stop_id, seat_count) RPC
// BACKEND INTEGRATION POINT: Auth gate intercepts if no Supabase session — redirect to OTP/Google flow preserving form state

interface RequestFormValues {
  pickup_stop_id: string;
  seat_count: number;
}

export default function RequestSeatContent() {
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingValues, setPendingValues] = useState<RequestFormValues | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RequestFormValues>({
    defaultValues: { pickup_stop_id: '', seat_count: 1 },
  });

  const seatCount = watch('seat_count');
  const selectedStopId = watch('pickup_stop_id');
  const car = MOCK_ACTIVE_CAR_GD01;

  const availableStops = car.stops.filter((s) => !s.is_passed);

  const selectedStop = car.stops.find((s) => s.stop_id === selectedStopId);

  const onSubmit = (values: RequestFormValues) => {
    // BACKEND: Check Supabase auth session here
    const isAuthenticated = false; // Replace with actual auth check
    if (!isAuthenticated) {
      setPendingValues(values);
      setShowAuthModal(true);
      return;
    }
    submitRequest(values);
  };

  const submitRequest = (values: RequestFormValues) => {
    setSubmitting(true);
    // BACKEND: call request_seats(trip_id, pickup_stop_id, seat_count) RPC
    setTimeout(() => {
      setSubmitting(false);
      toast.success(`${values.seat_count} seat${values.seat_count > 1 ? 's' : ''} held — meet the driver at ${selectedStop?.name}`);
      router.push('/request-status-screen');
    }, 1200);
  };

  const handleAuthComplete = () => {
    setShowAuthModal(false);
    if (pendingValues) submitRequest(pendingValues);
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-4 space-y-4 animate-fade-in">
      {/* Trip Summary */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
            <MapPin size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">{car.route_code}</p>
            <p className="text-sm font-bold text-foreground">{car.route_label}</p>
            <p className="text-xs text-muted-foreground">Driver: {car.driver_display_name} · {car.vehicle_number}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3 pt-3 border-t border-border">
          <SeatCountBadge label="Available" count={car.available_count} variant="available" />
          <SeatCountBadge label="Held" count={car.held_count} variant="held" />
          <SeatCountBadge label="Confirmed" count={car.confirmed_count} variant="confirmed" />
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Pickup Stop */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">
            Your Pickup Point <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Only stops not yet passed by the driver are shown
          </p>
          <div className="space-y-2">
            {availableStops.map((stop) => {
              const isSelected = selectedStopId === stop.stop_id;
              return (
                <label
                  key={stop.stop_id}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'border-primary bg-secondary' :'border-border bg-card hover:border-primary/30'
                  }`}
                >
                  <input
                    type="radio"
                    value={stop.stop_id}
                    {...register('pickup_stop_id', { required: 'Select a pickup point' })}
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
          {errors.pickup_stop_id && (
            <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
              <AlertTriangle size={12} />
              {errors.pickup_stop_id.message}
            </p>
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
              const disabled = n > car.available_count;
              return (
                <button
                  key={`seat-count-${n}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => setValue('seat_count', n)}
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
          disabled={submitting}
          className="btn-primary w-full"
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Requesting...
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
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}

function AuthModal({ onComplete, onClose }: { onComplete: () => void; onClose: () => void }) {
  const [step, setStep] = useState<'choose' | 'otp'>('choose');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const handleSendOtp = () => {
    if (!phone || phone.length < 10) return;
    setLoading(true);
    // BACKEND: Supabase Auth OTP send — signInWithOtp({ phone })
    setTimeout(() => {
      setLoading(false);
      setOtpSent(true);
      setStep('otp');
    }, 900);
  };

  const handleVerifyOtp = () => {
    if (!otp || otp.length < 4) return;
    setLoading(true);
    // BACKEND: Supabase Auth OTP verify — verifyOtp({ phone, token, type: 'sms' })
    setTimeout(() => {
      setLoading(false);
      onComplete();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
      <div className="w-full max-w-md bg-card rounded-t-3xl p-6 space-y-5 animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Sign In to Continue</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors duration-150"
          >
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Your pickup and seat selection have been saved. Sign in to complete your request.
        </p>

        {step === 'choose' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                Mobile Number
              </label>
              <div className="flex gap-2">
                <span className="flex items-center justify-center px-3 bg-muted border border-border rounded-xl text-sm font-medium text-foreground">
                  +91
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="98765 43210"
                  className="input-field flex-1"
                />
              </div>
            </div>
            <button
              onClick={handleSendOtp}
              disabled={loading || phone.length < 10}
              className="btn-primary w-full"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Phone size={18} />}
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
            <div className="relative flex items-center">
              <div className="flex-1 border-t border-border" />
              <span className="mx-3 text-xs text-muted-foreground">or</span>
              <div className="flex-1 border-t border-border" />
            </div>
            <button
              className="btn-outline w-full"
              onClick={() => {
                // BACKEND: Supabase Auth Google OAuth — signInWithOAuth({ provider: 'google' })
                toast.info('Google sign-in not yet configured');
              }}
            >
              <span className="text-sm font-bold">G</span>
              Continue with Google
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter the OTP sent to <strong>+91 {phone}</strong>
            </p>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">OTP</label>
              <input
                type="number"
                value={otp}
                onChange={(e) => setOtp(e.target.value.slice(0, 6))}
                placeholder="6-digit OTP"
                className="input-field text-center text-xl tracking-[0.4em] font-bold"
              />
            </div>
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length < 4}
              className="btn-primary w-full"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? 'Verifying...' : 'Verify & Request Seat'}
            </button>
            <button
              onClick={() => setStep('choose')}
              className="w-full text-sm text-muted-foreground text-center hover:text-foreground transition-colors"
            >
              Change number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}