export type TravelIntentStatus = "ACTIVE" | "CANCELLED" | "RESOLVED";
export type AcceptableService = "ANY" | "FIXED_ONE_WAY" | "FIXED_ROUND_TRIP" | "OUTSTATION" | "CARPOOL" | "RAAHI_TRIP";

export type TravelIntentView = {
  intent_id: string;
  status: TravelIntentStatus;
  origin_location_id: string;
  origin_name: string;
  destination_location_id: string;
  destination_name: string;
  desired_departure_at: string | null;
  desired_window_end_at: string | null;
  seat_count: number;
  acceptable_service_type: AcceptableService;
  notification_interest: boolean;
  created_at: string;
  resolved_product_id: string | null;
};

export type MarketIntelligenceMarket = { market_id: string; code: string; name: string; status: string; state_code: string };
export type MarketOpportunitySignal = {
  opportunity_id: string; status: string; origin_location_id: string; origin_name: string;
  destination_location_id: string; destination_name: string; intent_count: number; seat_demand: number;
  notification_interest_count: number; desired_next_7d: number; desired_next_30d: number;
  latest_intent_at: string | null; signalled_at: string; reviewed_at: string | null;
};
