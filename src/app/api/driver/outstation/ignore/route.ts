import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ requestId: z.string().uuid(), idempotencyKey: z.string().min(8).max(200) });

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Request details are invalid.", correlationId }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to continue.", correlationId }, { status: 401 });
  const { data, error } = await supabase.rpc("driver_ignore_outstation_request", { p_request_id: parsed.data.requestId, p_idempotency_key: parsed.data.idempotencyKey });
  if (error) return NextResponse.json({ ok: false, code: "COMMAND_FAILED", message: "We could not ignore this opportunity.", correlationId }, { status: 409 });
  return NextResponse.json({ ok: true, value: data, correlationId });
}