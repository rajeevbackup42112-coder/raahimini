import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { recordRejectedGpsObservation } from "@/server/operational-observability";

const schema = z.object({
  action: z.enum([
    "BEGIN_APPROACH", "ARRIVE", "START_BOARDING", "BOARDED", "DEPART",
    "REACH_DESTINATION", "START_RETURN_BOARDING", "RETURN_BOARDED",
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
  RIDE_NOT_FOUND: [404, "This Outstation ride was not found."],
  BOOKING_NOT_FOUND: [404, "This Passenger booking was not found."],
  RIDE_TRANSITION_INVALID: [409, "This trip cannot move to that step yet."],
  BOOKING_TRANSITION_INVALID: [409, "This Passenger booking cannot move to that step."],
  ARRIVAL_LOCATION_NOT_VERIFIED: [409, "Raahi could not verify arrival in the pickup area."],
  ROUND_TRIP_LOCATION_NOT_VERIFIED: [409, "Raahi could not verify final return arrival in the origin area."],
  RETURN_WAIT_NOT_FINISHED: [409, "The agreed return time has not arrived yet."],
  RETURN_BOARDING_WAIT_NOT_EXPIRED: [409, "The return boarding wait is still active."],
  RETURN_MANIFEST_UNRESOLVED: [409, "Resolve the returning Passenger before departure."],
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
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", message: "Sign in to continue.", correlationId },
      { status: 401 },
    );
  }

  const input = parsed.data;
  const bookingActions = new Set(["BOARDED", "RETURN_BOARDED", "RETURN_NO_SHOW"]);
  const locationActions = new Set(["ARRIVE", "COMPLETE_RETURN"]);
  let result: RpcResult;

  if (bookingActions.has(input.action)) {
    if (!input.bookingId) {
      return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Passenger booking is required.", correlationId }, { status: 400 });
    }    const rpc = input.action === "BOARDED"
      ? "driver_mark_outstation_boarded"
      : input.action === "RETURN_BOARDED"
        ? "driver_mark_outstation_return_boarded"
        : "driver_report_outstation_return_no_show";
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
      }
      const rpc = input.action === "ARRIVE"
        ? "driver_arrive_outstation_ride"
        : "driver_complete_outstation_return";
      result = await supabase.rpc(rpc, {
        p_ride_id: input.rideId,
        p_latitude: input.latitude,
        p_longitude: input.longitude,
        p_accuracy_meters: input.accuracyMeters,
        p_captured_at: input.capturedAt,
        p_idempotency_key: input.idempotencyKey,
      });
    } else {      const rpc = input.action === "BEGIN_APPROACH"
        ? "driver_begin_outstation_approach"
        : input.action === "START_BOARDING"
          ? "driver_start_outstation_boarding"
          : input.action === "DEPART"
            ? "driver_depart_outstation_ride"
            : input.action === "REACH_DESTINATION"
              ? "driver_reach_outstation_destination"
              : input.action === "START_RETURN_BOARDING"
                ? "driver_start_outstation_return_boarding"
                : "driver_depart_outstation_return";
      result = await supabase.rpc(rpc, {
        p_ride_id: input.rideId,
        p_idempotency_key: input.idempotencyKey,
      });
    }
  }

  if (result.error) {
    const hit = Object.entries(errors).find(([code]) => result.error!.message.includes(code));
    if (hit) {
      if (["ARRIVAL_LOCATION_NOT_VERIFIED","ROUND_TRIP_LOCATION_NOT_VERIFIED"].includes(hit[0]) && input.rideId && input.accuracyMeters != null && input.capturedAt) {
        const observation = await recordRejectedGpsObservation({ actorProfileId: String(claims.claims.sub), rideId: input.rideId, action: input.action, rejectionCode: hit[0], accuracyMeters: input.accuracyMeters, capturedAt: input.capturedAt, correlationId });
        if (!observation.ok) console.error("rejected GPS observation failed", { correlationId, code: observation.code });
      }
      return NextResponse.json(
        { ok: false, code: hit[0], message: hit[1][1], correlationId },
        { status: hit[1][0] },
      );
    }
    console.error("outstation fulfilment command failed", { correlationId, code: result.error.code });
    return NextResponse.json(
      { ok: false, code: "COMMAND_FAILED", message: "Raahi could not update this Outstation trip step.", correlationId },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, value: result.data, correlationId });
}
