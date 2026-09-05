import { createClient } from "@/lib/supabase/server";
import type {
  FixedProductOption,
  FixedRequestProjection,
  SearchLocation,
} from "@/features/passenger-fixed/types";

export async function getSearchLocations() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_search_locations");
  if (error) throw new Error("SEARCH_LOCATIONS_FAILED");
  return (data ?? []) as SearchLocation[];
}

export async function getMobilityOptions(originId: string, destinationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_mobility_options", {
    p_origin_location_id: originId,
    p_destination_location_id: destinationId,
  });
  if (error) throw new Error("MOBILITY_OPTIONS_FAILED");
  return (data ?? []) as FixedProductOption[];
}

export async function getFixedProductDetail(productId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_fixed_product_detail", {
    p_product_id: productId,
  });
  if (error) throw new Error("FIXED_PRODUCT_FAILED");
  return (data ?? null) as FixedProductOption | null;
}

export async function getMyFixedRequest(requestId: string) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "UNAUTHENTICATED" as const, request: null };

  const { data, error } = await supabase.rpc("get_my_fixed_request", {
    p_request_id: requestId,
  });
  if (error) throw new Error("FIXED_REQUEST_FAILED");
  if (!data) return { status: "NOT_FOUND" as const, request: null };
  return { status: "OK" as const, request: data as FixedRequestProjection };
}
