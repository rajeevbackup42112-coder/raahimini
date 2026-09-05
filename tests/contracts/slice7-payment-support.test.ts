import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root = process.cwd();
const schema = readFileSync(`${root}/supabase/migrations/20260905163624_slice7_payment_support_schema.sql`, "utf8");
const commands = readFileSync(`${root}/supabase/migrations/20260905164237_slice7_payment_support_commands.sql`, "utf8");
const projections = readFileSync(`${root}/supabase/migrations/20260905164641_slice7_payment_support_projections.sql`, "utf8");
const paymentApi = readFileSync(`${root}/src/app/api/payments/fixed/route.ts`, "utf8");
const supportApi = readFileSync(`${root}/src/app/api/support/report/route.ts`, "utf8");
const passengerUi = readFileSync(`${root}/src/features/payment-support/PassengerPaymentCard.tsx`, "utf8");
const driverUi = readFileSync(`${root}/src/features/payment-support/DriverPaymentCard.tsx`, "utf8");

describe("Slice 7 — direct payment acknowledgements and support", () => {
  it("keeps payment and support as separate denied-client tables", () => {
    expect(schema).toContain("create table public.payment_acknowledgements");
    expect(schema).toContain("create table public.cases");
    expect(schema).toContain("payments_no_direct_client_access");
    expect(schema).toContain("cases_no_direct_client_access");
  });

  it("creates DUE only when a Booking becomes completed", () => {
    expect(schema).toContain("new.status<>'COMPLETED'");
    expect(schema).toContain("'DUE'");
    expect(schema).toContain("ride_booking_payment_due");
  });
  it("allows only the owning Passenger to mark payment paid", () => {
    expect(commands).toContain("p.passenger_profile_id=auth.uid()");
    expect(commands).toContain("status='PASSENGER_MARKED_PAID'");
  });

  it("allows Driver confirmation only after the Passenger declaration", () => {
    expect(commands).toContain("v_payment.status<>'PASSENGER_MARKED_PAID'");
    expect(commands).toContain("status='DRIVER_CONFIRMED_RECEIVED'");
  });

  it("creates a Case when a payment is disputed without changing Ride state", () => {
    expect(commands).toContain("'PAYMENT_PROBLEM'");
    expect(commands).toContain("status='PAYMENT_DISPUTED'");
    expect(commands).not.toContain("update public.rides set status");
  });

  it("generic support creates only a Case for a participant-owned object", () => {
    expect(commands).toContain("private.can_report_case_object");
    expect(commands).toContain("insert into public.cases");
    expect(commands).not.toContain("delete from public.rides");
  });

  it("uses invoker public wrappers around restricted private functions", () => {
    expect(commands).toContain("security invoker");
    expect(commands).toContain("grant execute on function private.passenger_mark_payment_paid");
    expect(commands).toContain("grant execute on function private.report_issue");
  });
  it("keeps payment and Case reads scoped through projections", () => {
    expect(projections).toContain("q.passenger_profile_id=auth.uid()");
    expect(projections).toContain("where p.driver_id=v_driver_id");
    expect(projections).toContain("c.reporter_profile_id=auth.uid()");
  });

  it("routes all payment and support mutations through RPC-backed APIs", () => {
    expect(paymentApi).toContain("supabase.rpc");
    expect(supportApi).toContain('supabase.rpc("report_issue"');
    expect(paymentApi).not.toContain(".from(");
    expect(supportApi).not.toContain(".from(");
  });

  it("never claims Raahi processed the direct payment", () => {
    expect(passengerUi).toContain("does not hold or process this money");
    expect(driverUi).toContain("records declarations only");
  });
});