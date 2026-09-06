import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ requestId: z.string().uuid(), revisionId: z.string().uuid(), idempotencyKey: z.string().min(8).max(200) });
const errors: Record<string, [number, string]> = {
  OUTSTATION_REQUEST_NOT_FOUND: [404, "Outstation request not found."],
  OUTSTATION_REQUEST_NOT_ACCEPTING_QUOTES: [409, "This request is no longer accepting a quote."],
  OUTSTATION_QUOTE_REVISION_STALE: [409, "This quote changed. Review the latest quote before selecting it."],
  OUTSTATION_QUOTE_EXPIRED: [409, "This quote expired. Ask the Driver for a new quote."],
  OUTSTATION_DRIVER_NOT_ELIGIBLE: [409, "This Driver or Vehicle is no longer eligible for this trip."],
  OUTSTATION_COMMITMENT_CONFLICT: [409, "The Driver or Vehicle became unavailable. Choose another current quote."],
  IDEMPOTENCY_CONFLICT: [409, "This selection was already used with different details."],
};

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Quote selection is invalid.", correlationId }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to select a quote.", correlationId }, { status: 401 });
  const { data, error } = await supabase.rpc("passenger_accept_outstation_quote", { p_request_id: parsed.data.requestId, p_revision_id: parsed.data.revisionId, p_idempotency_key: parsed.data.idempotencyKey });  if (error) {
    const hit = Object.entries(errors).find(([code]) => error.message.includes(code));
    if (hit) return NextResponse.json({ ok: false, code: hit[0], message: hit[1][1], correlationId }, { status: hit[1][0] });
    console.error("passenger_accept_outstation_quote failed", { correlationId, code: error.code });
    return NextResponse.json({ ok: false, code: "COMMAND_FAILED", message: "We could not confirm this Driver right now.", correlationId }, { status: 500 });
  }
  return NextResponse.json({ ok: true, value: data, correlationId });
}
