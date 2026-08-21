'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogIn, ShieldCheck } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, loading, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (profile.role === 'admin') router.replace('/admin-panel');
    else if (profile.role === 'driver') router.replace('/driver-route-selection');
    else router.replace('/');
  }, [loading, profile, router, user]);

  const handleGoogle = async () => {
    setBusy(true);
    try {
      await signInWithGoogle('/login');
    } finally {
      setBusy(false);
    }
  };

  const resolving = loading || Boolean(user && !profile);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Sign in" showBack />
      <main className="mx-auto max-w-md px-4 py-10">
        {resolving || user ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="card space-y-5 p-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                <ShieldCheck className="text-primary" />
              </div>
              <h1 className="text-xl font-bold">Welcome to Raahi</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                One sign-in for passengers, drivers and admins. Raahi will take you to the right place automatically.
              </p>
            </div>
            <button disabled={busy} onClick={handleGoogle} className="btn-primary w-full">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              {busy ? 'Opening Google…' : 'Continue with Google'}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              You can browse routes without signing in. Sign in only when you want to use your Raahi account.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
