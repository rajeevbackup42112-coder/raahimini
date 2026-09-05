import { createClient } from "@/lib/supabase/server";
import type { FixedDriverWorkspace } from "@/features/driver-fixed/types";

export async function getFixedDriverWorkspace() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return { status: "UNAUTHENTICATED" as const };
  }

  const { data, error } = await supabase.rpc("get_fixed_driver_workspace");
  if (error) {
    if (error.message.includes("DRIVER_CAPABILITY_REQUIRED") || error.message.includes("DRIVER_PROFILE_REQUIRED")) {
      return { status: "NOT_DRIVER" as const };
    }
    console.error("get_fixed_driver_workspace failed", { code: error.code });
    return { status: "ERROR" as const };
  }

  return { status: "READY" as const, workspace: data as FixedDriverWorkspace };
}
