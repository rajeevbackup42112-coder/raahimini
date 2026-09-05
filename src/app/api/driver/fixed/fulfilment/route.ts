import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum([
    "ACKNOWLEDGE", "BEGIN_APPROACH", "ARRIVE", "START_BOARDING",
    "BOARDED", "NO_SHOW", "DEPART", "COMPLETE",
    "COMPLETE_OUTBOUND", "START_RETURN_BOARDING", "RETURN_BOARDED",
    "RETURN_NO_SHOW", "DEPART_RETURN", "COMPLETE_RETURN",
  ]),
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
  BOOKING_TRANSITION_INVALID: [409, "This Passenger booking cannot move to that step."],  DRIVER_ACK_DEADLINE_EXPIRED: [409, "The acknowledgement window has expired."],
  ARRIVAL_LOCATION_NOT_VERIFIED: [409, "Raahi could not verify arrival at the boarding area."],
  COMPLETION_LOCATION_NOT_VERIFIED: [409, "Raahi could not verify that the ride reached its destination area."],
  ROUND_TRIP_LOCATION_NOT_VERIFIED: [409, "Raahi could not verify the required Round Trip location."],
  BOARDING_WAIT_NOT_EXPIRED: [409, "The boarding wait time has not finished yet."],
  RETURN_WAIT_NOT_FINISHED: [409, "The configured destination wait has not finished yet."],
  RETURN_BOARDING_WAIT_NOT_EXPIRED: [409, "The return boarding wait time has not finished yet."],
  RETURN_MANIFEST_UNRESOLVED: [409, "Resolve every returning Passenger before departure."],
  IDEMPOTENCY_CONFLICT: [409, "This retry key was already used with different details."],
};

type RpcResult = { data: unknown; error: { message: string; code?: string } | null };

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_FAILED", message: "Fulfilment details are invalid.", correlationId },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to continue.", correlationId }, { status: 401 });
  }
  const input = parsed.data;
  let result: RpcResult;
  const bookingActions = new Set(["BOARDED", "NO_SHOW", "RETURN_BOARDED", "RETURN_NO_SHOW"]);
  const locationActions = new Set(["ARRIVE", "COMPLETE", "COMPLETE_OUTBOUND", "COMPLETE_RETURN"]);

  if (bookingActions.has(input.action)) {
    if (!input.bookingId) {
      return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Passenger booking is required.", correlationId }, { status: 400 });
    }
    const rpc = input.action === "BOARDED"
      ? "driver_mark_fixed_boarded"
      : input.action === "NO_SHOW"
        ? "driver_report_fixed_no_show"
        : input.action === "RETURN_BOARDED"
          ? "driver_mark_fixed_return_boarded"
          : "driver_report_fixed_return_no_show";
    result = await supabase.rpc(rpc, {
      p_booking_id: input.bookingId,
      p_idempotency_key: input.idempotencyKey,
    });
  } else {
    if (!input.rideId) {
      return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Ride is required.", correlationId }, { status: 400 });
    }

    if (locationActions.has(input.action)) {
      if (input.latitude == null || input.longitude == null || input.accuracyMeters == null || !input.capturedAt) {
        return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Fresh GPS evidence is required.", correlationId }, { status: 400 });
      }      const rpc = input.action === "ARRIVE"
        ? "driver_arrive_fixed_ride"
        : input.action === "COMPLETE"
          ? "driver_complete_fixed_ride"
          : input.action === "COMPLETE_OUTBOUND"
            ? "driver_complete_fixed_round_trip_outbound"
            : "driver_complete_fixed_round_trip";
      result = await supabase.rpc(rpc, {
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
            : input.action === "START_RETURN_BOARDING"
              ? "driver_start_fixed_return_boarding"
              : input.action === "DEPART_RETURN"
                ? "driver_depart_fixed_return"
                : "driver_start_fixed_boarding";
      result = await supabase.rpc(rpc, {
        p_ride_id: input.rideId,
        p_idempotency_key: input.idempotencyKey,
      });
    }
  }
  if (result.error) {
    const hit = Object.entries(errors).find(([code]) => result.error!.message.includes(code));
    if (hit) {
      return NextResponse.json(
        { ok: false, code: hit[0], message: hit[1][1], correlationId },
        { status: hit[1][0] },
      );
    }
    console.error("fixed fulfilment command failed", { correlationId, code: result.error.code });
    return NextResponse.json(
      { ok: false, code: "COMMAND_FAILED", message: "Raahi could not update this ride step.", correlationId },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, value: result.data, correlationId });
}
