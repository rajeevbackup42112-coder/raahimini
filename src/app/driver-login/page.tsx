'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Car, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/contexts/AuthContext';

export default function DriverLoginPage() {
  const router = useRouter();
  const { user, profile, loading, signInWithGoogle, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The server callback has already consumed this one-time OAuth code.
    // Remove any query string retained by the hosting redirect.
    if (window.location.search) {
      window.history.replaceState({}, '', '/driver-login');
    }
  }, []);

  useEffect(() => {
    if (!loading && user && profile?.role === 'driver') {
      router.replace('/driver-route-selection');
    }
  }, [loading, user, profile?.role, router]);

  const handleGoogle = async () => {
    setBusy(true);
    try {
      await signInWithGoogle('/driver-login');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/driver-login');
  };

  const resolvingProfile = !!user && !profile;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Driver Sign In" showBack />
      <main className="max-w-md mx-auto px-4 py-10">
        {loading || resolvingProfile ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
        ) : user ? (
          <div className="card p-6 text-center space-y-4">
            <ShieldCheck size={42} className="mx-auto text-primary" />
            <div>
              <h1 className="text-xl font-bold">Driver account not activated yet</h1>
              <p className="text-sm text-muted-foreground mt-2">You are signed in as {user.email || 'this Google account'}. An admin must activate this account as a Raahi driver and attach a vehicle before the Driver panel becomes available.</p>
            </div>
            <button onClick={handleSignOut} className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2"><LogOut size={16}/>Use a different account</button>
          </div>
        ) : (
          <div className="card p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4"><Car className="text-primary" /></div>
              <h1 className="text-xl font-bold">Driver access</h1>
              <p className="text-sm text-muted-foreground mt-2">Passengers do not need to sign in to browse. This sign-in is only for registered Raahi drivers.</p>
            </div>
            <button disabled={busy} onClick={handleGoogle} className="w-full bg-primary text-primary-foreground rounded-xl px-4 py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 size={18} className="animate-spin"/> : <span className="text-lg font-bold">G</span>}
              Sign in with Google
            </button>
            <p className="text-xs text-center text-muted-foreground">After first sign-in, Raahi admin can verify and activate the driver account.</p>
          </div>
        )}
      </main>
    </div>
  );
}
