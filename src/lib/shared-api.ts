export const sharedMessages: Record<string, [number, string]> = {
  PASSENGER_CAPABILITY_REQUIRED: [403, "Passenger access is required."],
  SHARED_ORIGIN_INVALID: [422, "Choose a valid starting point."],
  SHARED_DESTINATION_INVALID: [422, "Choose a valid destination."],
  SHARED_SAME_LOCATION: [422, "Starting point and destination must be different."],
  SHARED_PRODUCT_NOT_AVAILABLE: [409, "Raahi Shared is not available for this journey right now."],
  SHARED_SEAT_COUNT_INVALID: [422, "Choose a valid number of seats."],
  SHARED_DEPARTURE_INVALID: [422, "Choose a valid future travel time."],
  SHARED_WINDOW_INVALID: [422, "Choose a valid travel-time window."],
  SHARED_REQUEST_NOT_FOUND: [404, "This shared-ride request could not be found."],
  SHARED_REQUEST_NOT_ACTIVE: [409, "This shared-ride request is no longer active."],
  SHARED_MATCH_NOT_FOUND: [404, "This Driver offer could not be found."],
  SHARED_MATCH_EXPIRED: [409, "This Driver offer has expired. Raahi will keep looking for another option."],
  SHARED_MATCH_NOT_ACCEPTABLE: [409, "This Driver offer is no longer available to join."],
  SHARED_MATCH_NOT_DECLINABLE: [409, "This Driver offer can no longer be declined."],
  SHARED_HOLD_STATE_INVALID: [409, "Raahi could not safely confirm the protected seats. Please refresh and try again."],
  SHARED_MATCH_STATE_CHANGED: [409, "This Driver offer changed while you were acting on it. Please refresh."],
  TRIP_OFFERING_NOT_BOOKABLE: [409, "This shared ride is no longer available to join."],
  TRIP_CONFIRMATION_DEADLINE_PASSED: [409, "The joining window for this shared ride has closed."],
  TRIP_CAPACITY_UNAVAILABLE: [409, "There are not enough seats left on this shared ride."],
  TRIP_ACTIVE_BOOKING_EXISTS: [409, "You have already joined this shared ride."],
  TRIP_DRIVER_NOT_ELIGIBLE: [409, "This Driver is no longer eligible for this ride."],
  IDEMPOTENCY_CONFLICT: [409, "This action key was already used with different details."],
};

export function mapSharedError(message: string): [string, number, string] | null {
  const hit = Object.entries(sharedMessages).find(([code]) => message.includes(code));
  return hit ? [hit[0], hit[1][0], hit[1][1]] : null;
}
