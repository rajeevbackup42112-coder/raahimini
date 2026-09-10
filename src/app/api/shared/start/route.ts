import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { mapSharedError } from "@/lib/shared-api";

const schema = z.object({
  originLocationId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
  desiredDepartureAt: z.string().datetime(),
  desiredWindowEndAt: z.string().datetime(),
  seatCount: z.number().int().min(1).max(12),
  notificationInterest: z.boolean(),
  idempotencyKey: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_FAILED", message: "Shared-ride details are invalid.", correlationId },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", message: "Sign in to start a shared ride.", correlationId },
      { status: 401 },
    );
  }

  const p = parsed.data;
  const { data, error } = await supabase.rpc("start_shared_ride", {
    p_origin_location_id: p.originLocationId,
    p_destination_location_id: p.destinationLocationId,
    p_desired_departure_at: p.desiredDepartureAt,
    p_desired_window_end_at: p.desiredWindowEndAt,
    p_seat_count: p.seatCount,
    p_notification_interest: p.notificationInterest,
    p_idempotency_key: p.idempotencyKey,
  });

  if (error) {
    const hit = mapSharedError(error.message);
    if (hit) return NextResponse.json({ ok: false, code: hit[0], message: hit[2], correlationId }, { status: hit[1] });
    console.error("start_shared_ride failed", { correlationId, code: error.code });
    return NextResponse.json(
      { ok: false, code: "COMMAND_FAILED", message: "Raahi could not start this shared ride.", correlationId },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, value: data, correlationId });
}
