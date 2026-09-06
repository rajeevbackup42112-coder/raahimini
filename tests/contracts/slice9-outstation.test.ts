import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root = process.cwd();
const schema = readFileSync(`${root}/supabase/migrations/20260905185000_slice9_outstation_schema.sql`, "utf8");
const requests = readFileSync(`${root}/supabase/migrations/20260905185608_slice9_outstation_request_commands.sql`, "utf8");
const quotes = readFileSync(`${root}/supabase/migrations/20260905190328_slice9_outstation_quote_commands.sql`, "utf8");
const bridge = readFileSync(`${root}/supabase/migrations/20260905190758_slice9_shared_ride_bridge.sql`, "utf8");
const acceptance = readFileSync(`${root}/supabase/migrations/20260905191142_slice9_outstation_acceptance.sql`, "utf8");
const recovery = readFileSync(`${root}/supabase/migrations/20260906001043_slice9_outstation_recovery.sql`, "utf8");
const fulfilment = readFileSync(`${root}/supabase/migrations/20260906002616_slice9_outstation_fulfilment.sql`, "utf8");
const tripProjection = readFileSync(`${root}/supabase/migrations/20260906003350_slice9_outstation_trip_payment_projections.sql`, "utf8");
const projectionHardening = readFileSync(`${root}/supabase/migrations/20260906011236_slice9_outstation_projection_hardening.sql`, "utf8");
const requestApi = readFileSync(`${root}/src/app/api/outstation/accept/route.ts`, "utf8");
const fulfilmentApi = readFileSync(`${root}/src/app/api/driver/outstation/fulfilment/route.ts`, "utf8");
const cancelApi = readFileSync(`${root}/src/app/api/driver/outstation/cancel-agreement/route.ts`, "utf8");
const passengerUi = readFileSync(`${root}/src/app/outstation/request/[requestId]/page.tsx`, "utf8");
const driverUi = readFileSync(`${root}/src/features/outstation/OutstationDriverTrips.tsx`, "utf8");

