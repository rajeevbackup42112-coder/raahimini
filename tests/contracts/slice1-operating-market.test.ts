import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const zones = readFileSync(join(root, "supabase/migrations/20260905110311_slice1_market_presence_zones.sql"), "utf8");
const command = readFileSync(join(root, "supabase/migrations/20260905110348_slice1_driver_operating_market_command.sql"), "utf8");
const boundary = readFileSync(join(root, "supabase/migrations/20260905111236_slice1_rpc_security_boundary.sql"), "utf8");
const api = readFileSync(join(root, "src/app/api/driver/operating-market/route.ts"), "utf8");
const ui = readFileSync(join(root, "src/features/drive/OperatingMarketCard.tsx"), "utf8");

describe("Slice 1 — Driver Operating Market", () => {
  it("keeps physical verification configurable by Market rather than hard-coded branches", () => {
    expect(zones).toContain("create table public.market_presence_zones");
    expect(zones).toContain("radius_meters");
    expect(zones).toContain("max_location_age_seconds");
  });

  it("stores verification zone and accuracy, not exact Driver coordinates, in Operating Market state", () => {
    expect(zones).toContain("add column verification_zone_id");
    expect(command).toContain("verification_accuracy_meters");
    expect(command).not.toContain("insert into public.driver_operating_markets(\n    driver_id, market_id, latitude");
  });

  it("serializes idempotency before time-sensitive GPS validation", () => {
    expect(command.indexOf("insert into public.command_idempotency")).toBeLessThan(command.indexOf("LOCATION_NOT_VERIFIED"));
    expect(command).toContain("on conflict (actor_scope, command_name, idempotency_key) do nothing");
    expect(command).toContain("if v_existing.status = 'SUCCEEDED'");
  });

  it("blocks an Operating Market switch that conflicts with active Driver work", () => {
    expect(command).toContain("ACTIVE_COMMITMENT_CONFLICT");
    expect(command).toContain("c.status in ('RESERVED','ACTIVE')");
  });
  it("keeps privileged implementations private and exposes invoker-only public wrappers", () => {
    expect(boundary).toContain("alter function public.driver_set_operating_market");
    expect(boundary).toContain("set schema private");
    expect(boundary).toContain("security invoker");
    expect(boundary).not.toContain("security definer");
  });

  it("routes the browser action through the canonical RPC instead of direct table writes", () => {
    expect(api).toContain('supabase.rpc("driver_set_operating_market"');
    expect(api).not.toContain('.from("driver_operating_markets")');
  });

  it("uses fresh high-accuracy GPS and preserves the same attempt for uncertain network retries", () => {
    expect(ui).toContain("enableHighAccuracy: true");
    expect(ui).toContain("maximumAge: 0");
    expect(ui).toContain("Retry same request");
    expect(ui).toContain("submitAttempt(pending)");
  });
});
