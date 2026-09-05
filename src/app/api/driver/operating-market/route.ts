import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { SetOperatingMarketResult } from "@/features/drive/types";

const inputSchema = z.object({
  marketId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive().max(5000),
  capturedAt: z.string().datetime({ offset: true }),
  idempotencyKey: z.string().min(8).max(200),
});

const knownErrors: Record<string, { status: number; message: string }> = {
  DRIVER_CAPABILITY_REQUIRED: { status: 403, message: "Driver access is required." },
  DRIVER_PROFILE_REQUIRED: { status: 403, message: "Driver setup is incomplete." },
  DRIVER_STANDING_NOT_ACTIVE: { status: 409, message: "Driver access is currently restricted." },
  MARKET_NOT_ELIGIBLE: { status: 409, message: "That Market is not available for driving yet." },
  LOCATION_NOT_VERIFIED: { status: 422, message: "Your current location could not be verified for that Market." },
  ACTIVE_COMMITMENT_CONFLICT: { status: 409, message: "Finish your current commitment before changing Market." },
  IDEMPOTENCY_CONFLICT: { status: 409, message: "This request was already used with different details." },
};

function mapRpcError(message: string) {
  const match = Object.entries(knownErrors).find(([code]) => message.includes(code));
  return match ? { code: match[0], ...match[1] } : null;
}
export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_FAILED", message: "Location details are invalid.", correlationId },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", message: "Sign in to continue.", correlationId },
      { status: 401 },
    );
  }

  const input = parsed.data;
  const { data, error } = await supabase.rpc("driver_set_operating_market", {
    p_market_id: input.marketId,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_accuracy_meters: input.accuracyMeters,
    p_captured_at: input.capturedAt,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    const mapped = mapRpcError(error.message);
    if (mapped) {
      return NextResponse.json(
        { ok: false, code: mapped.code, message: mapped.message, correlationId },
        { status: mapped.status },
      );
    }
    console.error("driver_set_operating_market failed", { correlationId, code: error.code });
    return NextResponse.json(
      { ok: false, code: "COMMAND_FAILED", message: "We could not update your driving Market.", correlationId },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, value: data as SetOperatingMarketResult, correlationId });
}