describe("Slice 9 — Outstation", () => {
  it("models Passenger demand, immutable quotes and accepted agreements separately", () => {
    expect(schema).toContain("create table public.outstation_requests");
    expect(schema).toContain("create table public.outstation_quotes");
    expect(schema).toContain("create table public.outstation_quote_revisions");
    expect(schema).toContain("create table public.outstation_agreements");
    expect(schema).toContain("OUTSTATION_QUOTE_REVISION_IMMUTABLE");
  });
  it("keeps request creation retry-safe and Passenger-owned", () => {
    expect(requests).toContain("private.claim_user_command");
    expect(requests).toContain("IDEMPOTENCY_CONFLICT");
    expect(requests).toContain("passenger_profile_id=v_profile");
  });

  it("resolves Driver eligibility from preference, market availability, verification and commitments", () => {
    expect(quotes).toContain("private.outstation_driver_eligible");
    expect(quotes).toContain("driver_product_preferences");
    expect(quotes).toContain("driver_planned_market_availability");
    expect(quotes).toContain("mobility_commitments");
    expect(quotes).toContain("verification_records");
  });

  it("preserves quote history by appending numbered revisions", () => {
    expect(quotes).toContain("v_revision_no:=v_quote.current_revision_no+1");
    expect(quotes).toContain("insert into public.outstation_quote_revisions");
    expect(quotes).toContain("current_revision_no=v_revision_no");
  });

  it("accepts only one exact current revision under a request lock", () => {
    expect(acceptance).toContain("for update");
    expect(acceptance).toContain("OUTSTATION_QUOTE_REVISION_STALE");
    expect(acceptance).toContain("v_quote.current_revision_no<>v_rev.revision_no");
    expect(schema).toContain("outstation_one_active_agreement_per_request");
  });
  it("creates the accepted Outstation job on the shared commitment Ride and Booking kernel", () => {
    expect(acceptance).toContain("insert into public.mobility_commitments");
    expect(acceptance).toContain("insert into public.rides");
    expect(acceptance).toContain("insert into public.ride_bookings");
    expect(acceptance).toContain("'WHOLE_CAR'");
    expect(acceptance).not.toContain("create table public.outstation_rides");
  });

  it("uses the accepted whole-car amount as the eventual direct-payment obligation", () => {
    expect(bridge).toContain("v_amount_inr:=coalesce(new.quoted_total_inr,new.seat_count*new.fare_per_seat_inr)");
    expect(bridge).toContain("insert into public.payment_acknowledgements");
    expect(bridge).toContain("'DUE'");
  });

  it("reopens only an UPCOMING Driver-cancelled request and never revives old quotes", () => {
    expect(recovery).toContain("v_ride.status<>'UPCOMING'");
    expect(recovery).toContain("OUTSTATION_ALREADY_IN_FULFILMENT");
    expect(recovery).toContain("status='REOPENED'");
    expect(recovery).toContain("set status='CLOSED'");
    expect(recovery).toContain("recovery_count=recovery_count+1");
  });

  it("keeps Round Trip commitment active at the destination and releases only after final return", () => {
    expect(fulfilment).toContain("status='WAITING_FOR_RETURN'");
    expect(fulfilment).toContain("return_not_before=v_req.return_at");
    expect(fulfilment).toContain("driver_complete_outstation_return");
    expect(fulfilment).toContain("update public.mobility_commitments set status='COMPLETED'");
  });
  it("keeps Outstation fulfilment behind authenticated canonical RPCs", () => {
    expect(fulfilmentApi).toContain("driver_begin_outstation_approach");
    expect(fulfilmentApi).toContain("driver_arrive_outstation_ride");
    expect(fulfilmentApi).toContain("driver_reach_outstation_destination");
    expect(fulfilmentApi).toContain("driver_complete_outstation_return");
    expect(fulfilmentApi).not.toContain(".from(");
  });

  it("uses the refined current cancellation RPC without the superseded reason-code overload", () => {
    expect(cancelApi).toContain("driver_cancel_outstation_agreement");
    expect(cancelApi).toContain("p_agreement_id");
    expect(cancelApi).toContain("p_idempotency_key");
    expect(cancelApi).not.toContain("p_reason_code");
  });

  it("never accepts a quote by mutating Outstation tables in the route handler", () => {
    expect(requestApi).toContain("accept_outstation_quote");
    expect(requestApi).not.toContain(".from(");
  });

  it("restores committed trust/contact without exposing raw verification documents", () => {
    expect(projectionHardening).toContain("'accepted_agreement'");
    expect(projectionHardening).toContain("'driver_phone'");
    expect(projectionHardening).toContain("'vehicle_rc_verified'");
    expect(projectionHardening).toContain("'vehicle_photos_verified'");
    expect(projectionHardening).not.toContain("document_url");
    expect(projectionHardening).not.toContain("storage_path");
  });
  it("projects Outstation payment independently of Fixed route joins", () => {
    expect(tripProjection).toContain("get_my_outstation_trip");
    expect(projectionHardening).toContain("left join public.payment_acknowledgements pay on pay.ride_booking_id=b.id");
    expect(projectionHardening).toContain("'payment'");
  });

  it("shows Passenger payment/support separately from the Ride lifecycle", () => {
    expect(passengerUi).toContain("PassengerPaymentCard");
    expect(passengerUi).toContain("ReportIssue");
    expect(passengerUi).toContain("Trip timeline");
  });

  it("gives the Driver one state-driven Outstation timeline and only pre-start cancellation", () => {
    expect(driverUi).toContain("One shared fulfilment timeline");
    expect(driverUi).toContain('trip.ride_status === "UPCOMING"');
    expect(driverUi).toContain("Cancel before trip starts");
    expect(driverUi).toContain("ReportIssue");
    expect(driverUi).toContain("DriverPaymentCard");
  });
});
