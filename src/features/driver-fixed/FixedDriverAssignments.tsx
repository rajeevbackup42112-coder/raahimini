"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FixedDriverAssignment } from "./types";

type Action = "ACKNOWLEDGE" | "BEGIN_APPROACH" | "ARRIVE" | "START_BOARDING" | "BOARDED" | "NO_SHOW" | "DEPART" | "COMPLETE";
type ApiResponse = { ok: true; value: unknown } | { ok: false; message: string };

export function FixedDriverAssignments({ assignments }: { assignments: FixedDriverAssignment[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (assignments.length === 0) return null;

  async function send(action: Action, rideId?: string, bookingId?: string, location?: GeolocationPosition) {
    const key = `${action}:${bookingId ?? rideId}`;
    setBusy(key);
    setMessage(null);
    try {
      const response = await fetch("/api/driver/fixed/fulfilment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action, rideId, bookingId,
          idempotencyKey: crypto.randomUUID(),
          ...(location ? {
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
      setMessage("The network did not confirm this ride step. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function locationAction(action: "ARRIVE" | "COMPLETE", rideId: string) {
    setMessage(action === "ARRIVE" ? "Checking your current location…" : "Verifying destination arrival…");
    navigator.geolocation.getCurrentPosition(
      (position) => void send(action, rideId, undefined, position),
      () => setMessage("Location permission and a fresh GPS reading are required for this ride step."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  function primaryAction(ride: FixedDriverAssignment) {
    if (ride.status === "MATCHED") return { label: "Acknowledge ride", action: "ACKNOWLEDGE" as const };
    if (ride.status === "DRIVER_ACKNOWLEDGED") return { label: "Start driving to pickup", action: "BEGIN_APPROACH" as const };
    if (ride.status === "DRIVER_EN_ROUTE") return { label: "I've arrived", action: "ARRIVE" as const };
    if (ride.status === "DRIVER_ARRIVED") return { label: "Start boarding", action: "START_BOARDING" as const };
    if (ride.status === "READY_TO_DEPART") return { label: "Depart", action: "DEPART" as const };
    if (ride.status === "IN_PROGRESS") return { label: "Complete at destination", action: "COMPLETE" as const };
    return null;
  }

  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">Active ride</p>
      <h2 className="mt-1 text-2xl font-semibold text-zinc-950">Proceed with your assigned ride</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-700">Raahi has already matched this ride. There is no commercial accept/reject step after assignment. Each button records one authoritative ride transition.</p>
      <div className="mt-5 space-y-4">
        {assignments.map((ride) => {
          const primary = primaryAction(ride);
          return (
            <article key={ride.ride_id} className="rounded-2xl bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-500">{ride.origin_name} → {ride.destination_name}</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-950">{ride.vehicle_model} · {ride.vehicle_registration}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">{ride.status.replaceAll("_", " ")}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-xs text-zinc-500">Passengers</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-950">{ride.booked_seat_count}/{ride.capacity} seats</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-xs text-zinc-500">Current step</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-950">{ride.status.replaceAll("_", " ")}</p>
                </div>
              </div>

              {primary ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => primary.action === "ARRIVE" || primary.action === "COMPLETE" ? locationAction(primary.action, ride.ride_id) : void send(primary.action, ride.ride_id)}
                  className="mt-4 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === `${primary.action}:${ride.ride_id}` ? "Updating…" : primary.label}
                </button>
              ) : null}

              {ride.status === "READY_TO_DEPART" ? (
                <p className="mt-4 rounded-2xl bg-emerald-100 p-4 text-sm font-semibold text-emerald-900">Boarding is resolved. This ride is ready for departure.</p>
              ) : null}

              <div className="mt-4 rounded-2xl border border-zinc-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Passenger groups</p>
                <ul className="mt-3 space-y-3 text-sm text-zinc-800">
                  {ride.passenger_groups.map((group) => (
                    <li key={group.booking_id} className="rounded-2xl bg-zinc-50 p-3">
                      <div className="flex items-center justify-between gap-4">
                        <span>{group.display_name}</span>
                        <span className="font-semibold">{group.seat_count} {group.seat_count === 1 ? "seat" : "seats"}</span>
                      </div>
                      {ride.status === "BOARDING" && group.status === "ASSIGNED" ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" disabled={busy !== null} onClick={() => void send("BOARDED", ride.ride_id, group.booking_id)} className="rounded-xl bg-zinc-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Mark boarded</button>
                          <button type="button" disabled={busy !== null} onClick={() => void send("NO_SHOW", ride.ride_id, group.booking_id)} className="rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold disabled:opacity-40">No-show</button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs font-medium text-zinc-500">{group.status.replaceAll("_", " ")}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
      {message ? <p className="mt-4 text-sm text-zinc-700" role="status">{message}</p> : null}
    </section>
  );
}
