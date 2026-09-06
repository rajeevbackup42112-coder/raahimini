import Link from "next/link";
import { notFound } from "next/navigation";
import { OutstationRequestActions } from "@/features/outstation/OutstationRequestActions";
import { PassengerPaymentCard } from "@/features/payment-support/PassengerPaymentCard";
import { ReportIssue } from "@/features/payment-support/ReportIssue";
import { getMyOutstationRequest, getMyOutstationTrip } from "@/server/projections/outstation";

export default async function OutstationRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const [projection, tripProjection] = await Promise.all([
    getMyOutstationRequest(requestId), getMyOutstationTrip(requestId),
  ]);
  if (projection.status === "UNAUTHENTICATED") {
    return <main className="min-h-screen bg-zinc-100 px-5 py-10"><div className="mx-auto max-w-xl rounded-3xl bg-white p-7 shadow-sm"><h1 className="text-3xl font-semibold">Sign in to see this Outstation request</h1><Link href={`/auth/sign-in?next=${encodeURIComponent(`/outstation/request/${requestId}`)}`} className="mt-6 inline-flex rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">Sign in</Link></div></main>;
  }
  if (projection.status === "ERROR") throw new Error("OUTSTATION_REQUEST_FAILED");
  if (projection.status === "NOT_FOUND" || !projection.request) notFound();
  const request = projection.request;
  const trip = tripProjection.status === "READY" ? tripProjection.trip : null;
  const open = request.status === "OPEN" || request.status === "REOPENED";

  return <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950"><div className="mx-auto max-w-2xl">
    <Link href="/" className="text-sm font-semibold text-zinc-600">← Home</Link>
    <section className="mt-8 rounded-3xl bg-white p-7 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">Outstation · {request.status.replaceAll("_", " ")}</p>
      <h1 className="mt-2 text-3xl font-semibold">{request.origin_name} → {request.destination_name}{request.travel_type === "ROUND_TRIP" ? ` → ${request.origin_name}` : ""}</h1>
      <p className="mt-3 text-zinc-600">{request.passenger_count} passenger{request.passenger_count === 1 ? "" : "s"} · {new Date(request.departure_at).toLocaleString()}</p>
      {request.recovery_count > 0 && open ? <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Request reopened</p><p className="mt-1">A previously confirmed Driver cancelled. Old quotes were closed; only newly submitted current quotes appear below.</p></div> : null}      {open ? <div className="mt-7"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Current quotes</p><h2 className="mt-1 text-xl font-semibold">Choose only when a quote suits you</h2></div><span className="text-sm text-zinc-500">{request.quotes.length} current</span></div>
        <div className="mt-4 space-y-4">{request.quotes.map((quote) => <article key={quote.revision_id} className="rounded-2xl border border-zinc-200 p-5">
          <div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{quote.driver_name}</p><p className="mt-1 text-sm text-zinc-600">{quote.vehicle_model} · {quote.vehicle_registration}</p></div><p className="text-xl font-semibold">₹{quote.total_price_inr}</p></div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-zinc-700"><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Driver verified</span>{quote.includes_tolls ? <span className="rounded-full bg-zinc-100 px-3 py-1">Tolls included</span> : null}{quote.includes_parking ? <span className="rounded-full bg-zinc-100 px-3 py-1">Parking included</span> : null}</div>
          {quote.commercial_note ? <p className="mt-3 text-sm text-zinc-600">{quote.commercial_note}</p> : null}
          <p className="mt-3 text-xs text-zinc-500">Quote revision {quote.revision_no} · valid until {new Date(quote.valid_until).toLocaleString()}</p>
          <OutstationRequestActions requestId={request.request_id} revisionId={quote.revision_id} />
        </article>)}</div>
        {request.quotes.length === 0 ? <p className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">No current quotes yet. Eligible Drivers can respond without seeing competitor prices.</p> : null}
        <OutstationRequestActions requestId={request.request_id} />
      </div> : null}      {request.accepted_agreement ? <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Confirmed Driver</p>
        <div className="mt-2 flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{request.accepted_agreement.driver_name}</h2><p className="mt-1 text-sm text-zinc-700">{request.accepted_agreement.vehicle_model} ? {request.accepted_agreement.vehicle_registration}</p></div><p className="text-xl font-semibold">?{request.accepted_agreement.total_price_inr}</p></div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-white px-3 py-1 text-emerald-700">Driving licence verified</span><span className="rounded-full bg-white px-3 py-1 text-emerald-700">Vehicle RC verified</span><span className="rounded-full bg-white px-3 py-1 text-emerald-700">Vehicle photos verified</span></div>
        <p className="mt-4 text-sm text-zinc-700">Raahi shows verification status, not private DL/RC documents.</p>
        {request.accepted_agreement.driver_phone ? <p className="mt-2 text-sm font-semibold">Driver contact: {request.accepted_agreement.driver_phone}</p> : null}
      </div> : null}
      {trip ? <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Trip timeline</p>
        <h2 className="mt-2 text-xl font-semibold">{trip.ride_status.replaceAll("_", " ").toLowerCase()}</h2>
        {trip.ride_status === "WAITING_FOR_RETURN" ? <p className="mt-2 text-sm text-zinc-700">Outbound complete. The same Driver and Vehicle remain committed for the return after {trip.return_not_before ? new Date(trip.return_not_before).toLocaleString() : "the agreed wait"}.</p> : null}
        {trip.payment ? <PassengerPaymentCard payment={{ ...trip.payment, ride_id: trip.ride_id, booking_id: trip.booking_id }} /> : null}
        <ReportIssue objectType="RIDE" objectId={trip.ride_id} />
      </div> : null}
      {request.status === "CANCELLED" ? <p className="mt-6 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">This request is closed.</p> : null}
    </section>
  </div></main>;
}
