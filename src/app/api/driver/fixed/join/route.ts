import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { DriverAvailabilityResult } from "@/features/driver-fixed/types";

const schema = z.object({
  productId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(200),
});

const knownErrors: Record<string, { status: number; message: string }> = {
  DRIVER_CAPABILITY_REQUIRED: { status: 403, message: "Driver access is required." },
  DRIVER_PROFILE_REQUIRED: { status: 403, message: "Driver setup is incomplete." },
  DRIVER_STANDING_NOT_ACTIVE: { status: 409, message: "Driver access is currently restricted." },
  FIXED_PRODUCT_NOT_AVAILABLE: { status: 409, message: "That Fixed route is not available now." },
  OPERATING_MARKET_REQUIRED: { status: 409, message: "Verify where you are driving from first." },
  OPERATING_MARKET_MISMATCH: { status: 409, message: "This route does not start in your current driving Market." },
  PRODUCT_PREFERENCE_REQUIRED: { status: 409, message: "Choose to serve this route before joining FIFO." },
  ACTIVE_ELIGIBLE_VEHICLE_REQUIRED: { status: 409, message: "An eligible active Vehicle is required." },
  DRIVER_VERIFICATION_REQUIRED: { status: 409, message: "Driver verification must be current before joining." },
  VEHICLE_VERIFICATION_REQUIRED: { status: 409, message: "Vehicle verification must be current before joining." },
  ACTIVE_COMMITMENT_CONFLICT: { status: 409, message: "Finish your current commitment before joining this FIFO." },
  ACTIVE_DRIVER_AVAILABILITY_EXISTS: { status: 409, message: "You are already waiting in this FIFO." },
  IDEMPOTENCY_CONFLICT: { status: 409, message: "This request was already used with different details." },
};
export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Availability details are invalid.", correlationId }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to continue.", correlationId }, { status: 401 });

  const input = parsed.data;
  const { data, error } = await supabase.rpc("join_fixed_driver_queue", {
    p_product_id: input.productId,
    p_vehicle_id: input.vehicleId,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) {
    const hit = Object.entries(knownErrors).find(([code]) => error.message.includes(code));
    if (hit) return NextResponse.json({ ok: false, code: hit[0], message: hit[1].message, correlationId }, { status: hit[1].status });
    console.error("join_fixed_driver_queue failed", { correlationId, code: error.code });
    return NextResponse.json({ ok: false, code: "COMMAND_FAILED", message: "We could not join this FIFO.", correlationId }, { status: 500 });
  }
  return NextResponse.json({ ok: true, value: data as DriverAvailabilityResult, correlationId });
}
