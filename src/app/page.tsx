import Link from "next/link";

const milestones = [
  { label: "Foundation", status: "Complete" },
  { label: "Driver Operating Market", status: "Implemented" },
  { label: "Passenger Fixed demand", status: "Next" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-50">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-400">Raahi Next</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Implementation workspace</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
          Clean launch-candidate build. Foundation is proven; vertical mobility slices now move end to end through canonical commands.
        </p>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {milestones.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-zinc-300">{item.label}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{item.status}</p>
            </div>
          ))}
        </div>
        <Link href="/drive" className="mt-8 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950">
          Open Driver workspace
        </Link>
        <p className="mt-10 text-sm text-zinc-500">Local runtime: port 4029</p>
      </div>
    </main>
  );
}
