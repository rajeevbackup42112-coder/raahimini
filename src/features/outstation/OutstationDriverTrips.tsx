"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DriverPaymentCard } from "@/features/payment-support/DriverPaymentCard";
import { ReportIssue } from "@/features/payment-support/ReportIssue";
import type { OutstationDriverTrip } from "./types";
import { formatIndiaDateTime } from "./format";

type Action =
  | "BEGIN_APPROACH" | "ARRIVE" | "START_BOARDING" | "BOARDED" | "DEPART"
  | "REACH_DESTINATION" | "START_RETURN_BOARDING" | "RETURN_BOARDED"
  | "RETURN_NO_SHOW" | "DEPART_RETURN" | "COMPLETE_RETURN";
type LocationAction = "ARRIVE" | "COMPLETE_RETURN";
type ApiResponse = { ok: true; value: unknown } | { ok: false; message: string };

export function OutstationDriverTrips({ trips }: { trips: OutstationDriverTrip[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (trips.length === 0) return null;

  async function send(action: Action, trip: OutstationDriverTrip, location?: GeolocationPosition) {
    const key = `${action}:${trip.ride_id}`;
    setBusy(key);
    setMessage(null);
    try {
      const response = await fetch("/api/driver/outstation/fulfilment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action, rideId: trip.ride_id, bookingId: trip.booking_id,
          idempotencyKey: crypto.randomUUID(),          ...(location ? {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracyMeters: Math.max(location.coords.accuracy || 1, 1),
            capturedAt: new Date(location.timestamp).toISOString(),
          } : {}),
        }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!payload.ok) setMessage(payload.message);
      else router.refresh();
    } catch {
      setMessage("The network did not confirm this trip step. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function cancelBeforeStart(trip: OutstationDriverTrip) {
    const key = `CANCEL:${trip.agreement_id}`;
    setBusy(key);
    setMessage(null);
    try {
      const response = await fetch("/api/driver/outstation/cancel-agreement", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ agreementId: trip.agreement_id, idempotencyKey: crypto.randomUUID() }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!payload.ok) setMessage(payload.message); else router.refresh();
    } catch {
      setMessage("The network did not confirm cancellation. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function withLocation(action: LocationAction, trip: OutstationDriverTrip) {
    setMessage(action === "ARRIVE" ? "Checking your pickup-area location…" : "Verifying final return arrival…");
    navigator.geolocation.getCurrentPosition(
      (position) => void send(action, trip, position),
      () => setMessage("Location permission and a fresh GPS reading are required for this trip step."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  function primary(trip: OutstationDriverTrip) {
    if (trip.ride_status === "UPCOMING") return { label: "Start driving to pickup", action: "BEGIN_APPROACH" as const };
    if (trip.ride_status === "DRIVER_EN_ROUTE") return { label: "I've arrived", action: "ARRIVE" as const };
    if (trip.ride_status === "DRIVER_ARRIVED") return { label: "Start boarding", action: "START_BOARDING" as const };
    if (trip.ride_status === "BOARDING" && trip.booking_status === "ASSIGNED") return { label: "Mark Passenger boarded", action: "BOARDED" as const };
    if (trip.ride_status === "READY_TO_DEPART") return { label: "Depart", action: "DEPART" as const };
    if (trip.ride_status === "IN_PROGRESS") return { label: trip.travel_type === "ROUND_TRIP" ? "Reached destination" : "Complete at destination", action: "REACH_DESTINATION" as const };
    if (trip.ride_status === "WAITING_FOR_RETURN") return { label: "Start return boarding", action: "START_RETURN_BOARDING" as const };
    if (trip.ride_status === "RETURN_BOARDING" && trip.return_status === "PENDING") return { label: "Mark return boarded", action: "RETURN_BOARDED" as const };
    if (trip.ride_status === "RETURN_BOARDING") return { label: "Depart return", action: "DEPART_RETURN" as const };
    if (trip.ride_status === "RETURN_IN_PROGRESS") return { label: "Complete return at origin", action: "COMPLETE_RETURN" as const };
    return null;
  }

  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Your Outstation trips</p>
      <h2 className="mt-1 text-xl font-semibold">One shared fulfilment timeline</h2>
      <p className="mt-2 text-sm text-zinc-700">The accepted quote is already binding. Progress the Ride here; payment and support remain separate factual records.</p>
      <div className="mt-5 space-y-4">
        {trips.map((trip) => {
          const action = primary(trip);
          const roundTrip = trip.travel_type === "ROUND_TRIP";
          const payment = trip.payment ? {
            ...trip.payment, ride_id: trip.ride_id, passenger_name: trip.passenger_name,
            origin_name: trip.origin_name, destination_name: trip.destination_name, completed_at: null,
          } : null;
          return (
            <article key={trip.ride_id} className="rounded-2xl bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-sm font-semibold text-zinc-500">{trip.origin_name} → {trip.destination_name}{roundTrip ? ` → ${trip.origin_name}` : ""}</p><h3 className="mt-1 text-lg font-semibold">{trip.vehicle_model} · {trip.vehicle_registration}</h3></div>
                <div className="text-right"><p className="text-lg font-semibold">₹{trip.total_price_inr}</p><p className="text-xs text-zinc-500">{trip.ride_status.replaceAll("_", " ")}</p></div>
              </div>
              <p className="mt-3 text-sm text-zinc-700">Passenger: {trip.passenger_name}{trip.passenger_phone ? ` ? ${trip.passenger_phone}` : ""}</p>
              {roundTrip ? <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">The same Driver and Vehicle stay committed through the agreed wait and return.</p> : null}
              {trip.ride_status === "WAITING_FOR_RETURN" ? <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Return boarding becomes available after {trip.return_not_before ? formatIndiaDateTime(trip.return_not_before) : "the agreed return time"}.</p> : null}
              {action ? <button type="button" disabled={busy !== null} onClick={() => (["ARRIVE", "COMPLETE_RETURN"] as Action[]).includes(action.action) ? withLocation(action.action as LocationAction, trip) : void send(action.action, trip)} className="mt-4 rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === `${action.action}:${trip.ride_id}` ? "Updating…" : action.label}</button> : null}
              {trip.ride_status === "UPCOMING" ? <button type="button" disabled={busy !== null} onClick={() => void cancelBeforeStart(trip)} className="mt-4 ml-2 rounded-2xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-40">Cancel before trip starts</button> : null}
              {trip.ride_status === "RETURN_BOARDING" && trip.return_status === "PENDING" ? <button type="button" disabled={busy !== null} onClick={() => void send("RETURN_NO_SHOW", trip)} className="mt-4 ml-2 rounded-2xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-40">Return no-show</button> : null}
              {payment ? <DriverPaymentCard payment={payment} /> : null}
              <ReportIssue objectType="RIDE" objectId={trip.ride_id} />
            </article>
          );
        })}
      </div>
      {message ? <p className="mt-4 text-sm text-zinc-700" role="status">{message}</p> : null}
    </section>
  );
}
