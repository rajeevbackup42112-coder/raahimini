"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FixedPaymentProjection } from "./types";

type ApiResponse = { ok: true } | { ok: false; message: string };

export function PassengerPaymentCard({ payment }: { payment: FixedPaymentProjection }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function command(action: "MARK_PAID" | "REPORT_ISSUE") {
    setBusy(true); setMessage(null);
    const response = await fetch("/api/payments/fixed", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, paymentId: payment.payment_id, details: action === "REPORT_ISSUE" ? details : undefined, idempotencyKey: crypto.randomUUID() }),
    });
    const payload = (await response.json()) as ApiResponse;
    if (!payload.ok) setMessage(payload.message); else { setDetails(""); router.refresh(); }
    setBusy(false);
  }

  const label = payment.status === "DUE" ? "Payment due to Driver" : payment.status === "PASSENGER_MARKED_PAID" ? "You marked this paid" : payment.status === "DRIVER_CONFIRMED_RECEIVED" ? "Driver confirmed receipt" : "Payment issue under review";  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Direct payment</p>
      <h2 className="mt-2 text-xl font-semibold text-zinc-950">₹{payment.amount_inr} · {label}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">Pay the Driver directly. Raahi records acknowledgements only and does not hold or process this money.</p>
      {payment.status === "DUE" ? <button type="button" disabled={busy} onClick={() => void command("MARK_PAID")} className="mt-4 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">I&apos;ve paid the Driver</button> : null}
      {payment.status !== "DRIVER_CONFIRMED_RECEIVED" && payment.status !== "PAYMENT_DISPUTED" ? (
        <div className="mt-5 border-t border-zinc-200 pt-4">
          <label className="text-sm font-medium text-zinc-800">Payment problem</label>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm" placeholder="Describe what happened" />
          <button type="button" disabled={busy || details.trim().length < 3} onClick={() => void command("REPORT_ISSUE")} className="mt-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-40">Report payment issue</button>
        </div>
      ) : null}
      {payment.dispute_case_id ? <p className="mt-3 text-xs text-zinc-500">Support case opened. Your completed Ride remains unchanged.</p> : null}
      {message ? <p className="mt-3 text-sm text-red-700" role="status">{message}</p> : null}
    </section>
  );
}