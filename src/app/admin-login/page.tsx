'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, ShieldCheck } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, profile, loading, signInWithGoogle, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.location?.search) window.history?.replaceState({}, '', '/admin-login');
  }, []);

  useEffect(() => {
    if (!loading && user && profile?.role === 'admin') router?.replace('/admin-panel');
  }, [loading, user, profile?.role, router]);

  const handleGoogle = async () => {
    setBusy(true);
    try { await signInWithGoogle('/admin-login'); }
    finally { setBusy(false); }
  };

  const handleSignOut = async () => {
    await signOut();
    router?.replace('/admin-login');
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Admin Sign In" showBack />
      <main className="max-w-md mx-auto px-4 py-10">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
        ) : user ? (
          <div className="card p-6 text-center space-y-4">
            <ShieldCheck size={42} className="mx-auto text-primary" />
            <div>
              <h1 className="text-xl font-bold">Admin access not available</h1>
              <p className="text-sm text-muted-foreground mt-2">You are signed in as {user?.email || 'this Google account'}, but this account is not an active Raahi admin.</p>
            </div>
            <button onClick={handleSignOut} className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2"><LogOut size={16}/>Use a different account</button>
          </div>
        ) : (
          <div className="card p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4"><ShieldCheck className="text-primary" /></div>
              <h1 className="text-xl font-bold">Raahi Admin</h1>
              <p className="text-sm text-muted-foreground mt-2">Sign in with the Google account authorized as Raahi admin.</p>
            </div>
            <button disabled={busy} onClick={handleGoogle} className="w-full bg-primary text-primary-foreground rounded-xl px-4 py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 size={18} className="animate-spin"/> : <span className="text-lg font-bold">G</span>}
              Sign in with Google
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
