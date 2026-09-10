import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { mapSharedError } from "@/lib/shared-api";

const schema = z.object({
  intentId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_FAILED", message: "This shared-ride refresh is invalid.", correlationId },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", message: "Sign in to refresh this shared ride.", correlationId },
      { status: 401 },
    );
  }

  const { data, error } = await supabase.rpc("refresh_shared_ride", {
    p_intent_id: parsed.data.intentId,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) {
    const hit = mapSharedError(error.message);
    if (hit) return NextResponse.json({ ok: false, code: hit[0], message: hit[2], correlationId }, { status: hit[1] });
    console.error("refresh_shared_ride failed", { correlationId, code: error.code });
    return NextResponse.json(
      { ok: false, code: "COMMAND_FAILED", message: "Raahi could not refresh this shared ride.", correlationId },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, value: data, correlationId });
}
