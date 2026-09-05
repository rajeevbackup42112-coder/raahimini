export type SearchLocation = {
  location_id: string;
  code: string;
  name: string;
  kind: string;
  market_id: string | null;
};

export type FixedProductOption = {
  product_id: string;
  product_code: string;
  service_type: "FIXED_ONE_WAY";
  display_name: string;
  public_summary: string | null;
  origin_location_id: string;
  origin_name: string;
  destination_location_id: string;
  destination_name: string;
  fare_per_seat_inr: number;
  max_seats_per_request: number;
  currency: "INR";
  rules_version: number;
};

export type FixedRequestProjection = {
  request_id: string;
  product_id: string;
  status: "QUEUED" | "RESERVED" | "ASSIGNED" | "PASSENGER_CANCELLED" | "SUPERSEDED";
  seat_count: number;
  fare_per_seat_inr: number;
  total_fare_inr: number;
  queued_at: string;
  cancelled_at: string | null;
  origin_name: string;
  destination_name: string;
  product_name: string;
  rules_version: number;
};

export type JoinFixedResult = {
  request_id: string;
  product_id: string;
  status: "QUEUED";
  seat_count: number;
  fare_per_seat_inr: number;
  total_fare_inr: number;
  queued_at: string;
  rules_version: number;
};
