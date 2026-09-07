export const travelIntentMessages: Record<string, [number, string]> = {
  PASSENGER_CAPABILITY_REQUIRED: [403, "Passenger access is required."],
  TRAVEL_INTENT_ORIGIN_INVALID: [422, "Choose a valid origin."],
  TRAVEL_INTENT_DESTINATION_INVALID: [422, "Choose a valid destination."],
  TRAVEL_INTENT_SAME_LOCATION: [422, "Origin and destination must be different."],
  TRAVEL_INTENT_SEAT_COUNT_INVALID: [422, "Choose a valid group size."],
  TRAVEL_INTENT_SERVICE_INVALID: [422, "Choose a valid service preference."],
  TRAVEL_INTENT_WINDOW_INVALID: [422, "The travel time window is invalid."],
  TRAVEL_INTENT_RATE_LIMITED: [429, "You have created several travel interests recently. Please try again later."],
  TRAVEL_INTENT_NOT_FOUND: [404, "Travel interest not found."],
  TRAVEL_INTENT_NOT_CANCELLABLE: [409, "This travel interest can no longer be cancelled."],
  TRAVEL_INTENT_NOT_ACTIVE: [409, "This travel interest is no longer active."],
  ADMIN_CAPABILITY_REQUIRED: [403, "Admin access is required."],
  ADMIN_SCOPE_REQUIRED: [403, "You do not have access to this Market."],
  EMERGING_CORRIDOR_NOT_FOUND: [404, "Opportunity not found."],
  EMERGING_CORRIDOR_TRANSITION_INVALID: [409, "This opportunity is no longer waiting for review."],
  IDEMPOTENCY_CONFLICT: [409, "This action key was already used with different details."],
};

export function mapTravelIntentError(message: string): [string, number, string] | null {
  const hit = Object.entries(travelIntentMessages).find(([code]) => message.includes(code));
  return hit ? [hit[0], hit[1][0], hit[1][1]] : null;
}
