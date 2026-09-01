'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MapPin, Users, Phone, Lock, X, Loader2, AlertTriangle, CheckCircle2, IndianRupee } from 'lucide-react';
import { getPublicActiveCar, requestSeats, type ActiveCarPublic, type PublicTripSeat } from '@/lib/raahiApi';
import { useAuth } from '@/contexts/AuthContext';
import PayWarningBanner from '@/components/ui/PayWarningBanner';
import SeatCountBadge from '@/components/ui/SeatCountBadge';
import { clearDemandWatch } from '@/lib/demandWatch';
import { useLegalAcceptanceGate } from '@/components/legal/LegalAcceptanceGate';
import { useRegulatoryLaunchGate } from '@/components/launch/RegulatoryLaunchGate';

const MAX_SEATS_PER_REQUEST = 4;

export default function RequestSeatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeId = searchParams.get('route_id');
  const tripId = searchParams.get('trip_id');
  const { user, signInWithGoogle, requestPhoneVerification, verifyPhoneChange } = useAuth();
  const { guard: guardLegal, dialog: legalDialog } = useLegalAcceptanceGate('passenger');
  const { guard: guardLaunch, dialog: launchDialog } = useRegulatoryLaunchGate();

  const [car, setCar] = useState<ActiveCarPublic | null>(null);
  const [loadingCar, setLoadingCar] = useState(true);
  const [selectedStopId, setSelectedStopId] = useState('');
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const loadCar = async () => {
    if (!routeId) { setLoadingCar(false); return null; }
    const data = await getPublicActiveCar(routeId);
    setCar(data);
    setLoadingCar(false);
    return data;
  };

  useEffect(() => { void loadCar(); }, [routeId]);

  useEffect(() => {
    if (!user || !pendingSubmit || !selectedStopId || !car?.trip_id || selectedSeats.length === 0) return;
    setShowAuthModal(false);
    if (!user.phone || !user.phone_confirmed_at) {
      setShowPhoneModal(true);
      return;
    }
    setPendingSubmit(false);
    setShowPhoneModal(false);
    void doSubmitRequest();
  }, [user, user?.phone, user?.phone_confirmed_at, pendingSubmit]);

  const toggleSeat = (seat: PublicTripSeat) => {
    if (seat.state !== 'AVAILABLE') return;
    setSelectedSeats((current) => {
      if (current.includes(seat.seat_number)) return current.filter((number) => number !== seat.seat_number);
      if (current.length >= MAX_SEATS_PER_REQUEST) {
        toast.info(`You can request up to ${MAX_SEATS_PER_REQUEST} seats at once.`);
        return current;
      }
      return [...current, seat.seat_number].sort((a, b) => a - b);
    });
  };

  const doSubmitRequest = async () => {
    try { await guardLaunch(async () => { await guardLegal(async () => {
    const effectiveTripId = tripId || car?.trip_id;
    if (!effectiveTripId || !selectedStopId || selectedSeats.length === 0) return;

    setSubmitting(true);
    const result = await requestSeats(effectiveTripId, selectedStopId, selectedSeats.length, selectedSeats);
    setSubmitting(false);

    if (result.success) {
      const actualSeats = (result.seat_numbers as number[] | undefined) ?? selectedSeats;
      toast.success(`${actualSeats.length} seat${actualSeats.length > 1 ? 's' : ''} held · Seat ${actualSeats.join(', ')}`);
      if (result.request_id) localStorage.setItem('raahi_active_request_id', result.request_id);
      if (user?.id) clearDemandWatch(user.id);
      clearPendingContext();
      router.push('/request-status-screen');
      return;
    }

    toast.error(result.error || 'Could not request seat. Please try again.');
    const refreshed = await loadCar();
    if (refreshed?.seats) {
      const available = new Set(refreshed.seats.filter((seat) => seat.state === 'AVAILABLE').map((seat) => seat.seat_number));
      setSelectedSeats((current) => current.filter((number) => available.has(number)));
    }
    }); }); } catch (e: any) { toast.error(e?.message || 'Could not check launch or booking access.'); }
  };

  const savePendingContext = () => {
    if (routeId) localStorage.setItem('raahi_pending_route_id', routeId);
    if (tripId || car?.trip_id) localStorage.setItem('raahi_pending_trip_id', tripId || car?.trip_id || '');
    localStorage.setItem('raahi_pending_stop_id', selectedStopId);
    localStorage.setItem('raahi_pending_seat_count', String(selectedSeats.length));
    localStorage.setItem('raahi_pending_seat_numbers', JSON.stringify(selectedSeats));
  };

  const clearPendingContext = () => {
    localStorage.removeItem('raahi_pending_route_id');
    localStorage.removeItem('raahi_pending_trip_id');
    localStorage.removeItem('raahi_pending_stop_id');
    localStorage.removeItem('raahi_pending_seat_count');
    localStorage.removeItem('raahi_pending_seat_numbers');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStopId) {
      toast.error('Please select a pickup point');
      return;
    }
    if (selectedSeats.length === 0) {
      toast.error('Please choose at least one seat');
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
    void doSubmitRequest();
  };

  if (loadingCar) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div>;
  }

  if (!car?.has_active_car) {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 py-8 text-center space-y-3">
        <p className="text-base font-semibold text-foreground">No active car</p>
        <p className="text-sm text-muted-foreground">Go back and choose a route with seats available.</p>
      </div>
    );
  }

  const availableStops = (car.stops ?? []).filter((stop) => !stop.is_passed);
  const selectedStop = (car.stops ?? []).find((stop) => stop.stop_id === selectedStopId);
  const seats = [...(car.seats ?? [])].sort((a, b) => a.seat_number - b.seat_number);
  const fareTotal = selectedSeats.length * (car.fare_per_seat ?? 0);

  return (
    <div className="max-w-screen-md mx-auto px-4 py-4 space-y-4 animate-fade-in">
      <div className="card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary"><MapPin size={18} className="text-primary" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Your Raahi</p>
            <p className="mt-0.5 truncate text-sm font-bold text-foreground">{car.driver_display_name} · {car.vehicle_number}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{car.vehicle_model} · {car.vehicle_type}</p>
          </div>
          <div className="shrink-0 rounded-2xl bg-secondary px-3 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Fare</p>
            <p className="mt-0.5 text-base font-extrabold text-primary">₹{car.fare_per_seat ?? 0}<span className="text-[10px] font-semibold text-muted-foreground"> / seat</span></p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4">
          <SeatCountBadge label="Available" count={car.available_count ?? 0} variant="available" />
          <SeatCountBadge label="Held" count={car.held_count ?? 0} variant="held" />
          <SeatCountBadge label="Confirmed" count={car.confirmed_count ?? 0} variant="confirmed" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section>
          <div className="mb-3">
            <p className="section-label">Pickup</p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight text-foreground">Choose your pickup point <span className="text-red-500">*</span></h2>
            <p className="mt-1 text-xs text-muted-foreground">Only stops the driver has not passed are shown.</p>
          </div>
          {availableStops.length === 0 ? (
            <div className="card p-4 text-center text-sm text-muted-foreground"><AlertTriangle size={18} className="mx-auto mb-2 text-amber-500" />Driver has passed all pickup stops.</div>
          ) : (
            <div className="space-y-2">
              {availableStops.map((stop) => {
                const isSelected = selectedStopId === stop.stop_id;
                return (
                  <label key={stop.stop_id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-150 ${isSelected ? 'border-primary bg-secondary' : 'border-border bg-card hover:border-primary/30'}`}>
                    <input type="radio" name="pickup_stop" value={stop.stop_id} checked={isSelected} onChange={() => setSelectedStopId(stop.stop_id)} className="sr-only" />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-primary' : 'border-muted-foreground'}`}>{isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}</div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>{stop.name}</p>
                      {stop.is_current ? <p className="text-xs text-primary font-medium">Driver here now</p> : stop.eta_minutes !== null ? <p className="text-xs text-muted-foreground">~{stop.eta_minutes} min away</p> : null}
                    </div>
                    <MapPin size={14} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                  </label>
                );
              })}
            </div>
          )}
        </section>

        <section className="feature-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="section-label">Seats</p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-foreground">Choose your seats</h2>
              <p className="mt-1 text-xs text-muted-foreground">Tap up to {MAX_SEATS_PER_REQUEST}. Your selection is held together or not at all.</p>
            </div>
            <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-primary">{selectedSeats.length ? `${selectedSeats.length} selected` : 'None selected'}</span>
          </div>

          {seats.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-muted p-4 text-center text-sm text-muted-foreground">Seat map is refreshing. Please try again.</div>
          ) : (
            <>
              <div className="mt-4 rounded-3xl border border-border bg-background p-4 sm:p-5">
                <div className="mx-auto mb-4 flex max-w-sm items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <div className="rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Front of car</div>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="mx-auto grid max-w-sm grid-cols-2 gap-3">
                  {seats.map((seat) => <SeatButton key={seat.seat_number} seat={seat} selected={selectedSeats.includes(seat.seat_number)} onToggle={() => toggleSeat(seat)} />)}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
                <Legend swatch="border-border bg-card" label="Available" />
                <Legend swatch="border-primary bg-secondary" label="Selected" />
                <Legend swatch="border-amber-200 bg-amber-50" label="Held" />
                <Legend swatch="border-green-200 bg-green-50" label="Confirmed" />
                <Legend swatch="border-border bg-muted" label="Unavailable" />
              </div>
            </>
          )}
        </section>

        <div className="feature-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your selection</p>
              <p className="mt-1 text-sm font-bold text-foreground">{selectedSeats.length ? `Seat ${selectedSeats.join(', ')}` : 'Choose at least one seat'}</p>
              {selectedStop && <p className="mt-1 text-xs text-muted-foreground">Pickup: {selectedStop.name}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total fare</p>
              <p className="inline-flex items-center text-xl font-extrabold text-primary"><IndianRupee size={17} />{fareTotal}</p>
            </div>
          </div>
        </div>

        <PayWarningBanner />

        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary"><Users size={14} className="text-primary" /></div>
          <div><p className="text-xs font-bold text-foreground">A hold keeps your exact selection together</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Seats become confirmed only after the driver receives your payment in person.</p></div>
        </div>

        <button type="submit" disabled={submitting || availableStops.length === 0 || selectedSeats.length === 0 || seats.length === 0} className="btn-primary w-full py-3.5">
          {submitting ? <><Loader2 size={18} className="animate-spin" />Holding seats…</> : user ? <><CheckCircle2 size={18} />{selectedSeats.length === 1 ? `Hold seat ${selectedSeats[0]}` : `Hold ${selectedSeats.length || ''} seats`}</> : <><Lock size={18} />Sign in & hold selected seats</>}
        </button>
      </form>

      {launchDialog}{legalDialog}
      {showAuthModal && <AuthModal onComplete={() => setShowAuthModal(false)} onClose={() => { setShowAuthModal(false); setPendingSubmit(false); }} signInWithGoogle={signInWithGoogle} />}
      {showPhoneModal && (
        <PhoneVerificationModal
          onComplete={() => { setShowPhoneModal(false); setPendingSubmit(false); void doSubmitRequest(); }}
          onClose={() => { setShowPhoneModal(false); setPendingSubmit(false); }}
          requestPhoneVerification={requestPhoneVerification}
          verifyPhoneChange={verifyPhoneChange}
        />
      )}
    </div>
  );
}

