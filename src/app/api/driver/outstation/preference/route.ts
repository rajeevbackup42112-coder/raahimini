import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ productId: z.string().uuid(), enabled: z.boolean(), idempotencyKey: z.string().min(8).max(200) });

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Preference details are invalid.", correlationId }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to continue.", correlationId }, { status: 401 });
  const { data, error } = await supabase.rpc("driver_set_outstation_preference", {
    p_product_id: parsed.data.productId,
    p_enabled: parsed.data.enabled,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) {
    const code = error.message.includes("IDEMPOTENCY_CONFLICT") ? "IDEMPOTENCY_CONFLICT" : error.message.includes("DRIVER_CAPABILITY_REQUIRED") ? "DRIVER_CAPABILITY_REQUIRED" : "COMMAND_FAILED";
    return NextResponse.json({ ok: false, code, message: code === "DRIVER_CAPABILITY_REQUIRED" ? "Driver access is required." : "We could not update Outstation preference.", correlationId }, { status: code === "DRIVER_CAPABILITY_REQUIRED" ? 403 : code === "IDEMPOTENCY_CONFLICT" ? 409 : 500 });
  }
  return NextResponse.json({ ok: true, value: data, correlationId });
}