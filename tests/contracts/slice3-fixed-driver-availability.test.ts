import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/20260905135055_slice3_fixed_driver_availability.sql"), "utf8");
const guard = readFileSync(join(root, "supabase/migrations/20260905142044_slice3_market_lifecycle_guard.sql"), "utf8");
const fixture = readFileSync(join(root, "supabase/migrations/20260905134058_dev_test_driver_supply_fixture.sql"), "utf8");
const preferenceApi = readFileSync(join(root, "src/app/api/driver/fixed/preference/route.ts"), "utf8");
const joinApi = readFileSync(join(root, "src/app/api/driver/fixed/join/route.ts"), "utf8");
const leaveApi = readFileSync(join(root, "src/app/api/driver/fixed/leave/route.ts"), "utf8");
const ui = readFileSync(join(root, "src/features/driver-fixed/FixedDriverOpportunities.tsx"), "utf8");

describe("Slice 3 — Fixed Driver availability", () => {
  it("separates persistent Product preference from live FIFO availability", () => {
    expect(migration).toContain("set_driver_product_preference");
    expect(migration).toContain("join_fixed_driver_queue");
    expect(ui).toContain("Serve this route");
    expect(ui).toContain("Make me available");
  });

  it("keeps FIFO position and time server-owned and duplicate-safe", () => {
    expect(migration).toContain("queued_at timestamptz not null default now()");
    expect(migration).toContain("ux_driver_availability_active_product");
    expect(migration).toContain("ACTIVE_DRIVER_AVAILABILITY_EXISTS");
    expect(migration).toContain("IDEMPOTENCY_CONFLICT");
  });

  it("requires the Driver's verified Operating Market to equal the Product origin Market", () => {
    expect(migration).toContain("OPERATING_MARKET_REQUIRED");
    expect(migration).toContain("OPERATING_MARKET_MISMATCH");
    expect(migration).toContain("v_operating.market_id <> v_product.market_id");
  });

  it("requires active Vehicle access plus current Driver and Vehicle trust", () => {
    expect(migration).toContain("ACTIVE_ELIGIBLE_VEHICLE_REQUIRED");
    expect(migration).toContain("DRIVER_VERIFICATION_REQUIRED");
    expect(migration).toContain("VEHICLE_VERIFICATION_REQUIRED");
    expect(migration).toContain("('PHONE'),('DRIVING_LICENCE'),('DRIVER_PHOTO')");
    expect(migration).toContain("('VEHICLE_RC'),('VEHICLE_PHOTOS')");
  });

  it("blocks cross-service conflicts before FIFO entry", () => {
    expect(migration).toContain("ACTIVE_COMMITMENT_CONFLICT");
    expect(migration).toContain("c.status in ('RESERVED','ACTIVE')");
    expect(migration).toContain("c.driver_id = v_driver.id or c.vehicle_id = p_vehicle_id");
  });

  it("withdraws incompatible uncommitted FIFO when Operating Market changes", () => {
    expect(migration).toContain("withdraw_incompatible_driver_availability");
    expect(migration).toContain("OPERATING_MARKET_CHANGED");
    expect(migration).toContain("a.status = 'QUEUED'");
  });

  it("rechecks Market lifecycle at the database boundary", () => {
    expect(guard).toContain("fixed_product_market_is_live");
    expect(guard).toContain("m.status in ('PILOT','ACTIVE','SCALING')");
    expect(guard).toContain("before insert or update of product_id, operating_market_id");
  });

  it("keeps Passenger demand aggregate-only in the Driver projection", () => {
    expect(migration).toContain("queued_request_count");
    expect(migration).toContain("queued_seat_count");
    expect(migration).not.toContain("passenger_profile_id', r.passenger_profile_id");
    expect(ui).toContain("Passenger identities stay hidden until Raahi creates a valid match");
  });

  it("keeps core availability rows unavailable to direct browser mutation", () => {
    expect(migration).toContain("alter table public.driver_availability enable row level security");
    expect(migration).toContain("driver_availability_no_direct_client_access");
    expect(migration).toContain("revoke all on public.driver_availability from public, anon, authenticated");
  });

  it("routes preference, join, and leave through canonical RPCs", () => {
    expect(preferenceApi).toContain('supabase.rpc("set_driver_product_preference"');
    expect(joinApi).toContain('supabase.rpc("join_fixed_driver_queue"');
    expect(leaveApi).toContain('supabase.rpc("leave_fixed_driver_queue"');
    expect(preferenceApi + joinApi + leaveApi).not.toContain('.from("driver_availability")');
  });

  it("keeps synthetic eligible Vehicle/trust provisioning service-role-only", () => {
    expect(fixture).toContain("TEST_IDENTITY_REQUIRED");
    expect(fixture).toContain("grant execute on function public.dev_provision_test_driver_fixture(uuid) to service_role");
    expect(fixture).toContain("Raahi Test Car");
    expect(fixture).not.toContain("grant execute on function public.dev_provision_test_driver_fixture(uuid) to authenticated");
  });
});
