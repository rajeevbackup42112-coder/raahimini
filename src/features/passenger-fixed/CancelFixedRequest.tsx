"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ApiResponse =
  | { ok: true; value: { request_id: string; status: string; cancelled_at: string }; correlationId: string }
  | { ok: false; code: string; message: string; correlationId: string };

export function CancelFixedRequest({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(idempotencyKey: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/fixed/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, idempotencyKey }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!payload.ok) {
        setMessage(payload.message);
        return;
      }
      setPendingKey(null);
      router.refresh();
    } catch {
      setMessage("The network did not confirm cancellation. Retry safely with the same request.");
    } finally {
      setBusy(false);
    }
  }

  function beginCancel() {
    const key = crypto.randomUUID();
    setPendingKey(key);
    void submit(key);
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button type="button" disabled={busy} onClick={beginCancel} className="rounded-2xl border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-900 disabled:opacity-50">
        {busy ? "Cancelling…" : "Cancel request"}
      </button>
      {message && pendingKey ? <button type="button" disabled={busy} onClick={() => void submit(pendingKey)} className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">Retry same cancellation</button> : null}
      {message ? <p className="w-full text-sm text-rose-700" role="status">{message}</p> : null}
    </div>
  );
}
