'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, Phone, ShieldCheck, Trash2 } from 'lucide-react';
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
  const roleLabel = profile?.role ? `${profile.role.charAt(0).toUpperCase()}${profile.role.slice(1)}` : 'Passenger';

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
  }, [profile?.display_name]);

  const saveDisplayName = async () => {
    const normalized = displayName.trim();
    if (normalized.length < 2 || normalized.length > 40) return;
    setSavingName(true); setError('');
    try {
      await updateDisplayName(normalized);
      toast.success('Raahi name updated');
    } catch (err: any) {
      setError(err.message || 'Could not update your Raahi name.');
    } finally { setSavingName(false); }
  };

  if (authLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  if (!user) return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="feature-card p-7 text-center">
        <AlertTriangle size={34} className="mx-auto text-amber-500" />
        <h1 className="mt-4 text-xl font-extrabold">Sign in to manage your Raahi identity</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Use Google sign-in, then return here to manage your name and verified booking phone.</p>
      </div>
    </div>
  );

  const sendOtp = async () => {
    if (phone.length !== 10) return;
    setBusy(true); setError('');
    try {
      await requestPhoneVerification(phone);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Could not send OTP.');
    } finally { setBusy(false); }
  };

  const verify = async () => {
    if (otp.length !== 6) return;
    setBusy(true); setError('');
    try {
      await verifyPhoneChange(phone, otp);
      toast.success('Phone number verified');
      if (next) router.replace(next);
      else {
        setStep('phone'); setPhone(''); setOtp(''); router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Could not verify OTP.');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm('Remove this phone number? Phone login and seat requests will be unavailable until another number is verified.')) return;
    setBusy(true); setError('');
    try {
      await removePhone();
      toast.success('Phone number removed');
    } catch (err: any) {
      setError(err.message || 'Could not remove phone number.');
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-24">
          <section className="overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground card-shadow sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12 text-lg font-extrabold">{(profile?.display_name || user.user_metadata?.full_name || 'R').charAt(0).toUpperCase()}</div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide">{roleLabel}</span>
            </div>
            <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">Your Raahi identity</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{profile?.display_name || user.user_metadata?.full_name || 'Raahi user'}</h1>
            <p className="mt-1 break-all text-xs text-white/70">{user.email || user.phone || ''}</p>
            <div className={`mt-5 flex items-start gap-3 rounded-2xl px-4 py-3 ${isVerified ? 'bg-white/10' : 'bg-amber-300/15'}`}>
              {isVerified ? <ShieldCheck size={19} className="mt-0.5 shrink-0 text-emerald-200" /> : <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-200" />}
              <div><p className="text-sm font-bold">{isVerified ? 'Booking phone verified' : 'Phone verification required'}</p><p className="mt-1 text-xs leading-relaxed text-white/70">{isVerified ? user.phone : 'Verify a phone before requesting a seat.'}</p></div>
            </div>
          </section>

          <section className="rounded-2xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-start gap-3"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-700"/><div><p className="text-xs font-bold text-green-900">Identity stays controlled</p><p className="mt-1 text-xs leading-relaxed text-green-800">Your Raahi name is visible in the service. Phone verification protects booking eligibility and account contact.</p></div></div>
          </section>
        </aside>

        <section className="space-y-4">
          {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
          <div className="feature-card p-5 sm:p-6">
            <p className="section-label">Public identity</p>
            <h2 className="mt-2 text-lg font-extrabold">What should Raahi call you?</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">This is the name passengers, drivers and admins will see in Raahi.</p>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value.slice(0, 40))} placeholder="Your Raahi name" className="input-field mt-4" />
            <button type="button" onClick={saveDisplayName} disabled={savingName || displayName.trim().length < 2 || displayName.trim() === (profile?.display_name || '')} className="btn-primary mt-3 w-full">
              {savingName && <Loader2 size={18} className="animate-spin" />}{savingName ? 'Saving…' : 'Save Raahi name'}
            </button>
          </div>

          {step === 'phone' ? (
            <div className="feature-card p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3"><div><p className="section-label">Booking security</p><h2 className="mt-2 text-lg font-extrabold">{isVerified ? 'Change phone number' : 'Add phone number'}</h2><p className="mt-1 text-sm text-muted-foreground">We will send a six-digit verification code.</p></div>{isVerified && <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700">Verified</span>}</div>
              <div className="mt-4 flex gap-2">
                <span className="flex items-center rounded-xl border border-border bg-muted px-3 text-sm">+91</span>
                <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="98765 43210" className="input-field flex-1" />
              </div>
              <button type="button" onClick={sendOtp} disabled={busy || phone.length !== 10} className="btn-primary mt-3 w-full">
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Phone size={18} />}{busy ? 'Sending OTP...' : 'Send verification OTP'}
              </button>
              {isVerified && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-xs leading-relaxed text-muted-foreground">Removing your verified phone disables phone login and seat requests until another number is verified.</p>
                  <button type="button" onClick={remove} disabled={busy} className="btn-outline mt-3 w-full text-red-600"><Trash2 size={17} /> Remove phone number</button>
                </div>
              )}
            </div>
          ) : (
            <div className="feature-card p-5 sm:p-6">
              <p className="section-label">Booking security</p>
              <h2 className="mt-2 text-lg font-extrabold">Enter verification code</h2>
              <p className="mt-1 text-sm text-muted-foreground">Sent to +91 {phone}</p>
              <input inputMode="numeric" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" className="input-field mt-4 text-center text-xl font-bold tracking-[0.35em]" />
              <button type="button" onClick={verify} disabled={busy || otp.length !== 6} className="btn-primary mt-3 w-full">
                {busy && <Loader2 size={18} className="animate-spin" />}{busy ? 'Verifying...' : 'Verify phone'}
              </button>
              <button type="button" onClick={() => { setStep('phone'); setOtp(''); setError(''); }} className="mt-3 w-full text-sm font-semibold text-muted-foreground">Change number</button>
            </div>
          )}
        </section>
      </div>
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
