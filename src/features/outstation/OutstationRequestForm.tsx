"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OutstationProduct } from "./types";

type Props = {
  product: OutstationProduct;
  originLocationId: string;
  destinationLocationId: string | null;
  destinationText: string;
};

type ApiResult = { ok: true; value: { request_id: string } } | { ok: false; message: string };

export function OutstationRequestForm({ product, originLocationId, destinationLocationId, destinationText }: Props) {
  const router = useRouter();
  const [travelType, setTravelType] = useState<"ONE_WAY" | "ROUND_TRIP">("ONE_WAY");
  const [departureAt, setDepartureAt] = useState("");
  const [returnAt, setReturnAt] = useState("");
  const [passengerCount, setPassengerCount] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!departureAt || (travelType === "ROUND_TRIP" && !returnAt)) {
      setMessage("Choose the journey date and time.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {      const response = await fetch("/api/outstation/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: product.product_id,
          originLocationId,
          destinationLocationId,
          destinationText,
          travelType,
          departureAt: new Date(departureAt).toISOString(),
          returnAt: travelType === "ROUND_TRIP" ? new Date(returnAt).toISOString() : null,
          passengerCount,
          passengerNote: note || null,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const payload = (await response.json()) as ApiResult;
      if (!payload.ok) {
        if (response.status === 401) {
          router.push(`/auth/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`);
          return;
        }
        setMessage(payload.message);
        return;
      }
      router.push(`/outstation/request/${payload.value.request_id}`);
    } catch {
      setMessage("The network did not confirm this request. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-zinc-500">Private car request</p>
      <h2 className="mt-1 text-2xl font-semibold">{product.market_name} → {destinationText}</h2>
      <div className="mt-5 grid gap-4">
        <label className="text-sm font-medium">Journey type
          <select value={travelType} onChange={(event) => setTravelType(event.target.value as "ONE_WAY" | "ROUND_TRIP")} className="mt-1 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3">
            <option value="ONE_WAY">One way</option><option value="ROUND_TRIP">Round trip</option>
          </select>
        </label>
        <label className="text-sm font-medium">Departure
          <input type="datetime-local" value={departureAt} onChange={(event) => setDepartureAt(event.target.value)} className="mt-1 w-full rounded-2xl border border-zinc-300 px-4 py-3" />
        </label>
        {travelType === "ROUND_TRIP" ? <label className="text-sm font-medium">Return
          <input type="datetime-local" value={returnAt} onChange={(event) => setReturnAt(event.target.value)} className="mt-1 w-full rounded-2xl border border-zinc-300 px-4 py-3" />
        </label> : null}
        <label className="text-sm font-medium">Passengers
          <input type="number" min={1} max={8} value={passengerCount} onChange={(event) => setPassengerCount(Number(event.target.value))} className="mt-1 w-full rounded-2xl border border-zinc-300 px-4 py-3" />
        </label>
        <label className="text-sm font-medium">Helpful note <span className="font-normal text-zinc-500">(optional)</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} className="mt-1 min-h-24 w-full rounded-2xl border border-zinc-300 px-4 py-3" placeholder="Luggage, pickup context, or another useful detail" />
        </label>
      </div>      <p className="mt-5 text-xs leading-5 text-zinc-500">Drivers receive trip details only. Passenger identity is revealed only after you select a quote and Raahi confirms the trip.</p>
      <button type="button" disabled={busy} onClick={() => void submit()} className="mt-5 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Creating request…" : "Request quotes"}</button>
      {message ? <p className="mt-3 text-sm text-zinc-700" role="status">{message}</p> : null}
    </section>
  );
}
