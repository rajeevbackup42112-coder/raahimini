import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const schema = readFileSync(join(root, "supabase/migrations/20260905144347_slice4_fixed_match_schema.sql"), "utf8");
const matcher = readFileSync(join(root, "supabase/migrations/20260905144447_slice4_fixed_match_engine.sql"), "utf8");
const trust = readFileSync(join(root, "supabase/migrations/20260905144936_slice4_fixed_trust_projections.sql"), "utf8");
const triggers = readFileSync(join(root, "supabase/migrations/20260905145309_slice4_auto_match_triggers.sql"), "utf8");
const passengerPage = readFileSync(join(root, "src/app/fixed/request/[requestId]/page.tsx"), "utf8");
const driverAssignments = readFileSync(join(root, "src/features/driver-fixed/FixedDriverAssignments.tsx"), "utf8");
const drivePage = readFileSync(join(root, "src/app/drive/page.tsx"), "utf8");

describe("Slice 4 — Fixed matching and trust reveal", () => {
  it("creates Ride, Booking and immutable event records behind denied client table access", () => {
    expect(schema).toContain("create table public.rides");
    expect(schema).toContain("create table public.ride_bookings");
    expect(schema).toContain("create table public.ride_events");
    expect(schema).toContain("rides_no_direct_client_access");
    expect(schema).toContain("ride_bookings_no_direct_client_access");
  });
  it("keeps matching system-owned, serialized per Product and retry-safe", () => {
    expect(matcher).toContain("grant execute on function public.match_fixed_product(uuid, text) to service_role");
    expect(matcher).toContain("pg_advisory_xact_lock");
    expect(matcher).toContain("for update skip locked");
    expect(matcher).toContain("command_name = 'match_fixed_product'");
    expect(matcher).toContain("IDEMPOTENCY_CONFLICT");
  });

  it("rechecks Driver, Vehicle, Market, preference, verification and commitment eligibility before matching", () => {
    expect(matcher).toContain("fixed_driver_match_eligible");
    expect(matcher).toContain("d.standing = 'ACTIVE'");
    expect(matcher).toContain("pref.is_enabled");
    expect(matcher).toContain("v.status = 'ELIGIBLE'");
    expect(matcher).toContain("DRIVING_LICENCE");
    expect(matcher).toContain("VEHICLE_RC");
    expect(matcher).toContain("mobility_commitments");
  });

  it("implements full-capacity exact batching without splitting Passenger requests", () => {
    expect(matcher).toContain("capacity_policy");
    expect(matcher).toContain("FULL_CAPACITY");
    expect(matcher).toContain("where c.total_seats = v_capacity");
    expect(matcher).toContain("array[o.id]::uuid[]");
    expect(matcher).toContain("c.ids || o.id");
  });
  it("records deterministic starvation protection when an older incompatible request is skipped", () => {
    expect(schema).toContain("match_skip_count");
    expect(matcher).toContain("last_skipped_at");
    expect(matcher).toContain("match_skip_count = least(r.match_skip_count + 1");
    expect(matcher).toContain("order by r.match_skip_count desc, r.queued_at");
  });

  it("acquires the shared commitment in the same atomic match transaction", () => {
    expect(matcher).toContain("insert into public.mobility_commitments");
    expect(matcher).toContain("'FIXED_RIDE', v_ride_id");
    expect(matcher).toContain("update public.rides set commitment_id = v_commitment_id");
  });

  it("automatically invokes only the canonical matcher when Passenger or Driver liquidity changes", () => {
    expect(triggers).toContain("perform private.match_fixed_product(new.product_id, v_key)");
    expect(triggers).toContain("auto_match_fixed_passenger_request");
    expect(triggers).toContain("auto_match_fixed_driver_availability");
    expect(triggers).not.toContain("insert into public.rides");
  });

  it("reveals Driver and Vehicle trust only through the assigned Passenger projection", () => {
    expect(trust).toContain("r.passenger_profile_id = auth.uid()");
    expect(trust).toContain("driver_name");
    expect(trust).toContain("vehicle_registration");
    expect(trust).toContain("driver_verified");
    expect(trust).toContain("vehicle_rc_verified");
    expect(passengerPage).toContain("Driving licence verified");
    expect(passengerPage).toContain("not private DL/RC documents");
  });
  it("shows the assigned Passenger groups to the matched Driver without a commercial accept/reject step", () => {
    expect(trust).toContain("passenger_groups");
    expect(driverAssignments).toContain("Proceed with your assigned ride");
    expect(driverAssignments).toContain("There is no commercial accept/reject step after assignment");
    expect(driverAssignments).not.toContain("Reject ride");
  });

  it("locks new Driver supply and Market switching in the UI while a Ride commitment is active", () => {
    expect(drivePage).toContain("lockedByCommitment={hasActiveAssignment}");
    expect(drivePage).toContain("Finish your assigned ride before joining another Fixed FIFO");
  });

  it("snapshots Product rules and fare on the Ride rather than reinterpreting history later", () => {
    expect(schema).toContain("product_rules_version integer not null");
    expect(schema).toContain("fare_per_seat_inr integer not null");
    expect(schema).toContain("references public.service_product_rule_versions(product_id, version_no)");
  });

  it("does not expose pre-match Passenger identity through Driver liquidity views", () => {
    expect(trust).toContain("where b.ride_id = ride.id");
    expect(trust).not.toContain("queued_passenger_names");
  });
});
