export type FixedDriverProduct = {
  product_id: string;
  product_code: string;
  display_name: string;
  origin_name: string;
  destination_name: string;
  preference_enabled: boolean;
  queued_request_count: number;
  queued_seat_count: number;
  oldest_queued_at: string | null;
  availability_id: string | null;
  availability_status: "QUEUED" | "RESERVED" | null;
  availability_queued_at: string | null;
};

export type FixedDriverWorkspace = {
  driver_id: string;
  standing: string;
  operating_market_id: string | null;
  active_vehicle_id: string | null;
  active_vehicle_name: string | null;
  products: FixedDriverProduct[];
};

export type DriverPreferenceResult = {
  product_id: string;
  is_enabled: boolean;
};
export type DriverAvailabilityResult = {
  availability_id: string;
  product_id?: string;
  vehicle_id?: string;
  status: "QUEUED" | "WITHDRAWN" | "INELIGIBLE";
  queued_at?: string;
  exited_at?: string | null;
};

type ApiFailure = { ok: false; code: string; message: string; correlationId: string };
export type PreferenceApiResponse =
  | { ok: true; value: DriverPreferenceResult; correlationId: string }
  | ApiFailure;
export type AvailabilityApiResponse =
  | { ok: true; value: DriverAvailabilityResult; correlationId: string }
  | ApiFailure;
export type FixedDriverAssignmentGroup = {
  display_name: string;
  seat_count: number;
};

export type FixedDriverAssignment = {
  ride_id: string;
  status: string;
  matched_at: string;
  driver_ack_deadline: string;
  origin_name: string;
  destination_name: string;
  vehicle_model: string;
  vehicle_registration: string;
  booked_seat_count: number;
  capacity: number;
  passenger_groups: FixedDriverAssignmentGroup[];
};