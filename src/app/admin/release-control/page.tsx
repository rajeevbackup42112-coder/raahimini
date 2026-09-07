import Link from "next/link";
import { ReleaseControlWorkspace } from "@/features/release-control/ReleaseControlWorkspace";
import { getReleaseControlWorkspace } from "@/server/projections/release-control";

export default async function ReleaseControlPage() {
  const result = await getReleaseControlWorkspace();
  if (result.status === "UNAUTHENTICATED") return <main className="min-h-screen bg-zinc-100 px-5 py-10"><div className="mx-auto max-w-4xl rounded-3xl bg-white p-7 shadow-sm"><h1 className="text-2xl font-semibold">Release control</h1><p className="mt-2 text-zinc-600">Sign in with an authorized Admin account.</p><Link href="/auth/sign-in" className="mt-5 inline-flex rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">Sign in</Link></div></main>;
  if (result.status === "NOT_ADMIN") return <main className="min-h-screen bg-zinc-100 px-5 py-10"><div className="mx-auto max-w-4xl rounded-3xl bg-white p-7 shadow-sm"><h1 className="text-2xl font-semibold">Admin access required</h1><p className="mt-2 text-zinc-600">Release state is visible only to scoped Raahi Admin accounts.</p></div></main>;
  if (result.status !== "READY" || !result.workspace) return <main className="min-h-screen bg-zinc-100 px-5 py-10"><div className="mx-auto max-w-4xl rounded-3xl bg-white p-7 shadow-sm"><h1 className="text-2xl font-semibold">Release control unavailable</h1><p className="mt-2 text-zinc-600">Raahi could not load Product release state.</p></div></main>;
  return <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap gap-4"><Link href="/admin" className="text-sm font-semibold text-zinc-600">← Admin</Link><Link href="/admin/health" className="text-sm font-semibold text-zinc-600">Operational health</Link></div>
    <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Staging release controls</p>
    <h1 className="mt-2 text-3xl font-semibold">Which Raahi Products may accept new activity?</h1>
    <p className="mt-3 max-w-3xl text-zinc-600">Product lifecycle and canary enablement are separate controls. A switch can stop new entry without rewriting historical state or interrupting existing marketplace work.</p>
    <div className="mt-7"><ReleaseControlWorkspace workspace={result.workspace}/></div>
  </div></main>;
}