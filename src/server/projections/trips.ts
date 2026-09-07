import { createClient } from "@/lib/supabase/server";
import type { DriverTripWorkspace, TripCatalog, TripDiscoveryItem, TripOfferingView } from "@/features/trips/types";

export async function getTripCatalog() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, catalog: null };
  const { data, error } = await supabase.rpc("get_trip_catalog");
  if (error) {
    console.error("get_trip_catalog failed", { code: error.code });
    return { status: "ERROR" as const, catalog: null };
  }
  return { status: "READY" as const, catalog: data as TripCatalog };
}

export async function getTripDiscovery(originLocationId?: string | null) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, offerings: [] as TripDiscoveryItem[] };
  const { data, error } = await supabase.rpc("get_trip_discovery", { p_origin_location_id: originLocationId ?? null });
  if (error) {
    console.error("get_trip_discovery failed", { code: error.code });
    return { status: "ERROR" as const, offerings: [] as TripDiscoveryItem[] };
  }
  return { status: "READY" as const, offerings: (data ?? []) as TripDiscoveryItem[] };
}

export async function getTripOffering(offeringId: string) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, offering: null };
  const { data, error } = await supabase.rpc("get_trip_offering", { p_offering_id: offeringId });
  if (error) {
    console.error("get_trip_offering failed", { code: error.code });
    return { status: "ERROR" as const, offering: null };
  }
  if (!data) return { status: "NOT_FOUND" as const, offering: null };
  return { status: "READY" as const, offering: data as TripOfferingView };
}

export async function getDriverTripWorkspace() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, workspace: null };
  const { data, error } = await supabase.rpc("get_driver_trip_workspace");
  if (error) {
    if (error.message.includes("DRIVER_CAPABILITY_REQUIRED")) return { status: "NOT_DRIVER" as const, workspace: null };
    console.error("get_driver_trip_workspace failed", { code: error.code });
    return { status: "ERROR" as const, workspace: null };
  }
  return { status: "READY" as const, workspace: data as DriverTripWorkspace };
}
