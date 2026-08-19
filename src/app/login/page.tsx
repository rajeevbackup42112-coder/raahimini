'use client';

import { useState } from 'react';
import { Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const signIn = async () => {
    setBusy(true);
    setError('');
    try {
      await signInWithGoogle('/');
    } catch (err: any) {
      setError(err?.message || 'Could not start Google sign-in.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md card p-6 space-y-5 text-center">
        <div className="flex justify-center"><AppLogo size={52} /></div>
        <div>
          <h1 className="text-2xl font-bold">Sign in to Raahi</h1>
          <p className="text-sm text-muted-foreground mt-2">One sign-in for passengers, drivers and admins. Raahi will take you to the right place automatically.</p>
        </div>
        <div className="flex items-start gap-2 rounded-xl bg-muted px-3 py-3 text-left">
          <ShieldCheck size={18} className="text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">Passenger and driver accounts must have a verified mobile number. If yours is missing, we will ask you to verify it once.</p>
        </div>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 text-left">{error}</div>}
        <button onClick={signIn} disabled={busy} className="btn-primary w-full min-h-12">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
          {busy ? 'Opening Google…' : 'Continue with Google'}
        </button>
        <a href="/" className="block text-sm text-muted-foreground hover:text-foreground">Continue browsing without signing in</a>
      </div>
    </div>
  );
}
