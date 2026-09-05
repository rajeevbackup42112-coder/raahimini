import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("supabase/migrations/20260905160704_slice6_execution_schema.sql", "utf8");
const transitions = readFileSync("supabase/migrations/20260905160903_slice6_execution_transitions.sql", "utf8");
const history = readFileSync("supabase/migrations/20260905161855_slice6_driver_history_projection.sql", "utf8");
const api = readFileSync("src/app/api/driver/fixed/fulfilment/route.ts", "utf8");
const driverUi = readFileSync("src/features/driver-fixed/FixedDriverAssignments.tsx", "utf8");
const passengerPage = readFileSync("src/app/fixed/request/[requestId]/page.tsx", "utf8");

describe("Slice 6 — Fixed execution, completion and history", () => {
  it("snapshots destination completion proof in Product rule version 5", () => {
    expect(schema).toContain("'completion_zone_code', 'DHANBAD_CORE'");
    expect(schema).toContain("select p.id, 5,");
    expect(schema).toContain("set current_rules_version=5");
  });

  it("permits departure only from READY_TO_DEPART", () => {
    expect(transitions).toContain("v_ride.status<>'READY_TO_DEPART'");
    expect(transitions).toContain("status='IN_PROGRESS'");
    expect(transitions).toContain("'RIDE_DEPARTED'");
  });

  it("requires verified destination GPS before completion", () => {
    expect(transitions).toContain("COMPLETION_LOCATION_NOT_VERIFIED");
    expect(transitions).toContain("completion_max_location_age_seconds");
    expect(transitions).toContain("completion_max_accuracy_meters");
    expect(transitions).toContain("private.distance_meters");
  });

  it("completes Ride, boarded bookings and shared Commitment atomically", () => {
    expect(transitions).toContain("set status='COMPLETED', completed_at=now()");
    expect(transitions).toContain("update public.ride_bookings set status='COMPLETED'");
    expect(transitions).toContain("update public.mobility_commitments set status='COMPLETED'");
    expect(transitions).toContain("'RIDE_COMPLETED'");
  });

  it("keeps exact destination coordinates out of Ride history", () => {
    expect(schema).toContain("completion_zone_id uuid");
    expect(schema).toContain("completion_accuracy_meters");
    expect(schema).not.toContain("completion_latitude");
    expect(schema).not.toContain("completion_longitude");
  });

  it("exposes completed Driver history only through an authenticated projection", () => {
    expect(history).toContain("get_my_fixed_history");
    expect(history).toContain("dr.profile_id=auth.uid()");
    expect(history).toContain("where r.status='COMPLETED'");
    expect(history).toContain("grant execute on function public.get_my_fixed_history() to authenticated");
  });

  it("routes depart and complete through canonical RPC-backed commands", () => {
    expect(api).toContain('"DEPART"');
    expect(api).toContain('"COMPLETE"');
    expect(api).toContain('"driver_depart_fixed_ride"');
    expect(api).toContain('"driver_complete_fixed_ride"');
    expect(api).toContain("Fresh GPS evidence is required");
  });

  it("uses fresh location for completion and never mutates Ride tables from UI", () => {
    expect(driverUi).toContain('label: "Complete at destination"');
    expect(driverUi).toContain('locationAction(primary.action as LocationAction, ride.ride_id)');
    expect(driverUi).not.toContain(".from(\"rides\")");
  });

  it("shows completion as Ride state while preserving Passenger request ownership", () => {
    expect(passengerPage).toContain('request.ride_status === "COMPLETED"');
    expect(passengerPage).toContain('"Ride completed"');
    expect(passengerPage).toContain("The Ride remains part of your factual history");
  });
});
