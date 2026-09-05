import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/20260905131341_slice2_fixed_passenger_demand.sql"), "utf8");
const joinApi = readFileSync(join(root, "src/app/api/fixed/join/route.ts"), "utf8");
const cancelApi = readFileSync(join(root, "src/app/api/fixed/cancel/route.ts"), "utf8");
const home = readFileSync(join(root, "src/app/page.tsx"), "utf8");
const joinUi = readFileSync(join(root, "src/features/passenger-fixed/JoinFixedCard.tsx"), "utf8");

describe("Slice 2 — Fixed Passenger demand", () => {
  it("creates Passenger demand independently of any Ride or Driver", () => {
    expect(migration).toContain("create table public.fixed_passenger_requests");
    expect(migration).not.toContain("trip_id");
    expect(migration).not.toContain("driver_id");
  });

  it("snapshots authoritative Product rules and fare at queue entry", () => {
    expect(migration).toContain("product_rules_version integer not null");
    expect(migration).toContain("fare_per_seat_inr integer not null");
    expect(migration).toContain("current_rules_version");
    expect(migration).toContain("max_seats_per_request");
  });

  it("keeps FIFO time server-owned and blocks duplicate active demand", () => {
    expect(migration).toContain("queued_at timestamptz not null default now()");
    expect(migration).toContain("ux_fixed_request_active_product");
    expect(migration).toContain("ACTIVE_FIXED_REQUEST_EXISTS");
    expect(migration).toContain("for update");
  });

  it("keeps core request rows unavailable to direct browser table mutation", () => {
    expect(migration).toContain("alter table public.fixed_passenger_requests enable row level security");
    expect(migration).toContain("revoke all on public.fixed_passenger_requests from public, anon, authenticated");
  });

  it("routes join and cancellation through canonical RPCs", () => {
    expect(joinApi).toContain('supabase.rpc("join_fixed_queue"');
    expect(cancelApi).toContain('supabase.rpc("cancel_fixed_queue_request"');
    expect(joinApi).not.toContain('.from("fixed_passenger_requests")');
    expect(cancelApi).not.toContain('.from("fixed_passenger_requests")');
  });

  it("allows Passenger origin selection without a GPS dependency", () => {
    expect(home).toContain('name="origin"');
    expect(home).toContain('name="destination"');
    expect(home).not.toContain("geolocation");
  });

  it("keeps Passenger join retry-safe and request-private before assignment", () => {
    expect(migration).toContain("join_fixed_queue");
    expect(migration).toContain("IDEMPOTENCY_CONFLICT");
    expect(migration).toContain("r.passenger_profile_id = auth.uid()");
    expect(joinUi).toContain("Driver identity is revealed only after Raahi assigns the ride");
  });

  it("only permits Passenger cancellation while still queued", () => {
    expect(migration).toContain("elsif v_request.status = 'QUEUED'");
    expect(migration).toContain("FIXED_REQUEST_NOT_CANCELLABLE");
    expect(migration).toContain("PASSENGER_CANCELLED");
  });
});
