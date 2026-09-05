import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { DriverPreferenceResult } from "@/features/driver-fixed/types";

const schema = z.object({
  productId: z.string().uuid(),
  enabled: z.boolean(),
  idempotencyKey: z.string().min(8).max(200),
});

const knownErrors: Record<string, { status: number; message: string }> = {
  DRIVER_CAPABILITY_REQUIRED: { status: 403, message: "Driver access is required." },
  DRIVER_PROFILE_REQUIRED: { status: 403, message: "Driver setup is incomplete." },
  DRIVER_STANDING_NOT_ACTIVE: { status: 409, message: "Driver access is currently restricted." },
  FIXED_PRODUCT_NOT_AVAILABLE: { status: 409, message: "That route is not available for driving now." },
  DRIVER_AVAILABILITY_RESERVED: { status: 409, message: "Raahi is already reserving this availability for a match." },
  IDEMPOTENCY_CONFLICT: { status: 409, message: "This request was already used with different details." },
};

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Preference details are invalid.", correlationId }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to continue.", correlationId }, { status: 401 });
  const input = parsed.data;
  const { data, error } = await supabase.rpc("set_driver_product_preference", {
    p_product_id: input.productId,
    p_enabled: input.enabled,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) {
    const hit = Object.entries(knownErrors).find(([code]) => error.message.includes(code));
    if (hit) return NextResponse.json({ ok: false, code: hit[0], message: hit[1].message, correlationId }, { status: hit[1].status });
    console.error("set_driver_product_preference failed", { correlationId, code: error.code });
    return NextResponse.json({ ok: false, code: "COMMAND_FAILED", message: "We could not update this route preference.", correlationId }, { status: 500 });
  }
  return NextResponse.json({ ok: true, value: data as DriverPreferenceResult, correlationId });
}
