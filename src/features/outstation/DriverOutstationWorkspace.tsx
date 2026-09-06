"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { OutstationDriverWorkspace, OutstationOpportunity } from "./types";
import { formatIndiaDateTime } from "./format";

type ApiResult = { ok: boolean; message?: string };

export function DriverOutstationWorkspace({ workspace }: { workspace: OutstationDriverWorkspace }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  async function post(key: string, path: string, body: Record<string, unknown>) {
    setBusy(key);
    setMessage(null);
    try {
      const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, idempotencyKey: crypto.randomUUID() }) });
      const payload = (await response.json()) as ApiResult;
      if (!payload.ok) setMessage(payload.message ?? "Raahi could not confirm this action.");
      else router.refresh();
    } catch {
      setMessage("The network did not confirm this action. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const product = workspace.products[0];
  function submitQuote(event: FormEvent<HTMLFormElement>, opportunity: OutstationOpportunity) {
    event.preventDefault();
    if (!workspace.active_vehicle_id) return;
    const form = new FormData(event.currentTarget);
    const price = Number(form.get("price"));
    const note = String(form.get("note") ?? "");
    const includesTolls = form.get("tolls") === "on";
    const includesParking = form.get("parking") === "on";
    void post(`quote:${opportunity.request_id}`, "/api/driver/outstation/quote", {
      requestId: opportunity.request_id,
      vehicleId: workspace.active_vehicle_id,
      totalPriceInr: price,
      includesTolls,
      includesParking,
      commercialNote: note || null,
    });
  }

  return <div className="space-y-6">
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Outstation service</p>
      {product ? <div className="mt-3 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">{product.product_name}</h2><p className="text-sm text-zinc-600">{product.market_name} origin</p></div><button type="button" disabled={busy !== null} onClick={() => void post("preference", "/api/driver/outstation/preference", { productId: product.product_id, enabled: !product.is_enabled })} className="rounded-2xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold">{product.is_enabled ? "Stop receiving opportunities" : "Serve Outstation"}</button></div> : <p className="mt-3 text-sm text-zinc-600">No Outstation Product is active for this Driver.</p>}
      <p className="mt-3 text-xs leading-5 text-zinc-500">Serving Outstation only makes you eligible for relevant opportunities. It never auto-accepts a Passenger request.</p>
    </section>
    {product?.is_enabled ? <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Future availability in {product.market_name}</h2>
      <p className="mt-2 text-sm text-zinc-600">For future Outstation work, Raahi can use this planned Market window instead of requiring you to be physically at tomorrow&apos;s origin today.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Available from<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="mt-1 w-full rounded-2xl border border-zinc-300 px-3 py-2.5" /></label><label className="text-sm font-medium">Until<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="mt-1 w-full rounded-2xl border border-zinc-300 px-3 py-2.5" /></label></div>
      <button type="button" disabled={busy !== null || !startsAt || !endsAt} onClick={() => void post("availability", "/api/driver/outstation/availability", { marketId: product.market_id, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() })} className="mt-4 rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Save availability window</button>
      {workspace.planned_availability.length ? <div className="mt-4 space-y-2">{workspace.planned_availability.map((window) => <p key={window.availability_id} className="rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-700">{window.market_name}: {formatIndiaDateTime(window.starts_at)} → {formatIndiaDateTime(window.ends_at)}</p>)}</div> : null}
    </section> : null}

    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Private opportunities</p><h2 className="mt-1 text-xl font-semibold">Quote only the trips you want</h2></div><span className="text-sm text-zinc-500">{workspace.opportunities.length}</span></div>
      <p className="mt-2 text-sm text-zinc-600">You see trip details, not Passenger identity or competitor quote prices before selection.</p>
      <div className="mt-5 space-y-4">        {workspace.opportunities.map((opportunity) => <article key={opportunity.request_id} className="rounded-2xl border border-zinc-200 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-zinc-500">{opportunity.travel_type === "ROUND_TRIP" ? "Round trip" : "One way"}</p><h3 className="mt-1 text-lg font-semibold">{opportunity.origin_name} → {opportunity.destination_name}{opportunity.travel_type === "ROUND_TRIP" ? ` → ${opportunity.origin_name}` : ""}</h3><p className="mt-1 text-sm text-zinc-600">{formatIndiaDateTime(opportunity.departure_at)} · {opportunity.passenger_count} passenger{opportunity.passenger_count === 1 ? "" : "s"}</p></div>{opportunity.request_status === "REOPENED" ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Reopened</span> : null}</div>
          {opportunity.passenger_note ? <p className="mt-3 rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-600">{opportunity.passenger_note}</p> : null}
          {opportunity.own_quote ? <p className="mt-3 text-sm text-zinc-600">Your revision {opportunity.own_quote.current_revision_no}: <span className="font-semibold text-zinc-950">₹{opportunity.own_quote.total_price_inr}</span>{opportunity.own_quote.valid_until ? ` · valid until ${formatIndiaDateTime(opportunity.own_quote.valid_until)}` : ""}</p> : null}
          <form onSubmit={(event) => submitQuote(event, opportunity)} className="mt-4 grid gap-3">
            <label className="text-sm font-medium">Whole-car quote (₹)<input name="price" type="number" min={1} required defaultValue={opportunity.own_quote?.total_price_inr ?? undefined} className="mt-1 w-full rounded-2xl border border-zinc-300 px-3 py-2.5" /></label>
            <div className="flex flex-wrap gap-4 text-sm"><label><input name="tolls" type="checkbox" defaultChecked={opportunity.own_quote?.includes_tolls ?? false} className="mr-2" />Tolls included</label><label><input name="parking" type="checkbox" defaultChecked={opportunity.own_quote?.includes_parking ?? false} className="mr-2" />Parking included</label></div>
            <label className="text-sm font-medium">Commercial note <span className="font-normal text-zinc-500">(optional)</span><input name="note" maxLength={500} defaultValue={opportunity.own_quote?.commercial_note ?? ""} className="mt-1 w-full rounded-2xl border border-zinc-300 px-3 py-2.5" /></label>
            <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy !== null || !workspace.active_vehicle_id} className="rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{opportunity.own_quote ? "Submit new revision" : "Send quote"}</button><button type="button" disabled={busy !== null} onClick={() => void post(`ignore:${opportunity.request_id}`, "/api/driver/outstation/ignore", { requestId: opportunity.request_id })} className="rounded-2xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold">Ignore</button></div>
          </form>
        </article>)}
        {workspace.opportunities.length === 0 ? <p className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">No eligible Outstation opportunity matches your current/planned Market availability right now.</p> : null}
      </div>
    </section>
    {message ? <p className="rounded-2xl bg-white p-4 text-sm text-zinc-700 shadow-sm" role="status">{message}</p> : null}
  </div>;
}
