"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReleaseControlWorkspace as Workspace } from "./types";

type ApiResult = { ok?: boolean; message?: string };

export function ReleaseControlWorkspace({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function setSwitch(productId: string, enabled: boolean) {
    const reason = (reasons[productId] ?? "").trim();
    if (reason.length < 4) { setMessage("Add a short reason before changing a release switch."); return; }
    setBusy(productId); setMessage(null);
    try {
      const response = await fetch("/api/admin/release-control/switch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, enabled, reason, idempotencyKey: crypto.randomUUID() }),
      });
      const result = await response.json() as ApiResult;
      if (!response.ok) { setMessage(result.message ?? "Release switch change failed."); return; }
      setReasons(current => ({ ...current, [productId]: "" }));
      setMessage(enabled ? "Product enabled for new entry." : "Product disabled for new entry. Existing work remains intact.");
      router.refresh();
    } finally { setBusy(null); }
  }
  return <div className="space-y-7">
    {!workspace.can_manage ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">You can inspect release state for your Admin scope. Only Global Admin can enable or disable Products.</div> : null}
    {message ? <div className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white">{message}</div> : null}
    {workspace.markets.map(market => <section key={market.market_id} className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">{market.market_code} · {market.market_status}</p><h2 className="mt-1 text-2xl font-semibold">{market.market_name}</h2></div>
        <p className="max-w-lg text-sm text-zinc-600">Switches gate new Product entry in this Market. They do not cancel queues, requests, bookings, Rides or commitments already in progress.</p>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {market.products.map(product => <article key={product.product_id} className="rounded-2xl border border-zinc-200 p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{product.service_type.replaceAll("_", " ")}</p><h3 className="mt-1 font-semibold">{product.display_name}</h3><p className="mt-1 text-xs text-zinc-500">{product.product_code}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${product.effective_available ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-700"}`}>{product.effective_available ? "AVAILABLE" : "NOT AVAILABLE"}</span></div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><State label="Lifecycle" value={product.lifecycle_status}/><State label="Canary switch" value={product.feature_enabled ? "ENABLED" : "DISABLED"}/></div>
          {product.updated_at ? <p className="mt-3 text-xs text-zinc-500">Last switch update {new Date(product.updated_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}{product.updated_by ? ` · ${product.updated_by}` : ""}</p> : null}
          {workspace.can_manage ? <div className="mt-4 space-y-2"><input value={reasons[product.product_id] ?? ""} onChange={e => setReasons(current => ({ ...current, [product.product_id]: e.target.value }))} placeholder="Reason for this release change" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"/><button disabled={busy === product.product_id} onClick={() => setSwitch(product.product_id, !product.feature_enabled)} className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === product.product_id ? "Saving..." : product.feature_enabled ? "Disable new entry" : "Enable new entry"}</button></div> : null}
        </article>)}
      </div>
    </section>)}
  </div>;
}

function State({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-zinc-50 p-3"><p className="text-xs uppercase tracking-[0.1em] text-zinc-500">{label}</p><p className="mt-1 font-semibold">{value.replaceAll("_", " ")}</p></div>;
}