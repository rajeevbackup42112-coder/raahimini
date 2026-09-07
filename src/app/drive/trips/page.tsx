import Link from "next/link";
import { DriverTripWorkspace } from "@/features/trips/DriverTripWorkspace";
import { getDriverTripWorkspace } from "@/server/projections/trips";

export default async function DriverTripsPage(){
 const projection=await getDriverTripWorkspace();
 if(projection.status==="UNAUTHENTICATED")return <main className="min-h-screen bg-zinc-100 px-5 py-10"><div className="mx-auto max-w-xl rounded-3xl bg-white p-8"><h1 className="text-2xl font-semibold">Sign in to create Raahi Trips</h1><Link href="/auth/sign-in?next=/drive/trips" className="mt-5 inline-flex rounded-xl bg-zinc-950 px-4 py-2 text-white">Sign in</Link></div></main>;
 if(projection.status==="NOT_DRIVER")return <main className="min-h-screen bg-zinc-100 px-5 py-10"><div className="mx-auto max-w-xl rounded-3xl bg-white p-8"><h1 className="text-2xl font-semibold">Driver setup is required</h1></div></main>;
 if(projection.status!=="READY"||!projection.workspace)throw new Error("TRIP_DRIVER_WORKSPACE_FAILED");
 return <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950"><div className="mx-auto max-w-3xl"><Link href="/drive" className="text-sm font-semibold text-zinc-600">← Drive</Link><p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Raahi Trips · Driver</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Create a shared day journey</h1><p className="mt-3 max-w-2xl text-zinc-600">Plan transport, destination wait and return. Bookings remain Filling until the minimum confirmation threshold is reached.</p><div className="mt-8"><DriverTripWorkspace workspace={projection.workspace}/></div></div></main>;
}
