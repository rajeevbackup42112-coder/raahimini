import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root = process.cwd();
const kernel = readFileSync(`${root}/supabase/migrations/20260905172133_slice8_round_trip_kernel.sql`, "utf8");
const state = readFileSync(`${root}/supabase/migrations/20260905172327_slice8_round_trip_state.sql`, "utf8");
const depart = readFileSync(`${root}/supabase/migrations/20260905173101_slice8_round_trip_departure_helpers.sql`, "utf8");
const outbound = readFileSync(`${root}/supabase/migrations/20260905173142_slice8_round_trip_outbound_wait.sql`, "utf8");
const attendance = readFileSync(`${root}/supabase/migrations/20260905173218_slice8_round_trip_return_attendance.sql`, "utf8");
const completion = readFileSync(`${root}/supabase/migrations/20260905173300_slice8_round_trip_return_completion.sql`, "utf8");
const projections = readFileSync(`${root}/supabase/migrations/20260905174048_slice8_round_trip_projections.sql`, "utf8");
const arrivalRules = readFileSync(`${root}/supabase/migrations/20260905174337_slice8_round_trip_arrival_rules.sql`, "utf8");
const paymentFix = readFileSync(`${root}/supabase/migrations/20260905174547_slice8_payment_trigger_fix.sql`, "utf8");
const labels = readFileSync(`${root}/supabase/migrations/20260905174834_slice8_service_type_projection_labels.sql`, "utf8");
const api = readFileSync(`${root}/src/app/api/driver/fixed/fulfilment/route.ts`, "utf8");
const driverUi = readFileSync(`${root}/src/features/driver-fixed/FixedDriverAssignments.tsx`, "utf8");
const requestUi = readFileSync(`${root}/src/app/fixed/request/[requestId]/page.tsx`, "utf8");
const goUi = readFileSync(`${root}/src/app/go/page.tsx`, "utf8");

describe("Slice 8 — Fixed Round Trip", () => {
  it("adds Round Trip as a Service Product on the existing Fixed corridor", () => {
    expect(kernel).toContain("'GOMOH_DHANBAD_FIXED_RT'");
    expect(kernel).toContain("'FIXED_ROUND_TRIP'");
    expect(kernel).not.toContain("create table public.round_trip");
  });
  it("reuses the same Passenger FIFO, Driver FIFO and matcher kernel", () => {
    expect(kernel).toContain("private.join_fixed_queue");
    expect(kernel).toContain("private.join_fixed_driver_queue");
    expect(kernel).toContain("private.match_fixed_product");
    expect(kernel).toContain("FIXED_KERNEL_PREDICATE_NOT_FOUND");
    expect(kernel).toContain("FIXED_ROUND_TRIP");
  });

  it("stores return lifecycle on the same Ride and Booking", () => {
    expect(state).toContain("'WAITING_FOR_RETURN'");
    expect(state).toContain("'RETURN_BOARDING'");
    expect(state).toContain("'RETURN_IN_PROGRESS'");
    expect(state).toContain("add column return_status");
    expect(state).toContain("'PENDING','BOARDED','NO_SHOW'");
  });

  it("keeps One Way departure behavior while Round Trip starts its outbound leg", () => {
    expect(depart).toContain("when v_service_type='FIXED_ROUND_TRIP' then 'OUTBOUND_IN_PROGRESS'");
    expect(depart).toContain("else 'IN_PROGRESS'");
    expect(depart).toContain("update public.mobility_commitments set status='ACTIVE'");
  });

  it("requires configured location proof before outbound completion", () => {
    expect(outbound).toContain("private.verify_fixed_rule_zone");
    expect(outbound).toContain("'outbound_completion'");
    expect(outbound).toContain("status='WAITING_FOR_RETURN'");
  });
  it("cannot start return boarding before the configured wait finishes", () => {
    expect(outbound).toContain("now()<v_ride.return_not_before");
    expect(outbound).toContain("RETURN_WAIT_NOT_FINISHED");
    expect(outbound).toContain("return_boarding_deadline");
  });

  it("tracks return attendance separately from the commercial Booking", () => {
    expect(attendance).toContain("driver_mark_fixed_return_boarded");
    expect(attendance).toContain("driver_report_fixed_return_no_show");
    expect(attendance).toContain("return_status='BOARDED'");
    expect(attendance).toContain("return_status='NO_SHOW'");
  });

  it("blocks return departure until every returning Passenger is resolved", () => {
    expect(completion).toContain("RETURN_MANIFEST_UNRESOLVED");
    expect(completion).toContain("b.return_status='PENDING'");
    expect(completion).toContain("status='RETURN_IN_PROGRESS'");
  });

  it("completes only after return-origin proof and then releases the shared commitment", () => {
    expect(completion).toContain("'return_completion'");
    expect(completion).toContain("status='COMPLETED',completed_at=now(),return_completed_at=now()");
    expect(completion).toContain("update public.mobility_commitments set status='COMPLETED'");
  });

  it("versions normal pickup-arrival proof instead of mutating historical rules", () => {
    expect(arrivalRules).toContain("select p.id,2");
    expect(arrivalRules).toContain("'arrival_zone_code','GOMOH_CORE'");
    expect(arrivalRules).toContain("current_rules_version=2");
  });

  it("creates payment from authoritative seat quantity and fare only after final completion", () => {
    expect(paymentFix).toContain("new.seat_count * new.fare_per_seat_inr");
    expect(paymentFix).toContain("new.status<>'COMPLETED'");
    expect(completion.indexOf("update public.ride_bookings set status='COMPLETED'")).toBeGreaterThan(-1);
  });

  it("exposes only scoped Round Trip state through projections", () => {
    expect(projections).toContain("'return_not_before'");
    expect(projections).toContain("'return_status'");
    expect(projections).toContain("prod.service_type");
    expect(labels).toContain("FIXED_SERVICE_TYPE_PROJECTION_ANCHOR_NOT_FOUND");
    expect(labels).toContain("p.service_type");
  });

  it("routes every return mutation through the canonical fulfilment API/RPC boundary", () => {
    expect(api).toContain('"COMPLETE_OUTBOUND"');
    expect(api).toContain('"START_RETURN_BOARDING"');
    expect(api).toContain('"RETURN_BOARDED"');
    expect(api).toContain('"DEPART_RETURN"');
    expect(api).toContain('"COMPLETE_RETURN"');
    expect(api).not.toContain(".from(");
  });

  it("makes Round Trip visible without creating a parallel Passenger navigation flow", () => {
    expect(goUi).toContain("Shared round trip");
    expect(goUi).toContain("/fixed/${option.product_id}");
    expect(requestUi).toContain("request.origin_name");
    expect(requestUi).toContain("request.destination_name");
    expect(requestUi).toContain("FIXED_ROUND_TRIP");
  });

  it("tells the Driver the same Driver and Vehicle remain committed through return", () => {
    expect(driverUi).toContain("same Driver and Vehicle remain committed");
    expect(driverUi).toContain("Depart outbound");
    expect(driverUi).toContain("Start return boarding");
    expect(driverUi).toContain("Complete return in Gomoh");
  });
});
