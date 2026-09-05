import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelFixedRequest } from "@/features/passenger-fixed/CancelFixedRequest";
import { PassengerPaymentCard } from "@/features/payment-support/PassengerPaymentCard";
import { ReportIssue } from "@/features/payment-support/ReportIssue";
import { getMyFixedRequest } from "@/server/projections/passenger-fixed";
import { getMyFixedPayment } from "@/server/projections/payment-support";

function TrustBadge({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ok ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>{label}</span>;
}

export default async function FixedRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const projection = await getMyFixedRequest(requestId);
  if (projection.status === "UNAUTHENTICATED") {
    return <main className="min-h-screen bg-zinc-100 px-5 py-10"><div className="mx-auto max-w-xl rounded-3xl bg-white p-7 shadow-sm"><h1 className="text-3xl font-semibold">Sign in to see this request</h1><Link href={`/auth/sign-in?next=${encodeURIComponent(`/fixed/request/${requestId}`)}`} className="mt-6 inline-flex rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">Sign in</Link></div></main>;
  }
  if (projection.status === "NOT_FOUND" || !projection.request) notFound();
  const request = projection.request;
  const paymentProjection = await getMyFixedPayment(requestId);
  const payment = paymentProjection.status === "READY" ? paymentProjection.payment : null;
  const forming = request.status === "QUEUED" || request.status === "RESERVED";
  const assigned = request.status === "ASSIGNED" && request.ride_id;
  const completed = assigned && request.ride_status === "COMPLETED";
  const roundTrip = request.service_type === "FIXED_ROUND_TRIP";

  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950"><div className="mx-auto max-w-xl">
      <Link href="/" className="text-sm font-semibold text-zinc-600">← Home</Link>
      <section className="mt-8 rounded-3xl bg-white p-7 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">{forming ? "Ride forming" : completed ? "Ride completed" : assigned ? "Ride assigned" : request.status === "PASSENGER_CANCELLED" ? "Request cancelled" : "Ride request"}</p>
        <h1 className="mt-2 text-3xl font-semibold">{request.service_type === "FIXED_ROUND_TRIP" ? `${request.origin_name} → ${request.destination_name} → ${request.origin_name}` : `${request.origin_name} → ${request.destination_name}`}</h1>        <p className="mt-3 text-zinc-600">{forming ? "Raahi is gathering compatible Passenger demand and eligible Driver supply. No Driver identity is shown before assignment." : completed ? "This journey has been completed. The Ride remains part of your factual history." : assigned ? `Raahi has assigned a verified Driver and Vehicle to your ride. Current step: ${(request.ride_status ?? "MATCHED").replaceAll("_", " ").toLowerCase()}.` : request.status === "PASSENGER_CANCELLED" ? "This request is closed. You can search and join again whenever you need." : "Your request has moved to its next fulfilment state."}</p>
        {roundTrip && request.ride_status === "WAITING_FOR_RETURN" ? <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Outbound complete · Driver and Vehicle remain reserved</p><p className="mt-1">Return boarding can begin after {request.return_not_before ? new Date(request.return_not_before).toLocaleString() : "the configured wait"}.</p></div> : null}
        {roundTrip && request.ride_status === "RETURN_BOARDING" ? <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Return boarding</p><p className="mt-1">Your return attendance: {(request.return_status ?? "PENDING").replaceAll("_", " ").toLowerCase()}.</p></div> : null}
        {roundTrip && request.ride_status === "RETURN_IN_PROGRESS" ? <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">Returning to {request.origin_name}</p><p className="mt-1">The same Driver and Vehicle are completing your Round Trip.</p></div> : null}
        <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xs text-zinc-500">Seats</p><p className="mt-1 text-xl font-semibold">{request.seat_count}</p></div><div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xs text-zinc-500">Total fare</p><p className="mt-1 text-xl font-semibold">₹{request.total_fare_inr}</p></div></div>
        {assigned ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Your Driver</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-950">{request.driver_name}</h2>
            <p className="mt-1 text-sm text-zinc-700">{request.vehicle_model} · {request.vehicle_registration}</p>
            {request.trust ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <TrustBadge ok={request.trust.driver_verified} label="Driving licence verified" />
                <TrustBadge ok={request.trust.vehicle_rc_verified} label="Vehicle RC verified" />
                <TrustBadge ok={request.trust.vehicle_photos_verified} label="Vehicle photos verified" />
              </div>
            ) : null}
            <p className="mt-4 text-xs leading-5 text-zinc-600">Raahi shows verification status, not private DL/RC documents. Exact pickup/contact details can be revealed only when fulfilment requires them.</p>
          </div>
        ) : null}
        {request.ride_status === "COMPLETED" && payment ? <PassengerPaymentCard payment={payment} /> : null}
        {request.ride_id ? <ReportIssue objectType="RIDE" objectId={request.ride_id} /> : null}
        {forming ? <CancelFixedRequest requestId={request.request_id} /> : request.status === "PASSENGER_CANCELLED" ? <Link href="/" className="mt-6 inline-flex rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">Find another ride</Link> : null}
      </section>
    </div></main>
  );
}
