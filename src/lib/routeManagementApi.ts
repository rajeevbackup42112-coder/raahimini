'use client';

import { createClient } from '@/lib/supabase/client';

export type RouteVersionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export interface AdminRouteStop {
  stop_id?: string;
  stop_order: number;
  name: string;
  minutes_from_prev: number;
}
export interface AdminRouteVersion {
  route_id: string;
  route_family_id: string;
  version_no: number;
  version_status: RouteVersionStatus;
  is_current: boolean;
  code: string;
  direction_label: string;
  from_location_id: string;
  from_location_name: string;
  to_location_id: string;
  to_location_name: string;
  is_active: boolean;
  fare_per_seat: number;
  supersedes_route_id?: string | null;
  published_at?: string | null;
  archived_at?: string | null;
  stop_count: number;
  stops: AdminRouteStop[];
  live_trip_count: number;
  live_queue_count: number;
  active_demand_count: number;
}

type Result = { success: boolean; error?: string; [key: string]: unknown };
const rpc = async (name: string, args: Record<string, unknown> = {}) => {
  const supabase = createClient();
  return supabase.rpc(name, args);
};

export async function adminListRouteVersions(): Promise<AdminRouteVersion[]> {
  const { data, error } = await rpc('admin_list_route_versions');
  if (error) throw new Error(error.message);
  return (data || []) as AdminRouteVersion[];
}

export async function adminCreateRouteDraft(baseRouteId: string): Promise<Result> {
  const { data, error } = await rpc('admin_create_route_draft', { p_base_route_id: baseRouteId });
  return error ? { success: false, error: error.message } : data as Result;
}
export async function adminCreateNewRouteDraft(input: { code: string; fromLocationId: string; toLocationId: string; directionLabel: string; farePerSeat: number }): Promise<Result> {
  const { data, error } = await rpc('admin_create_new_route_draft', {
    p_code: input.code, p_from_location_id: input.fromLocationId, p_to_location_id: input.toLocationId,
    p_direction_label: input.directionLabel, p_fare_per_seat: input.farePerSeat,
  });
  return error ? { success: false, error: error.message } : data as Result;
}

export async function adminDuplicateRouteAsDraft(baseRouteId: string, newCode: string): Promise<Result> {
  const { data, error } = await rpc('admin_duplicate_route_as_draft', { p_base_route_id: baseRouteId, p_new_code: newCode });
  return error ? { success: false, error: error.message } : data as Result;
}

export async function adminUpdateRouteDraft(input: { routeId: string; code: string; fromLocationId: string; toLocationId: string; directionLabel: string; farePerSeat: number }): Promise<Result> {
  const { data, error } = await rpc('admin_update_route_draft', {
    p_route_id: input.routeId, p_code: input.code, p_from_location_id: input.fromLocationId,
    p_to_location_id: input.toLocationId, p_direction_label: input.directionLabel, p_fare_per_seat: input.farePerSeat,
  });
  return error ? { success: false, error: error.message } : data as Result;
}

export async function adminReplaceRouteDraftStops(routeId: string, stops: AdminRouteStop[]): Promise<Result> {
  const payload = stops.map((s) => ({ name: s.name, minutes_from_prev: s.minutes_from_prev }));
  const { data, error } = await rpc('admin_replace_route_draft_stops', { p_route_id: routeId, p_stops: payload });
  return error ? { success: false, error: error.message } : data as Result;
}
export async function adminPublishRouteDraft(routeId: string): Promise<Result> {
  const { data, error } = await rpc('admin_publish_route_draft', { p_route_id: routeId });
  return error ? { success: false, error: error.message } : data as Result;
}
export async function adminDiscardRouteDraft(routeId: string): Promise<Result> {
  const { data, error } = await rpc('admin_discard_route_draft', { p_route_id: routeId });
  return error ? { success: false, error: error.message } : data as Result;
}
export async function adminArchiveRoute(routeId: string): Promise<Result> {
  const { data, error } = await rpc('admin_archive_route', { p_route_id: routeId });
  return error ? { success: false, error: error.message } : data as Result;
}
export async function adminSetCurrentRouteActive(routeId: string, isActive: boolean): Promise<Result> {
  const { data, error } = await rpc('admin_set_route_active', { p_route_id: routeId, p_is_active: isActive });
  return error ? { success: false, error: error.message } : data as Result;
}
export async function adminSetCurrentRouteFare(routeId: string, farePerSeat: number): Promise<Result> {
  const { data, error } = await rpc('admin_set_route_fare', { p_route_id: routeId, p_fare_per_seat: farePerSeat });
  return error ? { success: false, error: error.message } : data as Result;
}
