import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["MARK_PAID", "CONFIRM_RECEIVED", "REPORT_ISSUE"]),
  paymentId: z.string().uuid(),
  details: z.string().trim().min(3).max(2000).optional(),
  idempotencyKey: z.string().min(8).max(200),
});

const errors: Record<string, [number, string]> = {
  PAYMENT_NOT_FOUND: [404, "This payment record was not found."],
  PAYMENT_TRANSITION_INVALID: [409, "This payment cannot move to that state."],
  DRIVER_CAPABILITY_REQUIRED: [403, "Driver access is required."],
  CASE_DETAILS_REQUIRED: [400, "Please describe the payment problem."],
  IDEMPOTENCY_CONFLICT: [409, "This retry key was already used with different details."],
};

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION_FAILED", message: "Payment details are invalid.", correlationId }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();  if (!claims?.claims?.sub) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to continue.", correlationId }, { status: 401 });

  const input = parsed.data;
  const rpc = input.action === "MARK_PAID"
    ? "passenger_mark_payment_paid"
    : input.action === "CONFIRM_RECEIVED"
      ? "driver_confirm_payment_received"
      : "report_payment_issue";
  const args = input.action === "REPORT_ISSUE"
    ? { p_payment_id: input.paymentId, p_details: input.details ?? "", p_idempotency_key: input.idempotencyKey }
    : { p_payment_id: input.paymentId, p_idempotency_key: input.idempotencyKey };
  const { data, error } = await supabase.rpc(rpc, args);
  if (error) {
    const hit = Object.entries(errors).find(([code]) => error.message.includes(code));
    if (hit) return NextResponse.json({ ok: false, code: hit[0], message: hit[1][1], correlationId }, { status: hit[1][0] });
    console.error("fixed payment command failed", { correlationId, code: error.code });
    return NextResponse.json({ ok: false, code: "COMMAND_FAILED", message: "Raahi could not update this payment.", correlationId }, { status: 500 });
  }
  return NextResponse.json({ ok: true, value: data, correlationId });
}