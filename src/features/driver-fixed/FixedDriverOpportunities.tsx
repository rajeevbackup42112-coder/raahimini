"use client";

import { useState } from "react";
import type {
  AvailabilityApiResponse,
  FixedDriverWorkspace,
  PreferenceApiResponse,
} from "./types";

type Props = { initialWorkspace: FixedDriverWorkspace };

export function FixedDriverOpportunities({ initialWorkspace }: Props) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function updateProduct(productId: string, patch: Record<string, unknown>) {
    setWorkspace((current) => ({
      ...current,
      products: current.products.map((product) =>
        product.product_id === productId ? { ...product, ...patch } : product,
      ),
    }));
  }

  async function setPreference(productId: string, enabled: boolean) {
    const action = `pref:${productId}`;
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch("/api/driver/fixed/preference", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, enabled, idempotencyKey: crypto.randomUUID() }),
      });      const payload = (await response.json()) as PreferenceApiResponse;
      if (!payload.ok) {
        setMessage(payload.message);
        return;
      }
      updateProduct(productId, {
        preference_enabled: payload.value.is_enabled,
        ...(enabled ? {} : { availability_id: null, availability_status: null, availability_queued_at: null }),
      });
      setMessage(enabled ? "Route added to your Driver preferences." : "Route removed from your Driver preferences.");
    } catch {
      setMessage("The network did not confirm this preference. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function joinQueue(productId: string) {
    if (!workspace.active_vehicle_id) return;
    const action = `join:${productId}`;
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch("/api/driver/fixed/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          vehicleId: workspace.active_vehicle_id,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const payload = (await response.json()) as AvailabilityApiResponse;
      if (!payload.ok) {
        setMessage(payload.message);
        return;
      }
      updateProduct(productId, {
        availability_id: payload.value.availability_id,
        availability_status: payload.value.status,
        availability_queued_at: payload.value.queued_at ?? null,
      });
      setMessage("You are now waiting in FIFO for this route.");
    } catch {
      setMessage("The network did not confirm FIFO entry. Try again.");
    } finally {
      setBusy(null);
    }
  }
  async function leaveQueue(productId: string, availabilityId: string) {
    const action = `leave:${productId}`;
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch("/api/driver/fixed/leave", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ availabilityId, idempotencyKey: crypto.randomUUID() }),
      });
      const payload = (await response.json()) as AvailabilityApiResponse;
      if (!payload.ok) {
        setMessage(payload.message);
        return;
      }
      updateProduct(productId, {
        availability_id: null,
        availability_status: null,
        availability_queued_at: null,
      });
      setMessage("You left this FIFO. Your route preference is still saved.");
    } catch {
      setMessage("The network did not confirm leaving FIFO. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!workspace.operating_market_id) {
    return (
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">Fixed routes</p>
        <h2 className="mt-1 text-xl font-semibold">Verify your driving Market first</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">Raahi only shows immediate Fixed opportunities from the Market you have physically verified.</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm font-medium text-zinc-500">Fixed opportunities</p><h2 className="mt-1 text-2xl font-semibold">Demand from your current Market</h2></div>
        {workspace.active_vehicle_name ? <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">{workspace.active_vehicle_name}</span> : null}
      </div>
      <div className="mt-6 space-y-4">
        {workspace.products.map((product) => {
          const queued = product.availability_status === "QUEUED";
          const reserved = product.availability_status === "RESERVED";
          return (
            <article key={product.product_id} className="rounded-2xl border border-zinc-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-500">{product.origin_name} → {product.destination_name}</p>
                  <h3 className="mt-1 text-lg font-semibold">{product.display_name}</h3>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold">{product.queued_seat_count}</p>
                  <p className="text-xs text-zinc-500">queued seat{product.queued_seat_count === 1 ? "" : "s"} · {product.queued_request_count} request{product.queued_request_count === 1 ? "" : "s"}</p>
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Passenger identities stay hidden until Raahi creates a valid match. Demand here is aggregate only.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                {!product.preference_enabled ? (
                  <button type="button" disabled={busy !== null} onClick={() => void setPreference(product.product_id, true)} className="rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    {busy === `pref:${product.product_id}` ? "Saving…" : "Serve this route"}
                  </button>
                ) : queued && product.availability_id ? (
                  <button type="button" disabled={busy !== null} onClick={() => void leaveQueue(product.product_id, product.availability_id!)} className="rounded-2xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                    {busy === `leave:${product.product_id}` ? "Leaving…" : "Leave FIFO"}
                  </button>
                ) : reserved ? (
                  <span className="rounded-2xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">Raahi is checking a match…</span>
                ) : (
                  <>
                    <button type="button" disabled={busy !== null || !workspace.active_vehicle_id} onClick={() => void joinQueue(product.product_id)} className="rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                      {busy === `join:${product.product_id}` ? "Joining…" : "Make me available"}
                    </button>
                    <button type="button" disabled={busy !== null} onClick={() => void setPreference(product.product_id, false)} className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-zinc-600 disabled:opacity-50">Stop serving route</button>
                  </>
                )}
              </div>
              {queued ? <p className="mt-3 text-sm font-medium text-emerald-700">In FIFO since {new Date(product.availability_queued_at!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.</p> : null}
            </article>
          );
        })}
        {workspace.products.length === 0 ? <p className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">No live Fixed routes start from this Market yet.</p> : null}
      </div>
      {message ? <p className="mt-4 text-sm text-zinc-700" role="status">{message}</p> : null}
    </section>
  );
}
