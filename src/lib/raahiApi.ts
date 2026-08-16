'use client';

import { createClient } from '@/lib/supabase/client';

// ─── TYPES ────────────────────────────────────────────────────────────────────
export type TripStatus = 'ACTIVE_COLLECTING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type RequestStatus = 'HELD' | 'CONFIRMED' | 'WITHDRAWN' | 'EXPIRED' | 'MISSED';

export interface Location {
  id: string;
  name: string;
  state: string;
  is_active: boolean;
}

export interface RouteForLocation {
  route_id: string;
  route_code: string;
  from_location_name: string;
  to_location_name: string;
  direction_label: string;
  has_active_car: boolean;
  active_car_status: TripStatus | null;
  available_seats: number;
}

export interface StopWithEta {
  stop_id: string;
  stop_order: number;
  name: string;
  is_current: boolean;
  is_passed: boolean;
  eta_minutes: number | null;
}

export interface ActiveCarPublic {
  has_active_car: boolean;
  trip_id?: string;
  route_id?: string;
  status?: TripStatus;
  driver_display_name?: string;
  vehicle_type?: string;
  vehicle_model?: string;
  vehicle_number?: string;
  capacity?: number;
  confirmed_count?: number;
  held_count?: number;
  driver_closed_count?: number;
  available_count?: number;
  current_stop_order?: number;
  current_stop_name?: string;
  stops?: StopWithEta[];
}

export interface PassengerRideStatus {
  has_active_request?: boolean;
  request_id: string;
  trip_id: string;
  status: RequestStatus;
  pickup_stop_name: string;
  pickup_stop_order: number;
  seat_count: number;
  driver_display_name: string;
  driver_phone: string;
  vehicle_number: string;
  current_stop_name: string;
  current_stop_order: number;
  eta_minutes: number;
  trip_status: TripStatus;
  stops?: StopWithEta[];
}

export interface PassengerRequest {
  request_id: string;
  passenger_display_name: string;
  phone_masked: string;
  pickup_stop_name: string;
  pickup_stop_order: number;
  seat_count: number;
  status: RequestStatus;
}

export interface DriverActiveTrip {
  has_active_trip: boolean;
  trip_id?: string;
  route_id?: string;
  route_code?: string;
  route_label?: string;
  from_location?: string;
  to_location?: string;
  status?: TripStatus;
  vehicle_type?: string;
  vehicle_model?: string;
  vehicle_number?: string;
  capacity?: number;
  confirmed_count?: number;
  held_count?: number;
  driver_closed_count?: number;
  available_count?: number;
  current_stop_order?: number;
  current_stop_name?: string;
  departure_eligible?: boolean;
  passenger_requests?: PassengerRequest[];
  stops?: StopWithEta[];
}

export interface RpcResult {
  success: boolean;
  error?: string;
  [key: string]: any;
}

// ─── PUBLIC READ PROJECTIONS ──────────────────────────────────────────────────

export async function getActiveLocations(): Promise<Location[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_active_locations');
  if (error) {
    console.error('getActiveLocations error:', error.message);
    return [];
  }
  return data || [];
}

export async function getRoutesForLocation(locationId: string): Promise<RouteForLocation[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_routes_for_location', {
    p_location_id: locationId,
  });
  if (error) {
    console.error('getRoutesForLocation error:', error.message);
    return [];
  }
  return data || [];
}

export async function getPublicActiveCar(routeId: string): Promise<ActiveCarPublic> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_public_active_car', {
    p_route_id: routeId,
  });
  if (error) {
    console.error('getPublicActiveCar error:', error.message);
    return { has_active_car: false };
  }
  return (data as ActiveCarPublic) || { has_active_car: false };
}

export async function getDriverQueueStatus(routeId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_driver_queue_status', {
    p_route_id: routeId,
  });
  if (error) {
    console.error('getDriverQueueStatus error:', error.message);
    return [];
  }
  return data || [];
}

// ─── AUTHENTICATED READ PROJECTIONS ──────────────────────────────────────────

export async function getPassengerRideStatus(requestId: string): Promise<PassengerRideStatus | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_passenger_ride_status', {
    p_request_id: requestId,
  });
  if (error) {
    console.error('getPassengerRideStatus error:', error.message);
    return null;
  }
  return data as PassengerRideStatus;
}

export async function getMyActiveRequest(): Promise<(PassengerRideStatus & { has_active_request: boolean }) | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_my_active_request');
  if (error) {
    console.error('getMyActiveRequest error:', error.message);
    return null;
  }
  return data as any;
}

