export type OutstationQuoteView = {
  quote_id: string;
  revision_id: string;
  revision_no: number;
  total_price_inr: number;
  includes_tolls: boolean;
  includes_parking: boolean;
  commercial_note: string | null;
  valid_until: string;
  driver_name: string;
  vehicle_model: string;
  vehicle_registration: string;
  vehicle_capacity: number;
  driver_verified: boolean;
};

export type OutstationAgreementView = {
  agreement_id: string;
  agreement_status: string;
  total_price_inr: number;
  accepted_at: string;
  driver_name: string;
  driver_phone: string | null;
  vehicle_model: string;
  vehicle_registration: string;
  ride_id: string;
  ride_status: string;
  driver_verified: boolean;
  vehicle_rc_verified: boolean;
  vehicle_photos_verified: boolean;
};
export type OutstationRequestView = {
  request_id: string;
  product_id: string;
  status: "OPEN" | "REOPENED" | "CONFIRMED" | "CANCELLED" | "EXPIRED" | "COMPLETED";
  travel_type: "ONE_WAY" | "ROUND_TRIP";
  departure_at: string;
  return_at: string | null;
  passenger_count: number;
  passenger_note: string | null;
  destination_text: string;
  origin_name: string;
  destination_name: string;
  recovery_count: number;
  quotes: OutstationQuoteView[];
  accepted_agreement: OutstationAgreementView | null;
};

export type OutstationProduct = {
  product_id: string;
  display_name: string;
  public_summary: string | null;
  market_id: string;
  market_name: string;
};

export type OutstationOwnQuote = {
  quote_id: string;
  status: string;
  current_revision_no: number;
  revision_id: string | null;
  total_price_inr: number | null;
  includes_tolls: boolean | null;
  includes_parking: boolean | null;
  commercial_note: string | null;
  valid_until: string | null;
};
export type OutstationOpportunity = {
  request_id: string;
  product_id: string;
  origin_market_id: string;
  origin_name: string;
  destination_name: string;
  destination_text: string;
  travel_type: "ONE_WAY" | "ROUND_TRIP";
  departure_at: string;
  return_at: string | null;
  passenger_count: number;
  passenger_note: string | null;
  request_status: "OPEN" | "REOPENED";
  own_quote: OutstationOwnQuote | null;
};

export type OutstationDriverProduct = {
  product_id: string;
  product_name: string;
  market_id: string;
  market_name: string;
  is_enabled: boolean;
};

export type PlannedAvailabilityView = {
  availability_id: string;
  market_id: string;
  market_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
};
export type OutstationActiveAgreement = {
  agreement_id: string;
  request_id: string;
  ride_id: string;
  ride_status: string;
  origin_name: string;
  destination_name: string;
  travel_type: "ONE_WAY" | "ROUND_TRIP";
  departure_at: string;
  return_at: string | null;
  passenger_count: number;
  total_price_inr: number;
  vehicle_id: string;
  vehicle_model: string;
  vehicle_registration: string;
  passenger_name: string;
  passenger_phone: string | null;
};

export type OutstationDriverWorkspace = {
  driver_id: string;
  active_vehicle_id: string | null;
  products: OutstationDriverProduct[];
  planned_availability: PlannedAvailabilityView[];
  opportunities: OutstationOpportunity[];
  active_agreements: OutstationActiveAgreement[];
};

export type OutstationPaymentView = {
  payment_id: string;
  status: "DUE" | "PASSENGER_MARKED_PAID" | "DRIVER_CONFIRMED_RECEIVED" | "PAYMENT_DISPUTED";
  amount_inr: number;
  passenger_marked_paid_at: string | null;
  driver_confirmed_received_at: string | null;
  disputed_at: string | null;
  dispute_case_id: string | null;
};

export type OutstationTripView = {
  request_id: string;
  request_status: string;
  agreement_id: string;
  agreement_status: string;
  ride_id: string;
  ride_status: string;
  booking_id: string;
  booking_status: string;
  return_status: string;
  return_not_before: string | null;
  return_boarding_deadline: string | null;
  total_price_inr: number;
  driver_name: string;
  vehicle_model: string;
  vehicle_registration: string;
  payment: OutstationPaymentView | null;
};

export type OutstationDriverTrip = {
  agreement_id: string;
  agreement_status: string;
  request_id: string;
  ride_id: string;
  ride_status: string;
  booking_id: string;
  booking_status: string;
  return_status: string;
  return_not_before: string | null;
  return_boarding_deadline: string | null;
  origin_name: string;
  destination_name: string;
  travel_type: "ONE_WAY" | "ROUND_TRIP";
  departure_at: string;
  return_at: string | null;
  passenger_count: number;
  total_price_inr: number;
  vehicle_model: string;
  vehicle_registration: string;
  passenger_name: string;
  passenger_phone: string | null;
  payment: OutstationPaymentView | null;
};
