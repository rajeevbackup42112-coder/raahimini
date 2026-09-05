import { createClient } from "@/lib/supabase/server";
import type { DriveContext } from "@/features/drive/types";

export type DriveProjectionResult =
  | { status: "READY"; context: DriveContext }
  | { status: "UNAUTHENTICATED" }
  | { status: "NOT_DRIVER"; message: string };

function classifyProjectionError(message: string): DriveProjectionResult {
  if (message.includes("UNAUTHENTICATED")) return { status: "UNAUTHENTICATED" };
  return { status: "NOT_DRIVER", message };
}

export async function getDriveContext(): Promise<DriveProjectionResult> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) return { status: "UNAUTHENTICATED" };

  const { data, error } = await supabase.rpc("get_my_drive_context");
  if (error) return classifyProjectionError(error.message);

  return { status: "READY", context: data as DriveContext };
}