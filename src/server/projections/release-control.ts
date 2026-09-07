import { createClient } from "@/lib/supabase/server";
import type { ReleaseControlWorkspace } from "@/features/release-control/types";

export async function getReleaseControlWorkspace() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, workspace: null };
  const { data, error } = await supabase.rpc("get_release_control_workspace");
  if (error) {
    if (error.message.includes("ADMIN_CAPABILITY_REQUIRED")) return { status: "NOT_ADMIN" as const, workspace: null };
    console.error("get_release_control_workspace failed", { code: error.code });
    return { status: "ERROR" as const, workspace: null };
  }
  return { status: "READY" as const, workspace: data as ReleaseControlWorkspace };
}