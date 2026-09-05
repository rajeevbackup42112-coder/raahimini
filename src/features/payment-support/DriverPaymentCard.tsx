"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DriverPaymentProjection } from "./types";

type ApiResponse = { ok: true } | { ok: false; message: string };

export function DriverPaymentCard({ payment }: { payment: DriverPaymentProjection }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function command(action: "CONFIRM_RECEIVED" | "REPORT_ISSUE") {
    setBusy(true); setMessage(null);
    const response = await fetch("/api/payments/fixed", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, paymentId: payment.payment_id, details: action === "REPORT_ISSUE" ? details : undefined, idempotencyKey: crypto.randomUUID() }),
    });
    const payload = (await response.json()) as ApiResponse;
    if (!payload.ok) setMessage(payload.message); else { setDetails(""); router.refresh(); }
    setBusy(false);
  }

  const canConfirm = payment.status === "PASSENGER_MARKED_PAID";  return (
    <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Direct payment</p>
      <p className="mt-2 text-sm font-semibold text-zinc-950">₹{payment.amount_inr} · {payment.status.replaceAll("_", " ")}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-600">Raahi records declarations only. It does not claim the bank or cash transfer succeeded.</p>
      {canConfirm ? <button type="button" disabled={busy} onClick={() => void command("CONFIRM_RECEIVED")} className="mt-3 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Payment received</button> : null}
      {payment.status !== "DRIVER_CONFIRMED_RECEIVED" && payment.status !== "PAYMENT_DISPUTED" ? (
        <div className="mt-4 border-t border-zinc-200 pt-3">
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm" placeholder="Describe a payment problem" />
          <button type="button" disabled={busy || details.trim().length < 3} onClick={() => void command("REPORT_ISSUE")} className="mt-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-40">Report payment issue</button>
        </div>
      ) : null}
      {message ? <p className="mt-2 text-sm text-red-700" role="status">{message}</p> : null}
    </div>
  );
}