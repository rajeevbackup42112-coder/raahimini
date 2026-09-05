import type { FixedDriverAssignment } from "./types";

export function FixedDriverAssignments({ assignments }: { assignments: FixedDriverAssignment[] }) {
  if (assignments.length === 0) return null;

  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">Ride assigned</p>
      <h2 className="mt-1 text-2xl font-semibold text-zinc-950">Proceed with your assigned ride</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-700">Raahi has already matched this ride. There is no commercial accept/reject step after assignment.</p>
      <div className="mt-5 space-y-4">
        {assignments.map((ride) => (
          <article key={ride.ride_id} className="rounded-2xl bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-zinc-500">{ride.origin_name} → {ride.destination_name}</p>
                <p className="mt-1 text-lg font-semibold text-zinc-950">{ride.vehicle_model} · {ride.vehicle_registration}</p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">{ride.status.replaceAll("_", " ")}</span>
            </div>            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs text-zinc-500">Passengers</p>
                <p className="mt-1 text-lg font-semibold text-zinc-950">{ride.booked_seat_count}/{ride.capacity} seats</p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs text-zinc-500">Acknowledge by</p>
                <p className="mt-1 text-sm font-semibold text-zinc-950">{new Date(ride.driver_ack_deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-zinc-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Passenger groups</p>
              <ul className="mt-2 space-y-2 text-sm text-zinc-800">
                {ride.passenger_groups.map((group, index) => (
                  <li key={`${group.display_name}-${index}`} className="flex justify-between gap-4">
                    <span>{group.display_name}</span><span className="font-semibold">{group.seat_count} {group.seat_count === 1 ? "seat" : "seats"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
