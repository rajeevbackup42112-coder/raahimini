import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ agreementId: z.string().uuid(), idempotencyKey: z.string().min(8).max(200) });

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Cancellation details are invalid.", correlationId }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to continue.", correlationId }, { status: 401 });
  const { data, error } = await supabase.rpc("driver_cancel_outstation_agreement", {
    p_agreement_id: parsed.data.agreementId,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) {
    const code = error.message.includes("OUTSTATION_ALREADY_IN_FULFILMENT") ? "OUTSTATION_ALREADY_IN_FULFILMENT" : error.message.includes("OUTSTATION_REQUEST_NOT_CONFIRMED") ? "OUTSTATION_REQUEST_NOT_CONFIRMED" : "COMMAND_FAILED";
    const message = code === "OUTSTATION_ALREADY_IN_FULFILMENT" ? "This trip has already entered fulfilment. Use support for an in-progress exception." : code === "OUTSTATION_REQUEST_NOT_CONFIRMED" ? "This request is no longer in a cancellable confirmed state." : "We could not cancel this confirmed trip.";
    return NextResponse.json({ ok: false, code, message, correlationId }, { status: code === "COMMAND_FAILED" ? 500 : 409 });
  }
  return NextResponse.json({ ok: true, value: data, correlationId });
}