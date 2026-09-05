import { createClient } from "@/lib/supabase/server";
import type { DriverPaymentProjection, FixedPaymentProjection } from "@/features/payment-support/types";

export async function getMyFixedPayment(requestId: string) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, payment: null };
  const { data, error } = await supabase.rpc("get_my_fixed_payment", { p_request_id: requestId });
  if (error) throw new Error("FIXED_PAYMENT_FAILED");
  const payment = Array.isArray(data) ? data[0] : data;
  return { status: "READY" as const, payment: (payment ?? null) as FixedPaymentProjection | null };
}

export async function getMyDriverPayments() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, payments: [] as DriverPaymentProjection[] };
  const { data, error } = await supabase.rpc("get_my_driver_payments");
  if (error) {
    if (error.message.includes("DRIVER_CAPABILITY_REQUIRED")) return { status: "NOT_DRIVER" as const, payments: [] as DriverPaymentProjection[] };
    throw new Error("DRIVER_PAYMENTS_FAILED");
  }
  return { status: "READY" as const, payments: (data ?? []) as DriverPaymentProjection[] };
}