import Link from "next/link";
import { OperatingMarketCard } from "@/features/drive/OperatingMarketCard";
import { FixedDriverAssignments } from "@/features/driver-fixed/FixedDriverAssignments";
import { FixedDriverOpportunities } from "@/features/driver-fixed/FixedDriverOpportunities";
import { getDriveContext } from "@/server/projections/drive-context";
import { getFixedDriverAssignments } from "@/server/projections/fixed-driver-assignments";
import { getFixedDriverWorkspace } from "@/server/projections/fixed-driver-workspace";

export default async function DrivePage() {
  const projection = await getDriveContext();
  if (projection.status === "UNAUTHENTICATED") {
    return <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950"><div className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-sm"><p className="text-sm font-medium text-zinc-500">Driver</p><h1 className="mt-2 text-3xl font-semibold">Sign in to drive with Raahi</h1><p className="mt-3 text-zinc-600">Your Driver workspace is tied to your verified Raahi account.</p><Link href="/auth/sign-in?next=/drive" className="mt-6 inline-flex rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">Sign in</Link></div></main>;
  }
  if (projection.status === "NOT_DRIVER") {
    return <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950"><div className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-sm"><p className="text-sm font-medium text-zinc-500">Driver</p><h1 className="mt-2 text-3xl font-semibold">Driver setup is required</h1><p className="mt-3 text-zinc-600">This account does not yet have an active Driver profile. Passenger access is unaffected.</p></div></main>;
  }

  const [fixedProjection, assignmentProjection] = await Promise.all([
    getFixedDriverWorkspace(),
    getFixedDriverAssignments(),
  ]);

  const activeAssignments = assignmentProjection.status === "READY" ? assignmentProjection.assignments : [];
  const hasActiveAssignment = activeAssignments.length > 0;

  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-4"><p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">Raahi Driver</p><Link href="/drive/history" className="text-sm font-semibold text-zinc-600">History</Link></div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Drive</h1>
        <p className="mt-3 max-w-xl text-zinc-600">Choose where you are operating, then explicitly choose which mobility products you want to serve.</p>
        {assignmentProjection.status === "READY" ? (
          <div className="mt-8"><FixedDriverAssignments assignments={activeAssignments} /></div>
        ) : null}
        <div className="mt-8"><OperatingMarketCard initialContext={projection.context} lockedByCommitment={hasActiveAssignment} /></div>
        <div className="mt-6">
          {hasActiveAssignment ? (
            <section className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-sm font-medium text-zinc-900">Finish your assigned ride before joining another Fixed FIFO.</p></section>
          ) : fixedProjection.status === "READY" ? (
            <FixedDriverOpportunities
              key={`${fixedProjection.workspace.operating_market_id ?? "none"}:${fixedProjection.workspace.products.map((product) => `${product.product_id}:${product.preference_enabled}:${product.availability_status ?? "none"}`).join("|")}`}
              initialWorkspace={fixedProjection.workspace}
            />
          ) : (
            <section className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-sm text-zinc-600">Fixed opportunities are temporarily unavailable.</p></section>
          )}
        </div>
      </div>
    </main>
  );
}
