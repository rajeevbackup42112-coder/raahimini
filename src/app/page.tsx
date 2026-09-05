import Link from "next/link";
import { getSearchLocations } from "@/server/projections/passenger-fixed";

export default async function Home() {
  const locations = await getSearchLocations();
  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Raahi</p>
          <Link href="/drive" className="text-sm font-semibold text-zinc-700">Drive with Raahi</Link>
        </div>
        <section className="mt-10 rounded-3xl bg-white p-7 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Where are you going?</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Find a way from here.</h1>
          <p className="mt-3 text-zinc-600">Choose the journey you want to start. You do not need to be physically at the origin just to search.</p>
          <form action="/go" className="mt-7 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">From<select name="origin" required className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3"><option value="">Choose origin</option>{locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.name}</option>)}</select></label>
            <label className="text-sm font-medium">To<select name="destination" required className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3"><option value="">Choose destination</option>{locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.name}</option>)}</select></label>
            <button className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white sm:col-span-2">See ways to go</button>
          </form>
        </section>
      </div>
    </main>
  );
}
