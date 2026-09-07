import type { PaymentStatus } from "@/features/payment-support/types";

export type TripTrust = {
  driver_verified: boolean;
  driver_photo_verified: boolean;
  vehicle_rc_verified: boolean;
  vehicle_photos_verified: boolean;
};

export type TripProduct = {
  product_id: string;
  product_name: string;
  market_id: string;
  market_name: string;
  rules_version: number;
  max_seats_per_booking: number;
};

export type TripLocation = {
  location_id: string;
  name: string;
  market_id: string;
  market_name: string;
};

export type TripCatalog = { products: TripProduct[]; locations: TripLocation[] };

export type TripDiscoveryItem = {
  offering_id: string;
  product_id: string;
  status: string;
  display_status: string;
  origin_location_id: string;
  origin_name: string;
  destination_location_id: string;
  destination_name: string;
  departure_at: string;
  return_departure_at: string;
  offered_seats: number;
  booked_seats: number;
  seats_left: number;
  price_per_seat_inr: number;
  min_confirmation_seats: number;
  confirmation_deadline: string;
  seats_needed_to_confirm: number;
  itinerary_context: string | null;
  driver_name: string;
  vehicle_model: string;
  vehicle_registration: string;
  trust: TripTrust;
};

export type TripPayment = {
  payment_id: string;
  status: PaymentStatus;
  amount_inr: number;
  passenger_marked_paid_at: string | null;
  driver_confirmed_received_at: string | null;
  disputed_at: string | null;
  dispute_case_id: string | null;
};

export type MyTripBooking = {
  trip_booking_id: string;
  ride_booking_id: string | null;
  status: string;
  seat_count: number;
  price_per_seat_inr: number;
  total_inr: number;
  booked_at: string;
  payment: TripPayment | null;
};
export type TripOfferingView = TripDiscoveryItem & {
  commitment_id: string | null;
  ride_id: string | null;
  ride_status: string | null;
  driver_phone: string | null;
  my_booking: MyTripBooking | null;
};

export type DriverTripBooking = {
  trip_booking_id: string;
  ride_booking_id: string | null;
  ride_booking_status: string | null;
  return_status: string | null;
  status: string;
  seat_count: number;
  price_per_seat_inr: number;
  passenger_name: string;
  passenger_phone: string | null;
  payment: TripPayment | null;
};

export type DriverTripOffering = {
  offering_id: string;
  product_id: string;
  status: string;
  display_status: string;
  origin_location_id: string;
  origin_name: string;
  destination_location_id: string;
  destination_name: string;
  departure_at: string;
  return_departure_at: string;
  offered_seats: number;
  booked_seats: number;
  seats_left: number;
  price_per_seat_inr: number;
  min_confirmation_seats: number;
  confirmation_deadline: string;
  seats_needed_to_confirm: number;
  itinerary_context: string | null;
  commitment_id: string | null;
  ride_id: string | null;
  ride_status: string | null;
  bookings: DriverTripBooking[];
};

export type DriverTripWorkspace = {
  catalog: TripCatalog;
  operating_market_id: string | null;
  active_vehicle_id: string | null;
  active_vehicle: {
    vehicle_id: string;
    model: string;
    registration: string;
    capacity: number;
  } | null;
  offerings: DriverTripOffering[];
};
