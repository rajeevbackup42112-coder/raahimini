import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["ACKNOWLEDGE", "BEGIN_APPROACH", "ARRIVE", "START_BOARDING", "BOARDED", "NO_SHOW", "DEPART", "COMPLETE"]),
  rideId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyMeters: z.number().positive().optional(),
  capturedAt: z.string().datetime().optional(),
  idempotencyKey: z.string().min(8).max(200),
});

const errors: Record<string, [number, string]> = {
  DRIVER_CAPABILITY_REQUIRED: [403, "Driver access is required."],
  RIDE_NOT_FOUND: [404, "This ride was not found."],
  BOOKING_NOT_FOUND: [404, "This Passenger booking was not found."],
  RIDE_TRANSITION_INVALID: [409, "This ride cannot move to that step yet."],
  BOOKING_TRANSITION_INVALID: [409, "This Passenger booking is already resolved."],
  DRIVER_ACK_DEADLINE_EXPIRED: [409, "The acknowledgement window has expired."],
  ARRIVAL_LOCATION_NOT_VERIFIED: [409, "Raahi could not verify arrival at the boarding area."],
  COMPLETION_LOCATION_NOT_VERIFIED: [409, "Raahi could not verify that the ride reached its destination area."],
  BOARDING_WAIT_NOT_EXPIRED: [409, "The boarding wait time has not finished yet."],
  IDEMPOTENCY_CONFLICT: [409, "This retry key was already used with different details."],
};
export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Fulfilment details are invalid.", correlationId }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to continue.", correlationId }, { status: 401 });
  }

  const input = parsed.data;
  let result: { data: unknown; error: { message: string; code?: string } | null };

  if (input.action === "BOARDED" || input.action === "NO_SHOW") {
    if (!input.bookingId) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Passenger booking is required.", correlationId }, { status: 400 });
    result = await supabase.rpc(input.action === "BOARDED" ? "driver_mark_fixed_boarded" : "driver_report_fixed_no_show", {
      p_booking_id: input.bookingId,
      p_idempotency_key: input.idempotencyKey,
    });
  } else {
    if (!input.rideId) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Ride is required.", correlationId }, { status: 400 });
    if (input.action === "ARRIVE" || input.action === "COMPLETE") {
      if (input.latitude == null || input.longitude == null || input.accuracyMeters == null || !input.capturedAt) {
        return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Fresh GPS evidence is required.", correlationId }, { status: 400 });
      }
      result = await supabase.rpc(input.action === "ARRIVE" ? "driver_arrive_fixed_ride" : "driver_complete_fixed_ride", {
        p_ride_id: input.rideId,
        p_latitude: input.latitude,
        p_longitude: input.longitude,
        p_accuracy_meters: input.accuracyMeters,
        p_captured_at: input.capturedAt,
        p_idempotency_key: input.idempotencyKey,
      });
    } else {
      const rpc = input.action === "ACKNOWLEDGE"
        ? "driver_acknowledge_fixed_ride"
        : input.action === "BEGIN_APPROACH"
          ? "driver_begin_fixed_approach"
          : input.action === "DEPART"
            ? "driver_depart_fixed_ride"
            : "driver_start_fixed_boarding";
      result = await supabase.rpc(rpc, {
        p_ride_id: input.rideId,
        p_idempotency_key: input.idempotencyKey,
      });
    }
  }

  if (result.error) {
    const hit = Object.entries(errors).find(([code]) => result.error!.message.includes(code));
    if (hit) return NextResponse.json({ ok: false, code: hit[0], message: hit[1][1], correlationId }, { status: hit[1][0] });
    console.error("fixed fulfilment command failed", { correlationId, code: result.error.code });
    return NextResponse.json({ ok: false, code: "COMMAND_FAILED", message: "Raahi could not update this ride step.", correlationId }, { status: 500 });
  }

  return NextResponse.json({ ok: true, value: result.data, correlationId });
}
