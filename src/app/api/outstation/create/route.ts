import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  productId: z.string().uuid(),
  originLocationId: z.string().uuid().nullable(),
  destinationLocationId: z.string().uuid().nullable(),
  destinationText: z.string().trim().min(2).max(160),
  travelType: z.enum(["ONE_WAY", "ROUND_TRIP"]),
  departureAt: z.string().datetime(),
  returnAt: z.string().datetime().nullable(),
  passengerCount: z.number().int().min(1).max(12),
  passengerNote: z.string().trim().max(500).nullable(),
  idempotencyKey: z.string().min(8).max(200),
});

const messages: Record<string, [number, string]> = {
  PASSENGER_CAPABILITY_REQUIRED: [403, "Passenger access is required."],
  OUTSTATION_PRODUCT_NOT_AVAILABLE: [409, "Outstation is not available from this origin now."],
  OUTSTATION_DEPARTURE_INVALID: [422, "Choose a valid future departure time."],
  OUTSTATION_PASSENGER_COUNT_INVALID: [422, "Choose a valid passenger count."],
  OUTSTATION_RETURN_INVALID: [422, "Choose a valid return time."],
  IDEMPOTENCY_CONFLICT: [409, "This request was already used with different details."],
};
export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Outstation details are invalid.", correlationId }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to request a car.", correlationId }, { status: 401 });
  const input = parsed.data;
  const { data, error } = await supabase.rpc("passenger_create_outstation_request", {
    p_product_id: input.productId,
    p_origin_location_id: input.originLocationId,
    p_destination_location_id: input.destinationLocationId,
    p_destination_text: input.destinationText,
    p_travel_type: input.travelType,
    p_departure_at: input.departureAt,
    p_return_at: input.returnAt,
    p_passenger_count: input.passengerCount,
    p_passenger_note: input.passengerNote,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) {
    const hit = Object.entries(messages).find(([code]) => error.message.includes(code));
    if (hit) return NextResponse.json({ ok: false, code: hit[0], message: hit[1][1], correlationId }, { status: hit[1][0] });
    console.error("passenger_create_outstation_request failed", { correlationId, code: error.code });
    return NextResponse.json({ ok: false, code: "COMMAND_FAILED", message: "We could not create this request.", correlationId }, { status: 500 });
  }
  return NextResponse.json({ ok: true, value: data, correlationId });
}