function SeatButton({ seat, selected, onToggle }: { seat: PublicTripSeat; selected: boolean; onToggle: () => void }) {
  const available = seat.state === 'AVAILABLE';
  const style = selected
    ? 'border-primary bg-secondary text-primary shadow-sm'
    : seat.state === 'HELD'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : seat.state === 'CONFIRMED'
        ? 'border-green-200 bg-green-50 text-green-700'
        : seat.state === 'DRIVER_CLOSED'
          ? 'border-border bg-muted text-muted-foreground'
          : 'border-border bg-card text-foreground hover:border-primary/50';
  const stateLabel = selected ? 'Selected' : seat.state === 'DRIVER_CLOSED' ? 'Unavailable' : seat.state.charAt(0) + seat.state.slice(1).toLowerCase();

  return (
    <button type="button" onClick={onToggle} disabled={!available} aria-pressed={selected} aria-label={`Seat ${seat.seat_number}: ${stateLabel}`} className={`min-h-20 rounded-2xl border-2 p-3 text-center transition-all active:scale-95 disabled:cursor-not-allowed ${style}`}>
      <span className="block text-lg font-extrabold">{seat.seat_number}</span>
      <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide">{stateLabel}</span>
    </button>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded border ${swatch}`} />{label}</span>;
}

function AuthModal({ onComplete, onClose, signInWithGoogle }: { onComplete: () => void; onClose: () => void; signInWithGoogle: (redirectTo?: string) => Promise<any>; }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleGoogle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault(); event.stopPropagation(); setLoading(true); setError('');
    try { await signInWithGoogle(window.location.pathname + window.location.search); onComplete(); }
    catch (err: any) { setError(err.message || 'Google sign-in failed'); setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
      <div className="w-full max-w-md bg-card rounded-t-3xl p-6 space-y-5 animate-slide-up">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-foreground">Sign in to continue</h2><button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted"><X size={18} className="text-muted-foreground" /></button></div>
        <p className="text-sm text-muted-foreground">Your pickup and exact seat selection are saved. Sign in with Google to continue.</p>
        {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2"><AlertTriangle size={14} className="text-red-500" /><p className="text-xs text-red-700">{error}</p></div>}
        <button type="button" className="btn-primary w-full" onClick={handleGoogle} disabled={loading}>{loading ? <Loader2 size={18} className="animate-spin" /> : <span className="text-sm font-bold">G</span>}{loading ? 'Opening Google...' : 'Continue with Google'}</button>
        <p className="text-xs text-center text-muted-foreground">A verified mobile number is required once before your first booking.</p>
      </div>
    </div>
  );
}

function PhoneVerificationModal({ onComplete, onClose, requestPhoneVerification, verifyPhoneChange }: { onComplete: () => void; onClose: () => void; requestPhoneVerification: (phone: string) => Promise<any>; verifyPhoneChange: (phone: string, token: string) => Promise<any>; }) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendOtp = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault(); event.stopPropagation(); if (phone.length !== 10) return; setLoading(true); setError('');
    try { await requestPhoneVerification(phone); setStep('otp'); }
    catch (err: any) { setError(err.message || 'Could not send verification OTP.'); }
    finally { setLoading(false); }
  };

  const verify = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault(); event.stopPropagation(); if (otp.length !== 6) return; setLoading(true); setError('');
    try { await verifyPhoneChange(phone, otp); onComplete(); }
    catch (err: any) { setError(err.message || 'Invalid OTP. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
      <div className="w-full max-w-md bg-card rounded-t-3xl p-6 space-y-5 animate-slide-up">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Verify your mobile number</h2><button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted"><X size={18} className="text-muted-foreground" /></button></div>
        <p className="text-sm text-muted-foreground">Raahi verifies your number so the driver knows the seat request comes from a genuine passenger.</p>
        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">{error}</div>}
        {step === 'phone' ? (
          <div className="space-y-3"><div className="flex gap-2"><span className="flex items-center px-3 rounded-xl bg-muted border border-border text-sm">+91</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="98765 43210" className="input-field flex-1" /></div><button type="button" onClick={sendOtp} disabled={loading || phone.length !== 10} className="btn-primary w-full">{loading ? <Loader2 size={18} className="animate-spin" /> : <Phone size={18} />}{loading ? 'Sending OTP...' : 'Send verification OTP'}</button></div>
        ) : (
          <div className="space-y-3"><p className="text-sm text-muted-foreground">Enter the code sent to +91 {phone}</p><input inputMode="numeric" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" className="input-field text-center text-xl tracking-[0.35em] font-bold" /><button type="button" onClick={verify} disabled={loading || otp.length !== 6} className="btn-primary w-full">{loading && <Loader2 size={18} className="animate-spin" />}{loading ? 'Verifying...' : 'Verify & hold seats'}</button><button type="button" onClick={() => { setStep('phone'); setOtp(''); setError(''); }} className="w-full text-sm text-muted-foreground">Change number</button></div>
        )}
      </div>
    </div>
  );
}