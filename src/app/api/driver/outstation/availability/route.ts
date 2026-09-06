import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ marketId: z.string().uuid(), startsAt: z.string().datetime(), endsAt: z.string().datetime(), idempotencyKey: z.string().min(8).max(200) });

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Availability window is invalid.", correlationId }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to continue.", correlationId }, { status: 401 });
  const { data, error } = await supabase.rpc("driver_set_planned_market_availability", {
    p_market_id: parsed.data.marketId,
    p_starts_at: parsed.data.startsAt,
    p_ends_at: parsed.data.endsAt,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) {
    const message = error.message.includes("MARKET_NOT_AVAILABLE") ? "That Market is not available for Outstation work." : error.message.includes("PLANNED_AVAILABILITY_INVALID") ? "Choose a valid future availability window." : "We could not save this availability window.";
    return NextResponse.json({ ok: false, code: "COMMAND_FAILED", message, correlationId }, { status: 409 });
  }
  return NextResponse.json({ ok: true, value: data, correlationId });
}