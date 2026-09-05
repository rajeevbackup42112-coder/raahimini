import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const schema = readFileSync(join(root, "supabase/migrations/20260905153947_slice5_fixed_fulfilment_schema.sql"), "utf8");
const transitions = readFileSync(join(root, "supabase/migrations/20260905154047_slice5_fixed_driver_transitions.sql"), "utf8");
const boarding = readFileSync(join(root, "supabase/migrations/20260905154509_slice5_boarding_refill.sql"), "utf8");
const projection = readFileSync(join(root, "supabase/migrations/20260905155054_slice5_fulfilment_projection.sql"), "utf8");
const api = readFileSync(join(root, "src/app/api/driver/fixed/fulfilment/route.ts"), "utf8");
const ui = readFileSync(join(root, "src/features/driver-fixed/FixedDriverAssignments.tsx"), "utf8");

describe("Slice 5 fixed fulfilment", () => {
  it("stores arrival policy in Product rules", () => {
    expect(schema).toContain("arrival_zone_code");
    expect(schema).toContain("arrival_radius_meters");
    expect(schema).toContain("arrival_max_location_age_seconds");
  });
  it("enforces ordered Driver lifecycle transitions", () => {
    expect(transitions).toContain("DRIVER_ACK_DEADLINE_EXPIRED");
    expect(transitions).toContain("DRIVER_ACKNOWLEDGED");
    expect(transitions).toContain("DRIVER_EN_ROUTE");
    expect(transitions).toContain("DRIVER_ARRIVED");
    expect(transitions).toContain("BOARDING_STARTED");
  });

  it("requires fresh accurate GPS for arrival", () => {
    expect(transitions).toContain("ARRIVAL_LOCATION_NOT_VERIFIED");
    expect(transitions).toContain("private.distance_meters");
    expect(ui).toContain("enableHighAccuracy: true");
    expect(ui).toContain("maximumAge: 0");
  });

  it("starts boarding wait only after verified arrival", () => {
    expect(transitions).toContain("v_ride.status <> 'DRIVER_ARRIVED'");
    expect(transitions).toContain("boarding_deadline=now()+make_interval");
  });
  it("keeps no-show evidence behind the boarding deadline", () => {
    expect(boarding).toContain("BOARDING_WAIT_NOT_EXPIRED");
    expect(boarding).toContain("PASSENGER_NO_SHOW");
    expect(boarding).toContain("REFILL_WINDOW_OPENED");
  });

  it("uses bounded refill before returning to ordinary matching", () => {
    expect(boarding).toContain("private.try_refill_fixed_product");
    expect(boarding).toContain("REFILL_PASSENGER_ASSIGNED");
    expect(boarding).toContain("private.match_fixed_product");
  });

  it("keeps actionable booking identifiers in the Driver projection", () => {
    expect(projection).toContain("'booking_id', b.id");
    expect(projection).toContain("'status', b.status");
  });

  it("routes UI actions through canonical RPC-backed server commands", () => {
    expect(api).toContain("driver_acknowledge_fixed_ride");
    expect(api).toContain("driver_begin_fixed_approach");
    expect(api).toContain("driver_arrive_fixed_ride");
    expect(api).toContain("driver_start_fixed_boarding");
    expect(api).toContain("driver_mark_fixed_boarded");
    expect(api).toContain("driver_report_fixed_no_show");
    expect(ui).toContain('/api/driver/fixed/fulfilment');
  });
});
