"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignInButton({ nextPath }: { nextPath: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setBusy(false);
      setMessage("Google sign-in is not available yet for this Raahi environment.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="w-full rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>
      {message ? <p className="mt-3 text-sm text-rose-700" role="status">{message}</p> : null}
    </div>
  );
}
