"use client";

import { useState } from "react";

type Category = "SAFETY" | "DRIVER_DID_NOT_ARRIVE" | "PASSENGER_DID_NOT_ARRIVE" | "WRONG_VEHICLE" | "FARE_DISAGREEMENT" | "BEHAVIOUR" | "BREAKDOWN" | "APP_SYSTEM_PROBLEM" | "OTHER";
const categories: { value: Category; label: string }[] = [
  { value: "SAFETY", label: "Safety" }, { value: "DRIVER_DID_NOT_ARRIVE", label: "Driver did not arrive" },
  { value: "PASSENGER_DID_NOT_ARRIVE", label: "Passenger did not arrive" }, { value: "WRONG_VEHICLE", label: "Wrong vehicle" },
  { value: "FARE_DISAGREEMENT", label: "Fare disagreement" }, { value: "BEHAVIOUR", label: "Behaviour" },
  { value: "BREAKDOWN", label: "Breakdown" }, { value: "APP_SYSTEM_PROBLEM", label: "App/system problem" },
  { value: "OTHER", label: "Other" },
];

type ApiResponse = { ok: true; value?: { case_id?: string } } | { ok: false; message: string };
export function ReportIssue({ objectType, objectId }: { objectType: "RIDE" | "BOOKING"; objectId: string }) {
  const [open, setOpen] = useState(false); const [category, setCategory] = useState<Category>("OTHER");
  const [details, setDetails] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setMessage(null);
    const response = await fetch("/api/support/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ objectType, objectId, category, details, idempotencyKey: crypto.randomUUID() }) });
    const payload = (await response.json()) as ApiResponse;    if (!payload.ok) setMessage(payload.message); else { setMessage("Support case opened. The Ride itself was not changed."); setDetails(""); setOpen(false); }
    setBusy(false);
  }

  return (
    <div className="mt-5 border-t border-zinc-200 pt-4">
      <button type="button" onClick={() => setOpen((value) => !value)} className="text-sm font-semibold text-zinc-700">{open ? "Close support form" : "Report another issue"}</button>
      {open ? (
        <div className="mt-3 space-y-3">
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm" aria-label="Issue category">
            {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm" placeholder="Tell Raahi what happened" />
          <button type="button" disabled={busy || details.trim().length < 3} onClick={() => void submit()} className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Open support case</button>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-zinc-600" role="status">{message}</p> : null}
    </div>
  );
}