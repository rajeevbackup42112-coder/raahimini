import Link from "next/link";
import { DriverOutstationWorkspace } from "@/features/outstation/DriverOutstationWorkspace";
import { OutstationDriverTrips } from "@/features/outstation/OutstationDriverTrips";
import { getDriverOutstationWorkspace, getMyOutstationDriverTrips } from "@/server/projections/outstation";

export default async function DriverOutstationPage() {
  const [projection, tripsProjection] = await Promise.all([
    getDriverOutstationWorkspace(), getMyOutstationDriverTrips(),
  ]);
  if (projection.status === "UNAUTHENTICATED") return <main className="min-h-screen bg-zinc-100 px-5 py-10"><div className="mx-auto max-w-xl rounded-3xl bg-white p-7 shadow-sm"><h1 className="text-3xl font-semibold">Sign in to see Outstation opportunities</h1><Link href="/auth/sign-in?next=/drive/outstation" className="mt-6 inline-flex rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">Sign in</Link></div></main>;
  if (projection.status === "NOT_DRIVER") return <main className="min-h-screen bg-zinc-100 px-5 py-10"><div className="mx-auto max-w-xl rounded-3xl bg-white p-7 shadow-sm"><h1 className="text-3xl font-semibold">Driver setup is required</h1></div></main>;
  if (projection.status !== "READY") throw new Error("OUTSTATION_DRIVER_WORKSPACE_FAILED");
  return <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950"><div className="mx-auto max-w-2xl">
    <Link href="/drive" className="text-sm font-semibold text-zinc-600">← Drive</Link>
    <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">Driver opportunities</p>
    <h1 className="mt-2 text-3xl font-semibold">Outstation</h1>
    <p className="mt-3 text-zinc-600">Choose future availability, quote privately, and let the Passenger decide. Competitor quote amounts are never shown.</p>
    <div className="mt-7 space-y-6"><DriverOutstationWorkspace workspace={projection.workspace} />
      {tripsProjection.status === "READY" ? <OutstationDriverTrips trips={tripsProjection.trips} /> : null}
    </div>
  </div></main>;
}