import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  requestId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(200),
});

const knownErrors: Record<string, [number, string]> = {
  PASSENGER_CAPABILITY_REQUIRED: [403, "Passenger access is required."],
  FIXED_REQUEST_NOT_FOUND: [404, "This ride request was not found."],
  FIXED_REQUEST_NOT_CANCELLABLE: [409, "This request can no longer be cancelled here."],
  IDEMPOTENCY_CONFLICT: [409, "This cancellation was already used for another request."],
};

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Cancellation details are invalid.", correlationId }, { status: 400 });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to continue.", correlationId }, { status: 401 });

  const input = parsed.data;
  const { data, error } = await supabase.rpc("cancel_fixed_queue_request", {
    p_request_id: input.requestId,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) {
    const match = Object.entries(knownErrors).find(([code]) => error.message.includes(code));
    if (match) {
      const [code, [status, message]] = match;
      return NextResponse.json({ ok: false, code, message, correlationId }, { status });
    }
    console.error("cancel_fixed_queue_request failed", { correlationId, code: error.code });
    return NextResponse.json({ ok: false, code: "COMMAND_FAILED", message: "We could not cancel this request right now.", correlationId }, { status: 500 });
  }
  return NextResponse.json({ ok: true, value: data, correlationId });
}
