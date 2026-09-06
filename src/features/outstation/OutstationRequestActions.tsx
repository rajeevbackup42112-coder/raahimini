"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OutstationRequestActions({ requestId, revisionId }: { requestId: string; revisionId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function post(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, idempotencyKey: crypto.randomUUID() }) });
      const payload = (await response.json()) as { ok: boolean; message?: string };
      if (!payload.ok) setMessage(payload.message ?? "Raahi could not confirm this action.");
      else router.refresh();
    } catch {
      setMessage("The network did not confirm this action. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-4">
    {revisionId ? <button type="button" disabled={busy} onClick={() => void post("/api/outstation/accept", { requestId, revisionId })} className="rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Confirming…" : "Select this Driver"}</button> :
      <button type="button" disabled={busy} onClick={() => void post("/api/outstation/cancel", { requestId })} className="rounded-2xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Cancel request</button>}
    {message ? <p className="mt-2 text-sm text-zinc-700" role="status">{message}</p> : null}
  </div>;
}
