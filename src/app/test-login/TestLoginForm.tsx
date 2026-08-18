'use client';

import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function TestLoginForm() {
  const [loginId, setLoginId] = useState('rajeev1');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/test-auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ loginId, password }),
      });
      const result = (await response.json()) as {
        error?: string;
        redirectTo?: string;
        accessToken?: string;
        refreshToken?: string;
      };

      if (
        !response.ok ||
        !result.redirectTo ||
        !result.accessToken ||
        !result.refreshToken
      ) {
        setError(result.error || 'Login failed');
        return;
      }

      const supabase = createClient();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });
      if (sessionError) {
        setError('Login failed');
        return;
      }

      window.location.assign(result.redirectTo);
    } catch {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <label className="block text-sm font-medium">
        Login ID
        <input
          name="loginId"
          value={loginId}
          onChange={(event) => setLoginId(event.target.value)}
          autoComplete="username"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="block text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-xs text-slate-500">
        IDs: ajit-admin, dipti-driver, rajeev4-driver, rajeev1, rajeev2, rajeev3, naresh.
      </p>
    </form>
  );
}
