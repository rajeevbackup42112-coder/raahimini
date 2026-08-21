'use client';

import { createClient } from '@/lib/supabase/client';

export type TripStatus = 'ACTIVE_COLLECTING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type RequestStatus = 'HELD' | 'CONFIRMED' | 'WITHDRAWN' | 'EXPIRED' | 'MISSED' | 'DRIVER_CANCELLED';

export interface Location { id: string; name: string; state: string; is_active: boolean; }
export interface RouteForLocation { route_id: string; route_code: string; from_location_name: string; to_location_name: string; direction_label: string; has_active_car: boolean; active_car_status: TripStatus | null; available_seats: number; }
export interface DriverDepartingRoute { route_id: string; route_code: string; from_location_id: string; from_location_name: string; to_location_id: string; to_location_name: string; direction_label: string; has_active_car: boolean; available_seats: number; waiting_drivers: number; }
export interface DriverHomeContext { driver_id?: string; vehicle_id?: string; has_active_trip?: boolean; active_trip_id?: string; active_trip_status?: 'ACTIVE_COLLECTING'|'IN_PROGRESS'; active_trip_route_id?: string; active_trip_route_label?: string; has_live_queue?: boolean; queue_id?: string; queue_status?: 'WAITING'|'ACTIVE_COLLECTING'; queue_position?: number; queue_route_id?: string; queue_route_label?: string; suggested_location_id?: string; suggested_location_name?: string; error?: string; }
export interface DriverCancelledRequest { has_driver_cancelled_request: boolean; request_id?: string; trip_id?: string; route_id?: string; route_label?: string; seat_count?: number; pickup_stop_name?: string; driver_display_name?: string; driver_phone?: string; vehicle_number?: string; cancelled_at?: string; error?: string; }
export interface StopWithEta { stop_id: string; stop_order: number; name: string; is_current: boolean; is_passed: boolean; eta_minutes: number | null; }
export interface ActiveCarPublic { has_active_car: boolean; trip_id?: string; route_id?: string; status?: TripStatus; driver_display_name?: string; vehicle_type?: string; vehicle_model?: string; vehicle_number?: string; capacity?: number; confirmed_count?: number; held_count?: number; driver_closed_count?: number; available_count?: number; fare_per_seat?: number; current_stop_order?: number; current_stop_name?: string; stops?: StopWithEta[]; }
export interface PassengerRideStatus { has_active_request?: boolean; has_completed_trip?: boolean; request_id: string; trip_id: string; status: RequestStatus; pickup_stop_name: string; pickup_stop_order: number; seat_count: number; driver_display_name: string; driver_phone: string; vehicle_number: string; current_stop_name: string; current_stop_order: number; eta_minutes: number; trip_status: TripStatus; stops?: StopWithEta[]; }
export interface PassengerRequest { request_id: string; passenger_display_name: string; phone_masked: string; pickup_stop_name: string; pickup_stop_order: number; seat_count: number; status: RequestStatus; }
export interface DriverActiveTrip { has_active_trip: boolean; trip_id?: string; route_id?: string; route_code?: string; route_label?: string; from_location?: string; to_location?: string; status?: TripStatus; vehicle_type?: string; vehicle_model?: string; vehicle_number?: string; capacity?: number; confirmed_count?: number; held_count?: number; driver_closed_count?: number; available_count?: number; current_stop_order?: number; current_stop_name?: string; departure_eligible?: boolean; fare_per_seat?: number; passenger_requests?: PassengerRequest[]; stops?: StopWithEta[]; }
export interface RpcResult { success: boolean; error?: string; [key: string]: any; }

const rpc = async (name: string, args: Record<string, any> = {}) => { const supabase = createClient(); return supabase.rpc(name, args); };

export async function getActiveLocations(): Promise<Location[]> { const {data,error}=await rpc('get_active_locations'); if(error){console.error(error.message);return [];} return data||[]; }
export async function getRoutesForLocation(locationId:string):Promise<RouteForLocation[]>{const{data,error}=await rpc('get_routes_for_location',{p_location_id:locationId});if(error){console.error(error.message);return [];}return data||[];}
export async function getPublicActiveCar(routeId:string):Promise<ActiveCarPublic>{const{data,error}=await rpc('get_public_active_car',{p_route_id:routeId});if(error){console.error(error.message);return{has_active_car:false};}return(data as ActiveCarPublic)||{has_active_car:false};}
export async function getDriverQueueStatus(routeId:string){const{data,error}=await rpc('get_driver_queue_status',{p_route_id:routeId});if(error){console.error(error.message);return [];}return data||[];}
export async function getPassengerRideStatus(requestId:string):Promise<PassengerRideStatus|null>{const{data,error}=await rpc('get_passenger_ride_status',{p_request_id:requestId});if(error){console.error(error.message);return null;}return data as PassengerRideStatus;}
export async function getMyActiveRequest():Promise<PassengerRideStatus|null>{const{data,error}=await rpc('get_my_active_request');if(error){console.error(error.message);return null;}return data as any;}
export async function getMyDriverCancelledRequest():Promise<DriverCancelledRequest>{const{data,error}=await rpc('get_my_driver_cancelled_request');if(error)return{has_driver_cancelled_request:false,error:error.message};return(data as DriverCancelledRequest)||{has_driver_cancelled_request:false};}
export async function getDriverActiveCar():Promise<DriverActiveTrip>{const{data,error}=await rpc('get_driver_active_car');if(error){console.error(error.message);return{has_active_trip:false};}return(data as DriverActiveTrip)||{has_active_trip:false};}
export async function getDriverHomeContext():Promise<DriverHomeContext>{const{data,error}=await rpc('get_driver_home_context');if(error)return{error:error.message};return(data as DriverHomeContext)||{};}
export async function getDriverDepartingRoutes(locationId:string):Promise<DriverDepartingRoute[]>{const{data,error}=await rpc('get_driver_departing_routes',{p_location_id:locationId});if(error){console.error(error.message);return [];}return data||[];}

