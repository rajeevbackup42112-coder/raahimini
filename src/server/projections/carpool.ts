import { createClient } from "@/lib/supabase/server";
import type { CarpoolCatalog, CarpoolDiscoveryItem, CarpoolJourneyView, DriverCarpoolWorkspace } from "@/features/carpool/types";

export async function getCarpoolCatalog() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, catalog: null };
  const { data, error } = await supabase.rpc("get_carpool_catalog");
  if (error) { console.error("get_carpool_catalog failed", { code: error.code }); return { status: "ERROR" as const, catalog: null }; }
  return { status: "READY" as const, catalog: data as CarpoolCatalog };
}

export async function getCarpoolDiscovery(originLocationId?: string | null, destinationLocationId?: string | null) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, journeys: [] as CarpoolDiscoveryItem[] };
  const { data, error } = await supabase.rpc("get_carpool_discovery", { p_origin_location_id: originLocationId ?? null, p_destination_location_id: destinationLocationId ?? null });
  if (error) { console.error("get_carpool_discovery failed", { code: error.code }); return { status: "ERROR" as const, journeys: [] as CarpoolDiscoveryItem[] }; }
  return { status: "READY" as const, journeys: (data ?? []) as CarpoolDiscoveryItem[] };
}

export async function getCarpoolJourney(journeyId: string) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, journey: null };
  const { data, error } = await supabase.rpc("get_carpool_journey", { p_journey_id: journeyId });
  if (error) { console.error("get_carpool_journey failed", { code: error.code }); return { status: "ERROR" as const, journey: null }; }
  if (!data) return { status: "NOT_FOUND" as const, journey: null };
  return { status: "READY" as const, journey: data as CarpoolJourneyView };
}

export async function getDriverCarpoolWorkspace() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, workspace: null };
  const { data, error } = await supabase.rpc("get_driver_carpool_workspace");
  if (error) {
    if (error.message.includes("DRIVER_CAPABILITY_REQUIRED")) return { status: "NOT_DRIVER" as const, workspace: null };
    console.error("get_driver_carpool_workspace failed", { code: error.code }); return { status: "ERROR" as const, workspace: null };
  }
  return { status: "READY" as const, workspace: data as DriverCarpoolWorkspace };
}
