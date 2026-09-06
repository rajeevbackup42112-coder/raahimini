export const carpoolMessages: Record<string, [number, string]> = {
  PASSENGER_CAPABILITY_REQUIRED: [403, "Passenger access is required."],
  DRIVER_CAPABILITY_REQUIRED: [403, "Driver access is required."],
  CARPOOL_PRODUCT_NOT_AVAILABLE: [409, "Carpool is not available for this origin right now."],
  CARPOOL_DRIVER_NOT_ELIGIBLE: [409, "Your Driver or Vehicle verification is not currently eligible for Carpool."],
  CARPOOL_ORIGIN_INVALID: [422, "Choose an eligible origin for this Carpool product."],
  CARPOOL_DESTINATION_INVALID: [422, "Choose a valid destination."],
  CARPOOL_DEPARTURE_INVALID: [422, "Choose a valid future departure time."],
  CARPOOL_CAPACITY_INVALID: [422, "Choose a valid number of spare seats."],
  CARPOOL_CAPACITY_UNAVAILABLE: [409, "Those seats are no longer available."],
  CARPOOL_CONTRIBUTION_INVALID: [422, "Choose a valid per-seat contribution."],
  CARPOOL_COMMITMENT_CONFLICT: [409, "This Driver or Vehicle already has another commitment in that time window."],
  CARPOOL_JOURNEY_NOT_FOUND: [404, "Carpool journey not found."],
  CARPOOL_JOURNEY_NOT_BOOKABLE: [409, "This Carpool journey is no longer bookable."],
  CARPOOL_DRIVER_CANNOT_BOOK_SELF: [409, "A Driver cannot book seats in their own Carpool journey."],
  CARPOOL_ACTIVE_BOOKING_EXISTS: [409, "You already have an active booking on this journey."],
  CARPOOL_BOOKING_NOT_FOUND: [404, "Carpool booking not found."],
  CARPOOL_BOOKING_NOT_CANCELLABLE: [409, "This booking can no longer be cancelled from the booking screen."],
  CARPOOL_ALREADY_COMMITTED: [409, "Booked Carpool terms are locked. Use the material-change flow instead."],
  CARPOOL_CHANGE_REQUIRES_COMMITTED_BOOKINGS: [409, "A material change is only needed after Passenger bookings exist."],
  CARPOOL_CHANGE_NOT_MATERIAL: [422, "Change the departure time or destination before proposing."],
  CARPOOL_CHANGE_NOT_AVAILABLE: [409, "This change proposal is no longer awaiting your response."],
  CARPOOL_CHANGE_ALREADY_RESPONDED: [409, "You already responded to this change."],
  CARPOOL_ALREADY_IN_FULFILMENT: [409, "This Carpool has already entered fulfilment. Use support for an in-progress exception."],
  CARPOOL_JOURNEY_NOT_CANCELLABLE: [409, "This Carpool journey can no longer be cancelled before fulfilment."],
  RIDE_TRANSITION_INVALID: [409, "That trip action is not available in the current state."],
  RIDE_NOT_FOUND: [404, "Ride not found."],
  BOOKING_NOT_FOUND: [404, "Booking not found."],
  BOARDING_WAIT_NOT_EXPIRED: [409, "The boarding wait has not finished yet."],
  ARRIVAL_LOCATION_NOT_VERIFIED: [422, "Raahi could not verify arrival at the pickup area."],
  COMPLETION_LOCATION_NOT_VERIFIED: [422, "Raahi could not verify arrival at the destination."],
  IDEMPOTENCY_CONFLICT: [409, "This action key was already used with different details."],
};

export function mapCarpoolError(message: string): [string, number, string] | null {
  const hit = Object.entries(carpoolMessages).find(([code]) => message.includes(code));
  return hit ? [hit[0], hit[1][0], hit[1][1]] : null;
}
