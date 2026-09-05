import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrations = join(process.cwd(), "supabase", "migrations");
const identity = readFileSync(
  join(migrations, "20260905103622_foundation_identity_markets_products.sql"),
  "utf8",
);
const supply = readFileSync(
  join(migrations, "20260905103649_foundation_driver_supply_context.sql"),
  "utf8",
);
const commitments = readFileSync(
  join(migrations, "20260905103716_foundation_admin_commitments.sql"),
  "utf8",
);
const seed = readFileSync(join(process.cwd(), "supabase", "seed.sql"), "utf8");

describe("Raahi Next clean-schema contract", () => {
  it("uses capabilities rather than an exclusive profile role", () => {
    expect(identity).toContain("create table public.account_capabilities");
    expect(identity).not.toMatch(/profiles[\s\S]{0,500}\brole\b/i);
  });

  it("models Market â†’ Location â†’ Corridor â†’ Service Product", () => {
    expect(identity).toContain("create table public.markets");
    expect(identity).toContain("create table public.locations");
    expect(identity).toContain("create table public.corridors");
    expect(identity).toContain("create table public.service_products");
  });

  it("separates Home Market from verified Operating Market", () => {
    expect(supply).toContain("home_market_id");
    expect(supply).toContain("create table public.driver_operating_markets");
    expect(supply).toContain("verification_method");
  });

  it("keeps product rules out of the public catalog grant", () => {
    expect(identity).toContain("revoke all on public.service_product_rules");
    expect(identity).not.toContain("grant select on public.service_product_rules to anon");
  });

  it("enforces shared Driver and Vehicle commitment overlap guards", () => {
    expect(commitments).toContain("mobility_commitments_no_driver_overlap");
    expect(commitments).toContain("mobility_commitments_no_vehicle_overlap");
    expect(commitments.match(/exclude using gist/g)?.length).toBe(2);
  });

  it("models Admin authority as permission plus scope", () => {
    expect(commitments).toContain("create table public.admin_scope_assignments");
    expect(commitments).toContain("scope_type");
    expect(commitments).toContain("private.has_admin_permission");
  });

  it("seeds Gomoh as pilot and Dhanbad as prepared, not falsely live", () => {
    expect(seed).toContain("('GOMOH', 'gomoh', 'Gomoh', 'JH', 'IN', 'PILOT')");
    expect(seed).toContain("('DHANBAD', 'dhanbad', 'Dhanbad', 'JH', 'IN', 'PREPARING')");
    expect(seed).toContain("'DHANBAD_GOMOH_FIXED_OW'");
    expect(seed).toContain("'DRAFT'");
  });
});
