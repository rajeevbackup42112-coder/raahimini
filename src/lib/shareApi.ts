'use client';

import { createClient } from '@/lib/supabase/client';

export type SharedTripStop = { name: string; stop_order: number; is_passed: boolean; is_current: boolean };
export type SharedTrip = {
  valid: boolean;
  passenger_name?: string;
  driver_name?: string;
  vehicle_model?: string;
  vehicle_number?: string;
  route_code?: string;
  route_label?: string;
  pickup_point?: string;
  trip_status?: string;
  current_stop_order?: number;
  started_at?: string | null;
  stops?: SharedTripStop[];
  location?: { latitude: number; longitude: number; accuracy_meters: number; captured_at: string; is_fresh: boolean } | null;
  expires_at?: string;
};

export async function createTripShareLink(requestId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('create_trip_share_link', { p_request_id: requestId });
  return error ? { success: false, error: error.message } : data as { success: boolean; token?: string; error?: string };
}

export async function revokeTripShareLink(requestId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('revoke_trip_share_link', { p_request_id: requestId });
  return error ? { success: false, error: error.message } : data as { success: boolean; error?: string };
}

export async function getSharedTrip(token: string): Promise<SharedTrip> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_shared_trip', { p_token: token });
  if (error) return { valid: false };
  return (data as SharedTrip) || { valid: false };
}
