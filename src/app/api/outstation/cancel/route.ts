import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ requestId: z.string().uuid(), idempotencyKey: z.string().min(8).max(200) });
const errors: Record<string, [number, string]> = {
  OUTSTATION_REQUEST_NOT_FOUND: [404, "Outstation request not found."],
  OUTSTATION_REQUEST_NOT_CANCELLABLE: [409, "This request can no longer be cancelled from this screen."],
  IDEMPOTENCY_CONFLICT: [409, "This action was already used with different details."],
};

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Cancellation details are invalid.", correlationId }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to continue.", correlationId }, { status: 401 });
  const { data, error } = await supabase.rpc("passenger_cancel_outstation_request", { p_request_id: parsed.data.requestId, p_idempotency_key: parsed.data.idempotencyKey });
  if (error) {
    const hit = Object.entries(errors).find(([code]) => error.message.includes(code));
    if (hit) return NextResponse.json({ ok: false, code: hit[0], message: hit[1][1], correlationId }, { status: hit[1][0] });
    return NextResponse.json({ ok: false, code: "COMMAND_FAILED", message: "We could not cancel this request.", correlationId }, { status: 500 });
  }
  return NextResponse.json({ ok: true, value: data, correlationId });
}