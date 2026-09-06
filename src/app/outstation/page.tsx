import Link from "next/link";
import { OutstationRequestForm } from "@/features/outstation/OutstationRequestForm";
import { getSearchLocations } from "@/server/projections/passenger-fixed";
import { getOutstationProductForOrigin } from "@/server/projections/outstation";

export default async function OutstationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const origin = Array.isArray(params.origin) ? params.origin[0] : params.origin;
  const destination = Array.isArray(params.destination) ? params.destination[0] : params.destination;
  const locations = await getSearchLocations();
  const originLocation = locations.find((item) => item.location_id === origin);
  const destinationLocation = locations.find((item) => item.location_id === destination);
  const product = origin ? await getOutstationProductForOrigin(origin) : null;

  if (!origin || !originLocation || !product) {
    return <main className="min-h-screen bg-zinc-100 px-5 py-10"><div className="mx-auto max-w-xl rounded-3xl bg-white p-7 shadow-sm"><h1 className="text-3xl font-semibold">Outstation is not available from this origin yet.</h1><Link href="/" className="mt-6 inline-flex text-sm font-semibold">← Choose another journey</Link></div></main>;
  }
  const destinationText = destinationLocation?.name ?? "Your destination";
  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950"><div className="mx-auto max-w-xl">
      <Link href={destination ? `/go?origin=${origin}&destination=${destination}` : "/"} className="text-sm font-semibold text-zinc-600">← Ways to go</Link>
      <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">Outstation</p>
      <h1 className="mt-2 text-3xl font-semibold">Ask verified Drivers for a private-car quote</h1>
      <p className="mt-3 text-zinc-600">Quotes are private between you and each Driver. Selecting one exact current quote confirms the Driver and Vehicle atomically.</p>
      <div className="mt-7"><OutstationRequestForm product={product} originLocationId={origin} destinationLocationId={destination ?? null} destinationText={destinationText} /></div>
    </div></main>
  );
}