export async function requestSeats(tripId:string,pickupStopId:string,seatCount:number):Promise<RpcResult>{const{data,error}=await rpc('request_seats',{p_trip_id:tripId,p_pickup_stop_id:pickupStopId,p_seat_count:seatCount});return error?{success:false,error:error.message}:data as RpcResult;}
export async function withdrawSeatRequest(requestId:string):Promise<RpcResult>{const{data,error}=await rpc('withdraw_seat_request',{p_request_id:requestId});return error?{success:false,error:error.message}:data as RpcResult;}
export async function driverConfirmPayment(requestId:string):Promise<RpcResult>{const{data,error}=await rpc('driver_confirm_payment',{p_request_id:requestId});return error?{success:false,error:error.message}:data as RpcResult;}
export async function driverMarkPassengerAbsent(requestId:string):Promise<RpcResult>{const{data,error}=await rpc('driver_mark_passenger_absent',{p_request_id:requestId});return error?{success:false,error:error.message}:data as RpcResult;}
export async function driverAdvanceStop(tripId:string):Promise<RpcResult>{const{data,error}=await rpc('driver_advance_stop',{p_trip_id:tripId});return error?{success:false,error:error.message}:data as RpcResult;}
export async function driverCloseEmptySeats(tripId:string):Promise<RpcResult>{const{data,error}=await rpc('driver_close_empty_seats',{p_trip_id:tripId});return error?{success:false,error:error.message}:data as RpcResult;}
export async function startTrip(tripId:string):Promise<RpcResult>{const{data,error}=await rpc('start_trip',{p_trip_id:tripId});return error?{success:false,error:error.message}:data as RpcResult;}
export async function completeTrip(tripId:string):Promise<RpcResult>{const{data,error}=await rpc('complete_trip',{p_trip_id:tripId});return error?{success:false,error:error.message}:data as RpcResult;}
export async function driverCancelTrip(tripId:string):Promise<RpcResult>{const{data,error}=await rpc('driver_cancel_trip',{p_trip_id:tripId});return error?{success:false,error:error.message}:data as RpcResult;}
export async function joinDriverQueue(routeId:string,currentLocationId:string):Promise<RpcResult>{const{data,error}=await rpc('join_driver_queue',{p_route_id:routeId,p_current_location_id:currentLocationId});return error?{success:false,error:error.message}:data as RpcResult;}
export async function leaveDriverQueue(routeId:string):Promise<RpcResult>{const{data,error}=await rpc('leave_driver_queue',{p_route_id:routeId});return error?{success:false,error:error.message}:data as RpcResult;}
export async function passengerReportRefundProblem(requestId:string):Promise<RpcResult>{const{data,error}=await rpc('passenger_report_refund_problem',{p_request_id:requestId});return error?{success:false,error:error.message}:data as RpcResult;}

export async function adminRestrictUser(userId:string,reason:string):Promise<RpcResult>{const{data,error}=await rpc('admin_restrict_user',{p_user_id:userId,p_reason:reason});return error?{success:false,error:error.message}:data as RpcResult;}
export async function adminUnrestrictUser(userId:string):Promise<RpcResult>{const{data,error}=await rpc('admin_unrestrict_user',{p_user_id:userId});return error?{success:false,error:error.message}:data as RpcResult;}
export async function adminGetActiveTrips(){const{data,error}=await rpc('admin_get_active_trips');if(error){console.error(error.message);return [];}return data||[];}
export async function adminGetBehaviourEvents(limit=50){const{data,error}=await rpc('admin_get_behaviour_events',{p_limit:limit});if(error){console.error(error.message);return [];}return data||[];}

export async function adminGetLocations(){const supabase=createClient();const{data,error}=await supabase.from('locations').select('*').order('name',{ascending:true});if(error){console.error(error.message);return [];}return data||[];}
export async function adminGetRoutes(){const supabase=createClient();const{data,error}=await supabase.from('routes').select(`*,from_location:locations!routes_from_location_id_fkey(name),to_location:locations!routes_to_location_id_fkey(name),route_stops(*)`).order('code',{ascending:true});if(error){console.error(error.message);return [];}return data||[];}
export async function adminGetDrivers(){const supabase=createClient();const{data,error}=await supabase.from('drivers').select(`*,vehicles(registration_number, vehicle_model),profiles(is_restricted, restriction_reason)`).order('display_name',{ascending:true});if(error){console.error(error.message);return [];}return data||[];}
export async function adminGetDriverQueue(routeId:string){return getDriverQueueStatus(routeId);}
