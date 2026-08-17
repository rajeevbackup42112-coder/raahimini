'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type OAuthExchangeResult = Awaited<ReturnType<ReturnType<typeof createClient>['auth']['exchangeCodeForSession']>>;

declare global {
  interface Window {
    __raahiOAuthExchange?: Promise<OAuthExchangeResult>;
  }
}

function safeRedirectPath(next: string | null) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

export default function AuthCompletePage() {
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const destination = safeRedirectPath(params.get('next'));

    if (!code) {
      setError('Google sign-in could not be completed. Please try again.');
      return;
    }

    const supabase = createClient();
    window.__raahiOAuthExchange ??= supabase.auth.exchangeCodeForSession(code);

    window.__raahiOAuthExchange.then(({ error: exchangeError }) => {
      if (exchangeError) {
        setError('Google sign-in could not be completed. Please try again.');
        return;
      }
      window.location.replace(destination);
    });
  }, []);

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <AlertTriangle size={36} className="mx-auto text-amber-500" />
        <h1 className="text-lg font-bold">Sign-in incomplete</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button onClick={() => window.location.replace('/')} className="btn-primary w-full">
          Return home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-3">
      <Loader2 size={34} className="mx-auto animate-spin text-primary" />
      <h1 className="text-lg font-bold">Completing sign-in</h1>
      <p className="text-sm text-muted-foreground">Raahi is securely restoring your session and saved request.</p>
    </div>
  );
}
