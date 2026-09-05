import Link from "next/link";
import { getMobilityOptions, getSearchLocations } from "@/server/projections/passenger-fixed";

export default async function GoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const origin = Array.isArray(params.origin) ? params.origin[0] : params.origin;
  const destination = Array.isArray(params.destination) ? params.destination[0] : params.destination;
  const locations = await getSearchLocations();
  const originName = locations.find((l) => l.location_id === origin)?.name;
  const destinationName = locations.find((l) => l.location_id === destination)?.name;
  const options = origin && destination && origin !== destination ? await getMobilityOptions(origin, destination) : [];
  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950"><div className="mx-auto max-w-2xl">
      <Link href="/" className="text-sm font-semibold text-zinc-600">← Change journey</Link>
      <p className="mt-8 text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">Ways to go</p>
      <h1 className="mt-2 text-3xl font-semibold">{originName && destinationName ? `${originName} → ${destinationName}` : "Choose a valid journey"}</h1>
      <div className="mt-7 space-y-4">
        {options.map((option) => <Link key={option.product_id} href={`/fixed/${option.product_id}`} className="block rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-zinc-500">{option.service_type === "FIXED_ROUND_TRIP" ? "Shared round trip" : "Shared one way"}</p><h2 className="mt-1 text-xl font-semibold">{option.display_name}</h2></div><p className="text-lg font-semibold">₹{option.fare_per_seat_inr}<span className="text-sm font-normal text-zinc-500"> / seat</span></p></div>
          <p className="mt-3 text-sm leading-6 text-zinc-600">{option.public_summary}</p><p className="mt-4 text-sm font-semibold">Up to {option.max_seats_per_request} seats in one request →</p>
        </Link>)}
        {options.length === 0 ? <div className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">No live Raahi option for this journey yet.</h2><p className="mt-2 text-sm text-zinc-600">Try another origin or destination. Raahi will add more ways to travel as each Market grows.</p></div> : null}
      </div>
    </div></main>
  );
}
