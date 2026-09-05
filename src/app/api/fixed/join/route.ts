import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { JoinFixedResult } from "@/features/passenger-fixed/types";

const inputSchema = z.object({
  productId: z.string().uuid(),
  seatCount: z.number().int().min(1).max(12),
  idempotencyKey: z.string().min(8).max(200),
});

const knownErrors: Record<string, [number, string]> = {
  PASSENGER_CAPABILITY_REQUIRED: [403, "Passenger access is required."],
  FIXED_PRODUCT_NOT_AVAILABLE: [409, "This ride option is not available now."],
  INVALID_SEAT_COUNT: [422, "Choose a valid number of seats."],
  ACTIVE_FIXED_REQUEST_EXISTS: [409, "You already have a forming request for this ride."],
  IDEMPOTENCY_CONFLICT: [409, "This request was already used with different details."],
};

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Ride details are invalid.", correlationId }, { status: 400 });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to join this ride.", correlationId }, { status: 401 });

  const input = parsed.data;
  const { data, error } = await supabase.rpc("join_fixed_queue", {
    p_product_id: input.productId,
    p_seat_count: input.seatCount,
    p_boarding_context: {},
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) {
    const match = Object.entries(knownErrors).find(([code]) => error.message.includes(code));
    if (match) {
      const [code, [status, message]] = match;
      return NextResponse.json({ ok: false, code, message, correlationId }, { status });
    }
    console.error("join_fixed_queue failed", { correlationId, code: error.code });
    return NextResponse.json({ ok: false, code: "COMMAND_FAILED", message: "We could not join this ride right now.", correlationId }, { status: 500 });
  }
  return NextResponse.json({ ok: true, value: data as JoinFixedResult, correlationId });
}
