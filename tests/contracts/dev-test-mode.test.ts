import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isTestModeAllowed } from "../../src/server/test-mode/access";

const root = process.cwd();
const bootstrap = readFileSync(
  join(root, "supabase/migrations/20260905120855_dev_test_mode_bootstrap.sql"),
  "utf8",
);
const boundary = readFileSync(
  join(root, "supabase/migrations/20260905121141_dev_test_mode_service_boundary.sql"),
  "utf8",
);
const api = readFileSync(join(root, "src/app/api/test-auth/route.ts"), "utf8");
const page = readFileSync(join(root, "src/app/auth/sign-in/page.tsx"), "utf8");
const exampleEnv = readFileSync(join(root, ".env.example"), "utf8");

const originalEnabled = process.env.RAAHI_TEST_MODE_ENABLED;
const originalHosts = process.env.RAAHI_TEST_MODE_ALLOWED_HOSTS;

afterEach(() => {
  process.env.RAAHI_TEST_MODE_ENABLED = originalEnabled;
  process.env.RAAHI_TEST_MODE_ALLOWED_HOSTS = originalHosts;
});
describe("Raahi Dev Test Mode", () => {
  it("is closed by default in committed environment configuration", () => {
    expect(bootstrap).toContain("enabled boolean not null default false");
    expect(exampleEnv).toContain("RAAHI_TEST_MODE_ENABLED=false");
  });

  it("hard-blocks the production hostname even if someone misconfigures allowed hosts", () => {
    process.env.RAAHI_TEST_MODE_ENABLED = "true";
    process.env.RAAHI_TEST_MODE_ALLOWED_HOSTS = "ride.myraahi.co.in,localhost:4029";
    expect(isTestModeAllowed("ride.myraahi.co.in")).toBe(false);
    expect(isTestModeAllowed("localhost:4029")).toBe(true);
  });

  it("removes the browser-callable persona bootstrap and grants final provisioning only to service_role", () => {
    expect(boundary).toContain("drop function if exists public.dev_bootstrap_test_persona");
    expect(boundary).toContain("grant execute on function public.dev_provision_test_persona");
    expect(boundary).toContain("to service_role");
    expect(boundary).not.toContain("to authenticated;");
  });

  it("refuses to provision ordinary Google or production identities", () => {
    expect(boundary).toContain("raahi_test_identity");
    expect(boundary).toContain("TEST_IDENTITY_REQUIRED");
  });
  it("uses only synthetic test emails so Google identities cannot collide", () => {
    expect(api).toContain("@raahi.test");
    expect(api).toContain("EMAIL_BELONGS_TO_NON_TEST_ACCOUNT");
  });

  it("establishes a genuine Supabase session through admin magic-link generation and normal OTP verification", () => {
    expect(api).toContain("auth.admin.generateLink");
    expect(api).toContain('type: "magiclink"');
    expect(api).toContain("auth.verifyOtp");
    expect(api).toContain('type: "email"');
  });

  it("requires the server-only Supabase key rather than exposing privilege in the browser", () => {
    expect(api).toContain("SUPABASE_SECRET_KEY");
    expect(api).toContain("testModeServerConfigured");
    expect(api).not.toContain("NEXT_PUBLIC_SUPABASE_SECRET");
  });

  it("renders the manual persona form only through the server-side host gate", () => {
    expect(page).toContain("isTestModeAllowed");
    expect(page).toContain("<TestModeSignIn configured={testModeServerConfigured()} nextPath={nextPath} />");
  });
});
