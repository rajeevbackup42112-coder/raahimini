// BACKEND INTEGRATION POINT: Replace all mock data with Supabase RPC calls and read projections

export type TripStatus = 'ACTIVE_COLLECTING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type RequestStatus = 'HELD' | 'CONFIRMED' | 'WITHDRAWN' | 'EXPIRED';
export type SeatState = 'AVAILABLE' | 'HELD' | 'CONFIRMED' | 'DRIVER_CLOSED';

export interface Location {
  id: string;
  name: string;
  active: boolean;
}

export interface Route {
  id: string;
  code: string;
  from_location: string;
  to_location: string;
  direction_label: string;
}

export interface Stop {
  id: string;
  route_id: string;
  stop_order: number;
  name: string;
  minutes_from_prev: number;
}

export interface ActiveCarPublic {
  trip_id: string;
  route_id: string;
  route_code: string;
  route_label: string;
  from_location: string;
  to_location: string;
  driver_display_name: string;
  vehicle_type: string;
  vehicle_model: string;
  vehicle_number: string;
  capacity: number;
  confirmed_count: number;
  held_count: number;
  driver_closed_count: number;
  available_count: number;
  status: TripStatus;
  current_stop_order: number;
  current_stop_name: string;
  stops: StopWithEta[];
}

export interface StopWithEta {
  stop_id: string;
  stop_order: number;
  name: string;
  eta_minutes: number | null;
  is_current: boolean;
  is_passed: boolean;
}

export interface PassengerRequest {
  request_id: string;
  passenger_display_name: string;
  pickup_stop_name: string;
  pickup_stop_order: number;
  seat_count: number;
  status: RequestStatus;
  phone_masked: string;
}

export interface DriverTrip extends ActiveCarPublic {
  departure_eligible: boolean;
  held_count_blocking: number;
  passenger_requests: PassengerRequest[];
}

// ─── LOCATIONS ────────────────────────────────────────────────────────────────
export const LOCATIONS: Location[] = [
  { id: 'loc-gomoh', name: 'Gomoh', active: true },
  { id: 'loc-dhanbad', name: 'Dhanbad', active: true },
];

// ─── ROUTES ───────────────────────────────────────────────────────────────────
export const ROUTES: Route[] = [
  { id: 'route-gd01', code: 'GD-01', from_location: 'Gomoh', to_location: 'Dhanbad', direction_label: 'Gomoh → Dhanbad' },
  { id: 'route-dg01', code: 'DG-01', from_location: 'Dhanbad', to_location: 'Gomoh', direction_label: 'Dhanbad → Gomoh' },
];

// ─── STOPS ────────────────────────────────────────────────────────────────────
export const STOPS_GD01: Stop[] = [
  { id: 'stop-gd-01', route_id: 'route-gd01', stop_order: 1, name: 'Gomoh Station Gate', minutes_from_prev: 0 },
  { id: 'stop-gd-02', route_id: 'route-gd01', stop_order: 2, name: 'Gomoh Chowk', minutes_from_prev: 2 },
  { id: 'stop-gd-03', route_id: 'route-gd01', stop_order: 3, name: 'Bachra Road', minutes_from_prev: 3 },
  { id: 'stop-gd-04', route_id: 'route-gd01', stop_order: 4, name: 'Sijua More', minutes_from_prev: 5 },
  { id: 'stop-gd-05', route_id: 'route-gd01', stop_order: 5, name: 'Dhanbad Bypass', minutes_from_prev: 8 },
  { id: 'stop-gd-06', route_id: 'route-gd01', stop_order: 6, name: 'Dhanbad Station', minutes_from_prev: 7 },
];

export const STOPS_DG01: Stop[] = [
  { id: 'stop-dg-01', route_id: 'route-dg01', stop_order: 1, name: 'Dhanbad Station', minutes_from_prev: 0 },
  { id: 'stop-dg-02', route_id: 'route-dg01', stop_order: 2, name: 'Bank More', minutes_from_prev: 4 },
  { id: 'stop-dg-03', route_id: 'route-dg01', stop_order: 3, name: 'Saraidhela', minutes_from_prev: 6 },
  { id: 'stop-dg-04', route_id: 'route-dg01', stop_order: 4, name: 'Sijua More', minutes_from_prev: 5 },
  { id: 'stop-dg-05', route_id: 'route-dg01', stop_order: 5, name: 'Bachra Road', minutes_from_prev: 4 },
  { id: 'stop-dg-06', route_id: 'route-dg01', stop_order: 6, name: 'Gomoh Station Gate', minutes_from_prev: 6 },
];

// ─── ACTIVE CAR (PUBLIC) ───────────────────────────────────────────────────────
// BACKEND: Replace with get_public_active_car(route_id) RPC
export const MOCK_ACTIVE_CAR_GD01: ActiveCarPublic = {
  trip_id: 'trip-20260816-001',
  route_id: 'route-gd01',
  route_code: 'GD-01',
  route_label: 'Gomoh → Dhanbad',
  from_location: 'Gomoh',
  to_location: 'Dhanbad',
  driver_display_name: 'Ramesh K.',
  vehicle_type: 'Sedan',
  vehicle_model: 'Swift Dzire',
  vehicle_number: 'JH10 AB 4421',
  capacity: 4,
  confirmed_count: 2,
  held_count: 1,
  driver_closed_count: 0,
  available_count: 1,
  status: 'ACTIVE_COLLECTING',
  current_stop_order: 2,
  current_stop_name: 'Gomoh Chowk',
  stops: [
    { stop_id: 'stop-gd-01', stop_order: 1, name: 'Gomoh Station Gate', eta_minutes: null, is_current: false, is_passed: true },
    { stop_id: 'stop-gd-02', stop_order: 2, name: 'Gomoh Chowk', eta_minutes: 0, is_current: true, is_passed: false },
    { stop_id: 'stop-gd-03', stop_order: 3, name: 'Bachra Road', eta_minutes: 3, is_current: false, is_passed: false },
    { stop_id: 'stop-gd-04', stop_order: 4, name: 'Sijua More', eta_minutes: 8, is_current: false, is_passed: false },
    { stop_id: 'stop-gd-05', stop_order: 5, name: 'Dhanbad Bypass', eta_minutes: 16, is_current: false, is_passed: false },
    { stop_id: 'stop-gd-06', stop_order: 6, name: 'Dhanbad Station', eta_minutes: 23, is_current: false, is_passed: false },
  ],
};

