const foundation = [
  "Capability-based identity",
  "Market / Location / Corridor / Product",
  "Home Market + verified Operating Market",
  "Scoped Admin permissions",
  "Shared Driver / Vehicle commitment guard",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-50">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-400">
          Raahi Next
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Foundation 1
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
          Clean launch-candidate implementation. Consumer experience work begins only after the marketplace foundation passes its database and security gates.
        </p>
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {foundation.map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-200">
              {item}
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-zinc-500">Local runtime: port 4029</p>
      </div>
    </main>
  );
}
