'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, Phone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading, requestPhoneVerification, verifyPhoneChange, removePhone, updateDisplayName } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nextParam = searchParams.get('next');
  const next = nextParam?.startsWith('/') ? nextParam : null;
  const isVerified = Boolean(user?.phone && user?.phone_confirmed_at);

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
  }, [profile?.display_name]);

  const saveDisplayName = async () => {
    const normalized = displayName.trim();
    if (normalized.length < 2 || normalized.length > 40) return;
    setSavingName(true);
    setError('');
    try {
      await updateDisplayName(normalized);
      toast.success('Raahi name updated');
    } catch (err: any) {
      setError(err.message || 'Could not update your Raahi name.');
    } finally {
      setSavingName(false);
    }
  };

  if (authLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center space-y-3">
        <AlertTriangle size={36} className="mx-auto text-amber-500" />
        <h1 className="text-lg font-bold">Sign in first</h1>
        <p className="text-sm text-muted-foreground">Use Google sign-in when requesting a seat, then return here to manage your phone.</p>
      </div>
    );
  }

  const sendOtp = async () => {
    if (phone.length !== 10) return;
    setBusy(true);
    setError('');
    try {
      await requestPhoneVerification(phone);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Could not send OTP.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (otp.length !== 6) return;
    setBusy(true);
    setError('');
    try {
      await verifyPhoneChange(phone, otp);
      toast.success('Phone number verified');
      if (next) router.replace(next);
      else {
        setStep('phone');
        setPhone('');
        setOtp('');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Could not verify OTP.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Remove this phone number? Phone login and seat requests will be unavailable until another number is verified.')) return;
    setBusy(true);
    setError('');
    try {
      await removePhone();
      toast.success('Phone number removed');
    } catch (err: any) {
      setError(err.message || 'Could not remove phone number.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-5">
      <div className="card p-5 space-y-2">
        <p className="text-xs text-muted-foreground">Your Raahi identity</p>
        <p className="text-lg font-semibold">{profile?.display_name || user.user_metadata?.full_name || 'Passenger'}</p>
        <p className="text-xs text-muted-foreground">{profile?.role ? `${profile.role.charAt(0).toUpperCase()}${profile.role.slice(1)}` : 'Passenger'} · {user.email || user.phone || ''}</p>
        <div className="flex items-center gap-2 text-sm">
          {isVerified ? <CheckCircle2 size={17} className="text-green-600" /> : <AlertTriangle size={17} className="text-amber-500" />}
          <span>{isVerified ? `Verified phone: ${user.phone}` : 'Phone verification required before booking'}</span>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <div>
          <h2 className="font-bold">What should Raahi call you?</h2>
          <p className="text-sm text-muted-foreground mt-1">This is the name passengers, drivers and admins will see in Raahi.</p>
        </div>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value.slice(0, 40))}
          placeholder="Your Raahi name"
          className="input-field"
        />
        <button type="button" onClick={saveDisplayName} disabled={savingName || displayName.trim().length < 2 || displayName.trim() === (profile?.display_name || '')} className="btn-primary w-full">
          {savingName && <Loader2 size={18} className="animate-spin" />}
          {savingName ? 'Saving…' : 'Save Raahi name'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">{error}</div>}

      {step === 'phone' ? (
        <div className="card p-5 space-y-4">
          <div>
            <h2 className="font-bold">{isVerified ? 'Change phone number' : 'Add phone number'}</h2>
            <p className="text-sm text-muted-foreground mt-1">We will send a six-digit verification code.</p>
          </div>
          <div className="flex gap-2">
            <span className="flex items-center px-3 rounded-xl bg-muted border border-border text-sm">+91</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="98765 43210"
              className="input-field flex-1"
            />
          </div>
          <button type="button" onClick={sendOtp} disabled={busy || phone.length !== 10} className="btn-primary w-full">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Phone size={18} />}
            {busy ? 'Sending OTP...' : 'Send verification OTP'}
          </button>
          {isVerified && (
            <button type="button" onClick={remove} disabled={busy} className="btn-outline w-full text-red-600">
              <Trash2 size={17} /> Remove phone number
            </button>
          )}
        </div>
      ) : (
        <div className="card p-5 space-y-4">
          <div>
            <h2 className="font-bold">Enter verification code</h2>
            <p className="text-sm text-muted-foreground mt-1">Sent to +91 {phone}</p>
          </div>
          <input
            inputMode="numeric"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit OTP"
            className="input-field text-center text-xl tracking-[0.35em] font-bold"
          />
          <button type="button" onClick={verify} disabled={busy || otp.length !== 6} className="btn-primary w-full">
            {busy && <Loader2 size={18} className="animate-spin" />}
            {busy ? 'Verifying...' : 'Verify phone'}
          </button>
          <button type="button" onClick={() => { setStep('phone'); setOtp(''); setError(''); }} className="w-full text-sm text-muted-foreground">
            Change number
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AppLayout headerTitle="Profile" headerBack>
      <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>}>
        <ProfileContent />
      </Suspense>
    </AppLayout>
  );
}
