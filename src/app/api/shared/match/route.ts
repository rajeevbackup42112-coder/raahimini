import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { mapSharedError } from "@/lib/shared-api";

const schema = z.object({
  matchId: z.string().uuid(),
  action: z.enum(["ACCEPT", "DECLINE"]),
  idempotencyKey: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_FAILED", message: "This Driver-offer action is invalid.", correlationId },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", message: "Sign in to continue with this Driver offer.", correlationId },
      { status: 401 },
    );
  }

  const p = parsed.data;
  const rpc = p.action === "ACCEPT" ? "accept_shared_trip_match" : "decline_shared_trip_match";
  const { data, error } = await supabase.rpc(rpc, {
    p_match_id: p.matchId,
    p_idempotency_key: p.idempotencyKey,
  });

  if (error) {
    const hit = mapSharedError(error.message);
    if (hit) return NextResponse.json({ ok: false, code: hit[0], message: hit[2], correlationId }, { status: hit[1] });
    console.error("shared match action failed", { correlationId, action: p.action, code: error.code });
    return NextResponse.json(
      { ok: false, code: "COMMAND_FAILED", message: "Raahi could not confirm this action.", correlationId },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, value: data, correlationId });
}
