import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrations = join(process.cwd(), "supabase", "migrations");
const hardening = readFileSync(
  join(migrations, "20260905104010_foundation_advisor_hardening.sql"),
  "utf8",
);

describe("Raahi Next advisor hardening", () => {
  it("keeps server-only Foundation tables explicitly closed to clients", () => {
    expect(hardening).toContain("audit_events_internal_locked");
    expect(hardening).toContain("command_idempotency_internal_locked");
    expect(hardening).toContain("market_feature_flags_internal_locked");
    expect(hardening).toContain("rule_versions_internal_locked");
  });

  it("adds covering indexes for operational foreign keys", () => {
    expect(hardening).toContain("idx_admin_scope_assignments_market");
    expect(hardening).toContain("idx_mobility_commitments_product");
    expect(hardening).toContain("idx_driver_vehicle_access_vehicle");
    expect(hardening).toContain("idx_verification_records_reviewed_by");
  });
});
