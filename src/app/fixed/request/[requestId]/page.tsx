import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelFixedRequest } from "@/features/passenger-fixed/CancelFixedRequest";
import { getMyFixedRequest } from "@/server/projections/passenger-fixed";

export default async function FixedRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const projection = await getMyFixedRequest(requestId);
  if (projection.status === "UNAUTHENTICATED") {
    return <main className="min-h-screen bg-zinc-100 px-5 py-10"><div className="mx-auto max-w-xl rounded-3xl bg-white p-7 shadow-sm"><h1 className="text-3xl font-semibold">Sign in to see this request</h1><Link href={`/auth/sign-in?next=${encodeURIComponent(`/fixed/request/${requestId}`)}`} className="mt-6 inline-flex rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">Sign in</Link></div></main>;
  }
  if (projection.status === "NOT_FOUND" || !projection.request) notFound();
  const request = projection.request;
  const forming = request.status === "QUEUED" || request.status === "RESERVED";
  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950"><div className="mx-auto max-w-xl">
      <Link href="/" className="text-sm font-semibold text-zinc-600">← Home</Link>
      <section className="mt-8 rounded-3xl bg-white p-7 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">{forming ? "Ride forming" : request.status === "PASSENGER_CANCELLED" ? "Request cancelled" : "Ride request"}</p>
        <h1 className="mt-2 text-3xl font-semibold">{request.origin_name} → {request.destination_name}</h1>
        <p className="mt-3 text-zinc-600">{forming ? "Raahi is gathering compatible Passenger demand and eligible Driver supply. No Driver identity is shown before assignment." : request.status === "PASSENGER_CANCELLED" ? "This request is closed. You can search and join again whenever you need." : "Your request has moved to its next fulfilment state."}</p>
        <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xs text-zinc-500">Seats</p><p className="mt-1 text-xl font-semibold">{request.seat_count}</p></div><div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xs text-zinc-500">Total fare</p><p className="mt-1 text-xl font-semibold">₹{request.total_fare_inr}</p></div></div>
        {forming ? <CancelFixedRequest requestId={request.request_id} /> : <Link href="/" className="mt-6 inline-flex rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">Find another ride</Link>}
      </section>
    </div></main>
  );
}
