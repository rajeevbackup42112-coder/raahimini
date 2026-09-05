import { createClient } from "@/lib/supabase/server";
import type { FixedDriverHistoryItem } from "@/features/driver-fixed/types";

export async function getFixedDriverHistory() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return { status: "UNAUTHENTICATED" as const, rides: [] as FixedDriverHistoryItem[] };
  }

  const { data, error } = await supabase.rpc("get_my_fixed_history");
  if (error) {
    console.error("get_my_fixed_history failed", { code: error.code });
    return { status: "ERROR" as const, rides: [] as FixedDriverHistoryItem[] };
  }

  return { status: "READY" as const, rides: (data ?? []) as FixedDriverHistoryItem[] };
}