// ─── DRIVER TRIP ───────────────────────────────────────────────────────────────
// BACKEND: Replace with get_driver_active_car(driver_id) RPC
export const MOCK_DRIVER_TRIP: DriverTrip = {
  ...MOCK_ACTIVE_CAR_GD01,
  departure_eligible: false,
  held_count_blocking: 1,
  passenger_requests: [
    {
      request_id: 'req-001',
      passenger_display_name: 'Anjali S.',
      pickup_stop_name: 'Gomoh Chowk',
      pickup_stop_order: 2,
      seat_count: 1,
      status: 'CONFIRMED',
      phone_masked: '+91 98××× ×5421',
    },
    {
      request_id: 'req-002',
      passenger_display_name: 'Manoj P.',
      pickup_stop_name: 'Bachra Road',
      pickup_stop_order: 3,
      seat_count: 2,
      status: 'CONFIRMED',
      phone_masked: '+91 70××× ×1893',
    },
    {
      request_id: 'req-003',
      passenger_display_name: 'Priya D.',
      pickup_stop_name: 'Gomoh Chowk',
      pickup_stop_order: 2,
      seat_count: 1,
      status: 'HELD',
      phone_masked: '+91 94××× ×7712',
    },
  ],
};

// ─── PASSENGER REQUEST ─────────────────────────────────────────────────────────
// BACKEND: Replace with get_passenger_ride_status(request_id) RPC
export const MOCK_MY_REQUEST = {
  request_id: 'req-003',
  trip_id: 'trip-20260816-001',
  status: 'HELD' as RequestStatus,
  pickup_stop_name: 'Gomoh Chowk',
  pickup_stop_order: 2,
  seat_count: 1,
  driver_display_name: 'Ramesh K.',
  driver_phone_masked: '+91 98××× ×3301',
  vehicle_number: 'JH10 AB 4421',
  current_stop_name: 'Gomoh Chowk',
  current_stop_order: 2,
  eta_minutes: 0,
  route_label: 'Gomoh → Dhanbad',
};

// ─── ADMIN DATA ────────────────────────────────────────────────────────────────
export const ADMIN_DRIVERS = [
  { id: 'drv-001', name: 'Ramesh Kumar', phone: '+91 98765 43210', vehicle: 'JH10 AB 4421', status: 'active', queue_position: 1, trips_completed: 142, route: 'GD-01' },
  { id: 'drv-002', name: 'Suresh Mahto', phone: '+91 70123 45678', vehicle: 'JH10 CD 7832', status: 'active', queue_position: 2, trips_completed: 98, route: 'GD-01' },
  { id: 'drv-003', name: 'Vikram Singh', phone: '+91 94567 89012', vehicle: 'JH10 EF 1123', status: 'active', queue_position: 3, trips_completed: 77, route: 'GD-01' },
  { id: 'drv-004', name: 'Arun Tiwari', phone: '+91 80012 34567', vehicle: 'JH10 GH 5544', status: 'restricted', queue_position: null, trips_completed: 34, route: 'DG-01' },
  { id: 'drv-005', name: 'Deepak Yadav', phone: '+91 99887 76655', vehicle: 'JH10 IJ 9900', status: 'active', queue_position: 1, trips_completed: 211, route: 'DG-01' },
  { id: 'drv-006', name: 'Sanjay Mishra', phone: '+91 76543 21098', vehicle: 'JH10 KL 3312', status: 'active', queue_position: 2, trips_completed: 56, route: 'DG-01' },
];

export const ADMIN_ACTIVE_TRIPS = [
  { id: 'trip-20260816-001', route: 'GD-01', driver: 'Ramesh Kumar', status: 'ACTIVE_COLLECTING', confirmed: 2, held: 1, available: 1, capacity: 4, started: null },
  { id: 'trip-20260816-002', route: 'DG-01', driver: 'Deepak Yadav', status: 'IN_PROGRESS', confirmed: 4, held: 0, available: 0, capacity: 4, started: '11:32' },
];

export const ADMIN_BEHAVIOUR_EVENTS = [
  { id: 'bev-001', actor: 'Arun Tiwari', role: 'driver', event: 'driver_cancel_after_confirmation', count: 3, last_occurrence: '2026-08-14', action: 'restricted' },
  { id: 'bev-002', actor: 'Priya D.', role: 'passenger', event: 'request_expired', count: 5, last_occurrence: '2026-08-15', action: 'none' },
  { id: 'bev-003', actor: 'Manoj P.', role: 'passenger', event: 'confirmed_no_show', count: 1, last_occurrence: '2026-08-12', action: 'none' },
  { id: 'bev-004', actor: 'Vikram Singh', role: 'driver', event: 'driver_cancel_before_confirmation', count: 1, last_occurrence: '2026-08-10', action: 'none' },
  { id: 'bev-005', actor: 'Suresh Mahto', role: 'driver', event: 'passenger_complaint', count: 1, last_occurrence: '2026-08-09', action: 'none' },
];