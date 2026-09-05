import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  objectType: z.enum(["RIDE", "BOOKING", "PAYMENT"]),
  objectId: z.string().uuid(),
  category: z.enum(["SAFETY", "DRIVER_DID_NOT_ARRIVE", "PASSENGER_DID_NOT_ARRIVE", "WRONG_VEHICLE", "PAYMENT_PROBLEM", "FARE_DISAGREEMENT", "BEHAVIOUR", "BREAKDOWN", "APP_SYSTEM_PROBLEM", "OTHER"]),
  details: z.string().trim().min(3).max(2000),
  idempotencyKey: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Support details are invalid.", correlationId }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to continue.", correlationId }, { status: 401 });
  const input = parsed.data;
  const { data, error } = await supabase.rpc("report_issue", {
    p_object_type: input.objectType,
    p_object_id: input.objectId,
    p_category: input.category,
    p_details: input.details,
    p_idempotency_key: input.idempotencyKey,
  });  if (error) {
    const message = error.message.includes("CASE_OBJECT_NOT_FOUND")
      ? "This journey item is not available to report."
      : error.message.includes("IDEMPOTENCY_CONFLICT")
        ? "This retry key was already used with different details."
        : error.message.includes("CASE_DETAILS_REQUIRED")
          ? "Please describe what happened."
          : "Raahi could not open this support case.";
    const status = error.message.includes("CASE_OBJECT_NOT_FOUND") ? 404 : error.message.includes("CASE_DETAILS_REQUIRED") ? 400 : error.message.includes("IDEMPOTENCY_CONFLICT") ? 409 : 500;
    if (status === 500) console.error("report issue failed", { correlationId, code: error.code });
    return NextResponse.json({ ok: false, code: status === 404 ? "CASE_OBJECT_NOT_FOUND" : "COMMAND_FAILED", message, correlationId }, { status });
  }
  return NextResponse.json({ ok: true, value: data, correlationId });
}