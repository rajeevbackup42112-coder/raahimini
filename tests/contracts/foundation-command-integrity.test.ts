import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertValidCommandContext } from "../../src/server/commands/core";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260905094500_foundation_command_integrity.sql",
  ),
  "utf8",
);
const seed = readFileSync(join(process.cwd(), "supabase", "seed.sql"), "utf8");

describe("Raahi Next command and history integrity", () => {
  it("persists a unique idempotency identity for retry-safe commands", () => {
    expect(migration).toContain("create table public.command_idempotency");
    expect(migration).toContain("unique (actor_scope, command_name, idempotency_key)");
    expect(migration).toContain("request_hash");
  });

  it("keeps idempotency records inaccessible to browser table writes", () => {
    expect(migration).toContain("alter table public.command_idempotency enable row level security");
    expect(migration).toContain("revoke all on public.command_idempotency from public, anon, authenticated");
  });
  it("replaces mutable Product rules with immutable version rows", () => {
    expect(migration).toContain("create table public.service_product_rule_versions");
    expect(migration).toContain("SERVICE_PRODUCT_RULE_VERSION_IMMUTABLE");
    expect(migration).toContain("service_products_current_rules_fk");
    expect(migration).toContain("drop table public.service_product_rules");
    expect(seed).toContain("insert into public.service_product_rule_versions");
    expect(seed).toContain("set current_rules_version = 1");
  });

  it("requires selected Vehicles to come from current Driver access", () => {
    expect(migration).toContain("driver_active_vehicle_access_fk");
    expect(migration).toContain("ACTIVE_VEHICLE_REQUIRES_CURRENT_ACCESS");
    expect(migration).toContain("CLEAR_ACTIVE_VEHICLE_BEFORE_REVOKING_ACCESS");
  });

  it("documents profiles.phone as non-authoritative verification data", () => {
    expect(migration).toContain("Verified phone authority comes from trusted Auth/verification state");
  });

  it("validates canonical command actor and idempotency context", () => {
    expect(() =>
      assertValidCommandContext({
        actorKind: "USER",
        actorProfileId: null,
        actorScope: "user:missing",
        idempotencyKey: "retry-key-123",
        correlationId: "corr-1",
      }),
    ).toThrow("USER_COMMAND_REQUIRES_PROFILE");
  });
});
