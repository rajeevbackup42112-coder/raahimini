import { randomBytes } from "node:crypto";
import { createClient as createAdminClient, type User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isTestModeAllowed, testModeServerConfigured } from "@/server/test-mode/access";

const requestSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160).refine(
    (value) => value.toLowerCase().endsWith("@raahi.test"),
    "Use a synthetic @raahi.test address",
  ),
  persona: z.enum([
    "PASSENGER",
    "DRIVER",
    "PASSENGER_DRIVER",
    "MARKET_ADMIN",
    "PLATFORM_ADMIN",
  ]),
  homeMarketCode: z.enum(["GOMOH", "DHANBAD"]).optional(),
  adminMarketCode: z.enum(["GOMOH", "DHANBAD"]).optional(),
});

type RequestBody = z.infer<typeof requestSchema>;

function redirectForPersona(persona: RequestBody["persona"]) {
  return persona === "DRIVER" || persona === "PASSENGER_DRIVER" ? "/drive" : "/";
}
function adminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("TEST_MODE_SERVER_NOT_CONFIGURED");

  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function findTestUserByEmail(email: string) {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;

  return data.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  ) ?? null;
}

function isRaahiTestUser(user: User) {
  return user.user_metadata?.raahi_test_identity === true;
}
async function ensureTestUser(body: RequestBody) {
  const admin = adminClient();
  const metadata = {
    display_name: body.displayName,
    raahi_test_identity: true,
    raahi_test_persona: body.persona,
  };

  const existing = await findTestUserByEmail(body.email);
  if (existing && !isRaahiTestUser(existing)) {
    throw new Error("EMAIL_BELONGS_TO_NON_TEST_ACCOUNT");
  }

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      user_metadata: { ...existing.user_metadata, ...metadata },
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: body.email,
    password: randomBytes(32).toString("base64url"),
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) throw error;
  return data.user;
}
export async function POST(request: NextRequest) {
  if (!isTestModeAllowed(request.headers.get("host"))) {
    return new NextResponse(null, { status: 404 });
  }
  if (!testModeServerConfigured()) {
    return NextResponse.json(
      { error: "TEST_MODE_SERVER_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_TEST_PERSONA_INPUT" }, { status: 400 });
  }

  const body = parsed.data;
  if (
    (body.persona === "DRIVER" || body.persona === "PASSENGER_DRIVER") &&
    !body.homeMarketCode
  ) {
    return NextResponse.json({ error: "HOME_MARKET_REQUIRED" }, { status: 400 });
  }
  if (body.persona === "MARKET_ADMIN" && !body.adminMarketCode) {
    return NextResponse.json({ error: "ADMIN_MARKET_REQUIRED" }, { status: 400 });
  }
  try {
    const admin = adminClient();
    const user = await ensureTestUser(body);

    const { error: provisionError } = await admin.rpc("dev_provision_test_persona", {
      p_profile_id: user.id,
      p_display_name: body.displayName,
      p_test_email: body.email,
      p_persona: body.persona,
      p_home_market_code: body.homeMarketCode ?? null,
      p_admin_market_code: body.adminMarketCode ?? null,
    });
    if (provisionError) throw provisionError;

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: body.email,
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) throw linkError ?? new Error("TEST_LINK_FAILED");

    const supabase = await createServerClient();
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    });
    if (verifyError || !verifyData.session) {
      throw verifyError ?? new Error("TEST_SESSION_FAILED");
    }
    if (verifyData.session.user.id !== user.id) {
      await supabase.auth.signOut();
      throw new Error("TEST_SESSION_IDENTITY_MISMATCH");
    }

    return NextResponse.json({
      success: true,
      persona: body.persona,
      redirectTo: redirectForPersona(body.persona),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TEST_AUTH_FAILED";
    if (message === "EMAIL_BELONGS_TO_NON_TEST_ACCOUNT") {
      return NextResponse.json(
        { error: "USE_A_SYNTHETIC_TEST_EMAIL" },
        { status: 409 },
      );
    }

    console.error("Raahi test auth failed", error);
    return NextResponse.json({ error: "TEST_AUTH_FAILED" }, { status: 500 });
  }
}
