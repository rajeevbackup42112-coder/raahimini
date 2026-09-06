import { createClient } from "@/lib/supabase/server";
import type {
  OutstationDriverWorkspace,
  OutstationProduct,
  OutstationRequestView,
  OutstationTripView,
  OutstationDriverTrip,
} from "@/features/outstation/types";

export async function getOutstationProductForOrigin(originLocationId: string) {
  const supabase = await createClient();
  const { data: location, error: locationError } = await supabase
    .from("locations")
    .select("market_id")
    .eq("id", originLocationId)
    .maybeSingle();
  if (locationError || !location?.market_id) return null;

  const { data: product, error } = await supabase
    .from("service_products")
    .select("id,display_name,public_summary,market_id,markets(name)")
    .eq("market_id", location.market_id)
    .eq("service_type", "OUTSTATION")
    .in("status", ["PILOT", "ACTIVE"])
    .maybeSingle();
  if (error || !product) return null;
  const market = Array.isArray(product.markets) ? product.markets[0] : product.markets;
  return {
    product_id: product.id,
    display_name: product.display_name,
    public_summary: product.public_summary,
    market_id: product.market_id,
    market_name: market?.name ?? "Origin Market",
  } as OutstationProduct;
}
export async function getMyOutstationRequest(requestId: string) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, request: null };
  const { data, error } = await supabase.rpc("get_my_outstation_request", {
    p_request_id: requestId,
  });
  if (error) {
    console.error("get_my_outstation_request failed", { code: error.code });
    return { status: "ERROR" as const, request: null };
  }
  if (!data) return { status: "NOT_FOUND" as const, request: null };
  return { status: "READY" as const, request: data as OutstationRequestView };
}

export async function getDriverOutstationWorkspace() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const };
  const { data, error } = await supabase.rpc("get_driver_outstation_workspace");
  if (error) {
    if (error.message.includes("DRIVER_CAPABILITY_REQUIRED")) return { status: "NOT_DRIVER" as const };
    console.error("get_driver_outstation_workspace failed", { code: error.code });
    return { status: "ERROR" as const };
  }
  return { status: "READY" as const, workspace: data as OutstationDriverWorkspace };
}

export async function getMyOutstationTrip(requestId: string) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, trip: null };
  const { data, error } = await supabase.rpc("get_my_outstation_trip", { p_request_id: requestId });
  if (error) {
    console.error("get_my_outstation_trip failed", { code: error.code });
    return { status: "ERROR" as const, trip: null };
  }
  if (!data) return { status: "NOT_FOUND" as const, trip: null };
  return { status: "READY" as const, trip: data as OutstationTripView };
}

export async function getMyOutstationDriverTrips() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, trips: [] as OutstationDriverTrip[] };
  const { data, error } = await supabase.rpc("get_my_outstation_driver_trips");
  if (error) {
    if (error.message.includes("DRIVER_CAPABILITY_REQUIRED")) return { status: "NOT_DRIVER" as const, trips: [] as OutstationDriverTrip[] };
    console.error("get_my_outstation_driver_trips failed", { code: error.code });
    return { status: "ERROR" as const, trips: [] as OutstationDriverTrip[] };
  }
  return { status: "READY" as const, trips: (data ?? []) as OutstationDriverTrip[] };
}
