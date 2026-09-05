import Link from "next/link";
import { OperatingMarketCard } from "@/features/drive/OperatingMarketCard";
import { getDriveContext } from "@/server/projections/drive-context";

export default async function DrivePage() {
  const projection = await getDriveContext();

  if (projection.status === "UNAUTHENTICATED") {
    return (
      <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Driver</p>
          <h1 className="mt-2 text-3xl font-semibold">Sign in to drive with Raahi</h1>
          <p className="mt-3 text-zinc-600">Your Driver workspace is tied to your verified Raahi account.</p>
          <Link href="/auth/sign-in?next=/drive" className="mt-6 inline-flex rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (projection.status === "NOT_DRIVER") {
    return (
      <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Driver</p>
          <h1 className="mt-2 text-3xl font-semibold">Driver setup is required</h1>
          <p className="mt-3 text-zinc-600">This account does not yet have an active Driver profile. Passenger access is unaffected.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">Raahi Driver</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Drive</h1>
        <p className="mt-3 max-w-xl text-zinc-600">Choose the Market you are genuinely operating from now. Opportunities come later, only after you opt in.</p>
        <div className="mt-8">
          <OperatingMarketCard initialContext={projection.context} />
        </div>
      </div>
    </main>
  );
}
