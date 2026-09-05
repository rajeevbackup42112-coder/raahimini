import Link from "next/link";
import { getFixedDriverHistory } from "@/server/projections/fixed-driver-history";

export default async function DriverHistoryPage() {
  const projection = await getFixedDriverHistory();
  if (projection.status === "UNAUTHENTICATED") {
    return <main className="min-h-screen bg-zinc-100 px-5 py-10"><div className="mx-auto max-w-xl rounded-3xl bg-white p-7 shadow-sm"><h1 className="text-3xl font-semibold">Sign in to see Driver history</h1><Link href="/auth/sign-in?next=/drive/history" className="mt-6 inline-flex rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">Sign in</Link></div></main>;
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950">
      <div className="mx-auto max-w-2xl">
        <Link href="/drive" className="text-sm font-semibold text-zinc-600">← Drive</Link>
        <p className="mt-8 text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">Raahi Driver</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">History</h1>
        <p className="mt-3 text-zinc-600">Completed Fixed journeys are factual history and are not rewritten by later configuration changes.</p>
        {projection.status === "READY" && projection.rides.length > 0 ? (
          <div className="mt-8 space-y-4">
            {projection.rides.map((ride) => (
              <article key={ride.ride_id} className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><p className="text-sm font-semibold text-zinc-500">{ride.origin_name} → {ride.destination_name}</p><h2 className="mt-1 text-xl font-semibold">{ride.vehicle_model} · {ride.vehicle_registration}</h2></div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Completed</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xs text-zinc-500">Completed</p><p className="mt-1 text-sm font-semibold">{new Date(ride.completed_at).toLocaleString()}</p></div>
                  <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xs text-zinc-500">Passengers</p><p className="mt-1 text-sm font-semibold">{ride.booked_seat_count}/{ride.capacity} seats</p></div>
                </div>
                {ride.completion_zone ? <p className="mt-4 text-xs text-zinc-500">Completion verified in {ride.completion_zone}. Exact GPS coordinates are not retained in this history.</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm"><p className="text-sm text-zinc-600">No completed Fixed journeys yet.</p></section>
        )}
      </div>
    </main>
  );
}
