import type { PaymentStatus } from "@/features/payment-support/types";

export type CarpoolTrust = {
  driver_verified: boolean;
  driver_photo_verified: boolean;
  vehicle_rc_verified: boolean;
  vehicle_photos_verified: boolean;
};

export type CarpoolProduct = {
  product_id: string;
  product_name: string;
  market_id: string;
  market_name: string;
  rules_version: number;
  max_seats_per_booking: number;
};

export type CarpoolLocation = {
  location_id: string;
  name: string;
  market_id: string;
  market_name: string;
};

export type CarpoolCatalog = { products: CarpoolProduct[]; locations: CarpoolLocation[] };

export type CarpoolDiscoveryItem = {
  journey_id: string;
  product_id: string;
  status: string;
  origin_location_id: string;
  origin_name: string;
  destination_location_id: string;
  destination_name: string;
  departure_at: string;
  offered_seats: number;
  booked_seats: number;
  seats_left: number;
  contribution_per_seat_inr: number;
  driver_name: string;
  vehicle_model: string;
  vehicle_registration: string;
  trust: CarpoolTrust;
};

export type CarpoolPayment = {
  payment_id: string;
  status: PaymentStatus;
  amount_inr: number;
  passenger_marked_paid_at: string | null;
  driver_confirmed_received_at: string | null;
  disputed_at: string | null;
  dispute_case_id?: string | null;
};

export type MyCarpoolBooking = {
  carpool_booking_id: string;
  ride_booking_id: string;
  status: string;
  seat_count: number;
  contribution_per_seat_inr: number;
  total_inr: number;
  booked_at: string;
  payment: CarpoolPayment | null;
};

export type CarpoolPendingChange = {
  proposal_id: string;
  version_no: number;
  proposed_destination_location_id: string;
  proposed_destination_name: string;
  proposed_departure_at: string;
  status: string;
  my_response?: string | null;
  created_at: string;
  pending_responses?: number;
};

export type CarpoolJourneyView = CarpoolDiscoveryItem & {
  ride_id: string | null;
  ride_status: string | null;
  driver_phone: string | null;
  my_booking: MyCarpoolBooking | null;
  pending_change: CarpoolPendingChange | null;
};

export type DriverCarpoolBooking = {
  carpool_booking_id: string;
  ride_booking_id: string;
  status: string;
  seat_count: number;
  contribution_per_seat_inr: number;
  passenger_name: string;
  passenger_phone: string | null;
  payment: CarpoolPayment | null;
};

export type DriverCarpoolJourney = {
  journey_id: string;
  product_id: string;
  status: string;
  origin_location_id: string;
  origin_name: string;
  destination_location_id: string;
  destination_name: string;
  departure_at: string;
  offered_seats: number;
  booked_seats: number;
  seats_left: number;
  contribution_per_seat_inr: number;
  commitment_id: string | null;
  ride_id: string | null;
  ride_status: string | null;
  current_change_version: number;
  pending_change: CarpoolPendingChange | null;
  bookings: DriverCarpoolBooking[];
};

export type DriverCarpoolWorkspace = {
  catalog: CarpoolCatalog;
  active_vehicle_id: string | null;
  active_vehicle: { vehicle_id: string; model: string; registration: string; capacity: number } | null;
  journeys: DriverCarpoolJourney[];
};
