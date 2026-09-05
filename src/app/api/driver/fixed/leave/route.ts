import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { DriverAvailabilityResult } from "@/features/driver-fixed/types";

const schema = z.object({
  availabilityId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(200),
});

const knownErrors: Record<string, { status: number; message: string }> = {
  DRIVER_CAPABILITY_REQUIRED: { status: 403, message: "Driver access is required." },
  DRIVER_PROFILE_REQUIRED: { status: 403, message: "Driver setup is incomplete." },
  DRIVER_AVAILABILITY_NOT_FOUND: { status: 404, message: "This FIFO position was not found." },
  DRIVER_AVAILABILITY_NOT_LEAVABLE: { status: 409, message: "Raahi is already reserving or assigning this position." },
  IDEMPOTENCY_CONFLICT: { status: 409, message: "This request was already used with different details." },
};

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "FIFO details are invalid.", correlationId }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to continue.", correlationId }, { status: 401 });
  const input = parsed.data;
  const { data, error } = await supabase.rpc("leave_fixed_driver_queue", {
    p_availability_id: input.availabilityId,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) {
    const hit = Object.entries(knownErrors).find(([code]) => error.message.includes(code));
    if (hit) return NextResponse.json({ ok: false, code: hit[0], message: hit[1].message, correlationId }, { status: hit[1].status });
    console.error("leave_fixed_driver_queue failed", { correlationId, code: error.code });
    return NextResponse.json({ ok: false, code: "COMMAND_FAILED", message: "We could not leave this FIFO.", correlationId }, { status: 500 });
  }
  return NextResponse.json({ ok: true, value: data as DriverAvailabilityResult, correlationId });
}
