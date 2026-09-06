import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  requestId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  totalPriceInr: z.number().int().positive().max(500000),
  includesTolls: z.boolean(),
  includesParking: z.boolean(),
  commercialNote: z.string().trim().max(500).nullable(),
  idempotencyKey: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Quote details are invalid.", correlationId }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to quote.", correlationId }, { status: 401 });
  const input = parsed.data;
  const { data, error } = await supabase.rpc("driver_submit_outstation_quote", {
    p_request_id: input.requestId, p_vehicle_id: input.vehicleId, p_total_price_inr: input.totalPriceInr,
    p_includes_tolls: input.includesTolls, p_includes_parking: input.includesParking,
    p_commercial_note: input.commercialNote, p_idempotency_key: input.idempotencyKey,
  });  if (error) {
    const code = error.message.includes("OUTSTATION_DRIVER_NOT_ELIGIBLE") ? "OUTSTATION_DRIVER_NOT_ELIGIBLE" : error.message.includes("OUTSTATION_REQUEST_NOT_AVAILABLE") ? "OUTSTATION_REQUEST_NOT_AVAILABLE" : error.message.includes("IDEMPOTENCY_CONFLICT") ? "IDEMPOTENCY_CONFLICT" : "COMMAND_FAILED";
    const message = code === "OUTSTATION_DRIVER_NOT_ELIGIBLE" ? "You or this Vehicle are no longer eligible for this request." : code === "OUTSTATION_REQUEST_NOT_AVAILABLE" ? "This request is no longer accepting quotes." : "We could not save this quote.";
    return NextResponse.json({ ok: false, code, message, correlationId }, { status: code === "COMMAND_FAILED" ? 500 : 409 });
  }
  return NextResponse.json({ ok: true, value: data, correlationId });
}