export async function getDriverActiveCar(): Promise<DriverActiveTrip> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_driver_active_car');
  if (error) {
    console.error('getDriverActiveCar error:', error.message);
    return { has_active_trip: false };
  }
  return (data as DriverActiveTrip) || { has_active_trip: false };
}

// ─── CANONICAL RPC COMMANDS ───────────────────────────────────────────────────

export async function requestSeats(
  tripId: string,
  pickupStopId: string,
  seatCount: number
): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('request_seats', {
    p_trip_id: tripId,
    p_pickup_stop_id: pickupStopId,
    p_seat_count: seatCount,
  });
  if (error) return { success: false, error: error.message };
  return data as RpcResult;
}

export async function withdrawSeatRequest(requestId: string): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('withdraw_seat_request', {
    p_request_id: requestId,
  });
  if (error) return { success: false, error: error.message };
  return data as RpcResult;
}

export async function driverConfirmPayment(requestId: string): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('driver_confirm_payment', {
    p_request_id: requestId,
  });
  if (error) return { success: false, error: error.message };
  return data as RpcResult;
}

export async function driverMarkPassengerAbsent(requestId: string): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('driver_mark_passenger_absent', {
    p_request_id: requestId,
  });
  if (error) return { success: false, error: error.message };
  return data as RpcResult;
}

export async function driverAdvanceStop(tripId: string): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('driver_advance_stop', {
    p_trip_id: tripId,
  });
  if (error) return { success: false, error: error.message };
  return data as RpcResult;
}

export async function driverCloseEmptySeats(tripId: string): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('driver_close_empty_seats', {
    p_trip_id: tripId,
  });
  if (error) return { success: false, error: error.message };
  return data as RpcResult;
}

export async function startTrip(tripId: string): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('start_trip', {
    p_trip_id: tripId,
  });
  if (error) return { success: false, error: error.message };
  return data as RpcResult;
}

export async function completeTrip(tripId: string): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('complete_trip', {
    p_trip_id: tripId,
  });
  if (error) return { success: false, error: error.message };
  return data as RpcResult;
}

export async function driverCancelTrip(tripId: string): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('driver_cancel_trip', {
    p_trip_id: tripId,
  });
  if (error) return { success: false, error: error.message };
  return data as RpcResult;
}

export async function joinDriverQueue(routeId: string): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('join_driver_queue', {
    p_route_id: routeId,
  });
  if (error) return { success: false, error: error.message };
  return data as RpcResult;
}

export async function leaveDriverQueue(routeId: string): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('leave_driver_queue', {
    p_route_id: routeId,
  });
  if (error) return { success: false, error: error.message };
  return data as RpcResult;
}

// ─── ADMIN RPCs ───────────────────────────────────────────────────────────────

export async function adminRestrictUser(userId: string, reason: string): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_restrict_user', {
    p_user_id: userId,
    p_reason: reason,
  });
  if (error) return { success: false, error: error.message };
  return data as RpcResult;
}

export async function adminUnrestrictUser(userId: string): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_unrestrict_user', {
    p_user_id: userId,
  });
  if (error) return { success: false, error: error.message };
  return data as RpcResult;
}

export async function adminGetActiveTrips() {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_get_active_trips');
  if (error) {
    console.error('adminGetActiveTrips error:', error.message);
    return [];
  }
  return data || [];
}

export async function adminGetBehaviourEvents(limit = 50) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_get_behaviour_events', { p_limit: limit });
  if (error) {
    console.error('adminGetBehaviourEvents error:', error.message);
    return [];
  }
  return data || [];
}

// ─── DIRECT TABLE READS (for admin management) ────────────────────────────────

export async function adminGetLocations() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('name', { ascending: true });
  if (error) { console.error(error.message); return []; }
  return data || [];
}

export async function adminGetRoutes() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('routes')
    .select(`
      *,
      from_location:locations!routes_from_location_id_fkey(name),
      to_location:locations!routes_to_location_id_fkey(name),
      route_stops(*)
    `)
    .order('code', { ascending: true });
  if (error) { console.error(error.message); return []; }
  return data || [];
}

export async function adminGetDrivers() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('drivers')
    .select(`
      *,
      vehicles(registration_number, vehicle_model),
      routes(code),
      profiles(is_restricted, restriction_reason)
    `)
    .order('display_name', { ascending: true });
  if (error) { console.error(error.message); return []; }
  return data || [];
}

export async function adminGetDriverQueue(routeId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_driver_queue_status', {
    p_route_id: routeId,
  });
  if (error) { console.error(error.message); return []; }
  return data || [];
}
