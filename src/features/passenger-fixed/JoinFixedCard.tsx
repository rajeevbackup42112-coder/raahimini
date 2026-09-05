"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FixedProductOption, JoinFixedResult } from "./types";

type ApiResponse =
  | { ok: true; value: JoinFixedResult; correlationId: string }
  | { ok: false; code: string; message: string; correlationId: string };

export function JoinFixedCard({ product, signedIn }: { product: FixedProductOption; signedIn: boolean }) {
  const router = useRouter();
  const [seatCount, setSeatCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const total = useMemo(() => seatCount * product.fare_per_seat_inr, [seatCount, product.fare_per_seat_inr]);

  if (!signedIn) {
    const next = encodeURIComponent(`/fixed/${product.product_id}`);
    return <Link href={`/auth/sign-in?next=${next}`} className="mt-6 inline-flex w-full justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">Sign in to join</Link>;
  }

  async function join() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/fixed/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: product.product_id,
          seatCount,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!payload.ok) {
        setMessage(payload.message);
        return;
      }
      router.push(`/fixed/request/${payload.value.request_id}`);
      router.refresh();
    } catch {
      setMessage("The network did not confirm your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl bg-zinc-50 p-5">
      <label htmlFor="seat-count" className="text-sm font-medium text-zinc-800">Seats</label>
      <select id="seat-count" value={seatCount} disabled={busy} onChange={(event) => setSeatCount(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3">
        {Array.from({ length: product.max_seats_per_request }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} {count === 1 ? "seat" : "seats"}</option>)}
      </select>
      <div className="mt-4 flex items-center justify-between gap-4 text-sm">
        <span className="text-zinc-600">₹{product.fare_per_seat_inr} × {seatCount}</span>
        <span className="text-lg font-semibold text-zinc-950">₹{total}</span>
      </div>
      <button type="button" disabled={busy} onClick={() => void join()} className="mt-4 w-full rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "Joining…" : "Join this ride"}
      </button>
      {message ? <p className="mt-3 text-sm text-rose-700" role="status">{message}</p> : null}
      <p className="mt-4 text-xs leading-5 text-zinc-500">Your request stays private while the ride is forming. Driver identity is revealed only after Raahi assigns the ride.</p>
    </div>
  );
}
