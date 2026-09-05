"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DriveContext, SetOperatingMarketInput, SetOperatingMarketResult } from "./types";

type Props = { initialContext: DriveContext; lockedByCommitment?: boolean };

type PendingAttempt = SetOperatingMarketInput & { marketName: string };

type ApiResponse =
  | { ok: true; value: SetOperatingMarketResult; correlationId: string }
  | { ok: false; code: string; message: string; correlationId: string };

function locationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return "Location permission is needed to verify where you are driving from.";
  if (error.code === error.TIMEOUT) return "Location verification timed out. Try again where GPS is clearer.";
  return "We could not read your current location. Please try again.";
}

export function OperatingMarketCard({ initialContext, lockedByCommitment = false }: Props) {
  const router = useRouter();
  const [context, setContext] = useState(initialContext);
  const [selectedMarketId, setSelectedMarketId] = useState(
    initialContext.operating_market?.market_id ?? initialContext.available_markets[0]?.market_id ?? "",
  );
  const [pending, setPending] = useState<PendingAttempt | null>(null);
  const [status, setStatus] = useState<"IDLE" | "LOCATING" | "SAVING" | "SUCCESS" | "ERROR">("IDLE");
  const [message, setMessage] = useState<string | null>(null);

  const selectedMarket = useMemo(
    () => context.available_markets.find((market) => market.market_id === selectedMarketId) ?? null,
    [context.available_markets, selectedMarketId],
  );

  async function submitAttempt(attempt: PendingAttempt) {
    setStatus("SAVING");
    setMessage("Verifying your Market…");
    try {
      const response = await fetch("/api/driver/operating-market", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(attempt),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!payload.ok) {
        setStatus("ERROR");
        setMessage(payload.message);
        return;
      }

      setContext((current) => ({
        ...current,
        operating_market: {
          market_id: payload.value.market_id,
          market_name: payload.value.market_name,
          verified_at: payload.value.verified_at,
          verification_method: payload.value.verification_method,
          verification_accuracy_meters: attempt.accuracyMeters,
        },
      }));
      setPending(null);
      setStatus("SUCCESS");
      setMessage(`Driving from ${payload.value.market_name}. Location verified.`);
      router.refresh();
    } catch {
      setStatus("ERROR");
      setMessage("The network did not confirm the change. Retry to safely reuse the same request.");
    }
  }
  function verifySelectedMarket() {
    if (!selectedMarket) return;
    setMessage(null);
    setStatus("LOCATING");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const attempt: PendingAttempt = {
          marketId: selectedMarket.market_id,
          marketName: selectedMarket.market_name,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: Math.max(position.coords.accuracy || 1, 1),
          capturedAt: new Date(position.timestamp).toISOString(),
          idempotencyKey: crypto.randomUUID(),
        };
        setPending(attempt);
        void submitAttempt(attempt);
      },
      (error) => {
        setStatus("ERROR");
        setMessage(locationErrorMessage(error));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  const busy = status === "LOCATING" || status === "SAVING" || lockedByCommitment;

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">Current driving Market</p>
          <h2 className="mt-1 text-2xl font-semibold text-zinc-950">
            {context.operating_market ? `Driving from ${context.operating_market.market_name}` : "Choose where you're driving from"}
          </h2>
        </div>
        {context.operating_market ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Verified</span>
        ) : null}
      </div>

      <p className="mt-3 text-sm leading-6 text-zinc-600">
        Home Market: <span className="font-medium text-zinc-900">{context.home_market.market_name}</span>. Your Home Market stays the same when you drive from another Market.
      </p>

      <label className="mt-6 block text-sm font-medium text-zinc-800" htmlFor="operating-market">
        Drive from
      </label>
      <select
        id="operating-market"
        value={selectedMarketId}
        disabled={busy}
        onChange={(event) => {
          setSelectedMarketId(event.target.value);
          setPending(null);
          setMessage(null);
          setStatus("IDLE");
        }}
        className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-zinc-950 outline-none focus:border-zinc-950"
      >
        {context.available_markets.map((market) => (
          <option key={market.market_id} value={market.market_id}>
            {market.market_name}{market.status === "PREPARING" ? " — preparing" : ""}
          </option>
        ))}
      </select>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || !selectedMarket}
          onClick={verifySelectedMarket}
          className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "LOCATING" ? "Getting location…" : status === "SAVING" ? "Verifying…" : `Verify ${selectedMarket?.market_name ?? "Market"}`}
        </button>
        {status === "ERROR" && pending ? (
          <button
            type="button"
            onClick={() => void submitAttempt(pending)}
            className="rounded-2xl border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-900"
          >
            Retry same request
          </button>
        ) : null}
      </div>

      {message ? (
        <p
          className={`mt-4 text-sm ${status === "ERROR" ? "text-rose-700" : status === "SUCCESS" ? "text-emerald-700" : "text-zinc-600"}`}
          role="status"
        >
          {message}
        </p>
      ) : null}

      {lockedByCommitment ? <p className="mt-4 text-sm font-medium text-amber-700">Your current ride keeps this driving Market locked until the commitment is resolved.</p> : null}
      <div className="mt-6 rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
        Raahi checks your current GPS only to verify this Market. Exact coordinates are not kept in your Operating Market record.
        Choosing a Market does not make you available for any route or trip automatically.
      </div>
    </section>
  );
}
