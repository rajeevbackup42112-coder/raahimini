import { createClient } from "@/lib/supabase/server";
import type { FixedDriverAssignment } from "@/features/driver-fixed/types";

export async function getFixedDriverAssignments() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return { status: "UNAUTHENTICATED" as const, assignments: [] as FixedDriverAssignment[] };
  }

  const { data, error } = await supabase.rpc("get_my_fixed_assignments");
  if (error) {
    if (error.message.includes("DRIVER_CAPABILITY_REQUIRED") || error.message.includes("DRIVER_PROFILE_REQUIRED")) {
      return { status: "NOT_DRIVER" as const, assignments: [] as FixedDriverAssignment[] };
    }
    console.error("get_my_fixed_assignments failed", { code: error.code });
    return { status: "ERROR" as const, assignments: [] as FixedDriverAssignment[] };
  }

  return { status: "READY" as const, assignments: (data ?? []) as FixedDriverAssignment[] };
}
