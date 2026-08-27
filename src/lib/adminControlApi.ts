'use client';

import { createClient } from '@/lib/supabase/client';

export interface AdminDashboardSummary {
  active_trips: number;
  collecting_cars: number;
  held_requests: number;
  held_seats: number;
  waiting_drivers: number;
  open_support_cases: number;
  operational_warnings: number;
}

export interface RegisteredUser {
  profile_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  phone_verified: boolean;
  role: 'passenger' | 'driver' | 'admin' | string;
  is_restricted: boolean;
  restriction_reason: string | null;
  joined_at: string;
  driver_id: string | null;
  driver_active: boolean | null;
  driver_phone: string | null;
  trips_completed: number;
  registration_number: string | null;
  vehicle_model: string | null;
  vehicle_type: string | null;
  capacity: number | null;
  operational_state: string;
}

export interface AdminRecentActivity {
  activity_id: string;
  action: string;
  actor_name: string;
  record_id: string | null;
  created_at: string;
}

export async function adminGetDashboardSummary(): Promise<AdminDashboardSummary> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_get_dashboard_summary');
  if (error) throw new Error(error.message);
  return (data || {}) as AdminDashboardSummary;
}

export async function adminListRegisteredUsers(): Promise<RegisteredUser[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_list_registered_users');
  if (error) throw new Error(error.message);
  return (data || []) as RegisteredUser[];
}

export async function adminGetRecentActivity(limit = 12): Promise<AdminRecentActivity[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_get_recent_activity', { p_limit: limit });
  if (error) throw new Error(error.message);
  return (data || []) as AdminRecentActivity[];
}

export interface AdminLiveTripOperation {
  trip_id: string;
  route_id: string;
  route_code: string;
  route_label: string;
  trip_status: 'ACTIVE_COLLECTING' | 'IN_PROGRESS' | string;
  driver_id: string;
  driver_name: string;
  vehicle_number: string;
  confirmed: number;
  held: number;
  driver_closed: number;
  available: number;
  capacity: number;
  current_stop_name: string | null;
  next_action: string;
  next_stop_name: string | null;
  started_at: string | null;
  created_at: string;
  gps_state: 'FRESH' | 'STALE' | 'POOR_ACCURACY' | 'MISSING' | string;
  gps_age_seconds: number | null;
  gps_accuracy_meters: number | null;
  gps_captured_at: string | null;
  open_support_cases: number;
}

export async function adminGetLiveTripOperations(): Promise<AdminLiveTripOperation[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_get_live_trip_operations');
  if (error) throw new Error(error.message);
  return (data || []) as AdminLiveTripOperation[];
}
