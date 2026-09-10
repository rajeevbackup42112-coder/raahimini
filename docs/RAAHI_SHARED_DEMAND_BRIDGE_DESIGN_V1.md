# Raahi Shared — Passenger-Originated Demand Bridge V1

Status: implementation design freeze for the `raahi-shared-demand-bridge` branch.

## Purpose

Raahi already has three useful but separate primitives: `travel_intents`, Driver-created `trip_offerings` / `trip_bookings`, and the common Ride/Commitment kernel. The missing bridge is the frozen Passenger journey:

> Start a shared ride → Raahi looks for other passengers and an eligible Driver → a Driver becomes ready → Passenger reviews Driver/vehicle/price → Passenger joins → enough seats can confirm the shared ride.

This slice connects Passenger-originated shared demand to the existing Raahi Trip supply and booking kernel. It does not create a second ride engine.

## Vocabulary boundary

Customer-facing name: **Raahi Shared**. Internal implementation terms may remain `travel_intent`, `RAAHI_TRIP`, `trip_offering`, `trip_booking`, `shared_trip_match` and `threshold`. Customer UI must not expose `queue`, `threshold`, `CARPOOL` or `RAAHI_TRIP` as product language.

## Core invariants

1. Starting a shared ride is not yet a booking and creates no Driver commitment.
2. Passenger identity stays private from the Driver before the existing confirmed-booking privacy boundary.
3. A Driver-ready offer temporarily protects the Passenger's requested seats.
4. Held seats do not count toward minimum confirmation until Passenger acceptance.
5. `active_booked_seats + held_seats <= offered_seats` always holds.
6. Ordinary Trip bookings may use only unheld capacity.
7. Expired holds release exactly once through canonical commands.
8. Match acceptance consumes the hold and creates the canonical `trip_booking`.
9. Existing threshold confirmation remains the only path that creates the shared Ride and Driver/vehicle commitment.
10. Product OFF blocks new requests, matches and bookings but never destroys an already confirmed/in-fulfilment Ride.
11. Compatible demand is matched FIFO subject to capacity.
12. Every mutation is idempotent and remains behind RPC boundaries.

## Data changes

Add `travel_intents.intent_kind` with values `INTEREST | SHARED_REQUEST`, defaulting to `INTEREST` for backward compatibility. Add `trip_offerings.held_seats` default 0 with a check that booked plus held seats never exceeds offered seats.

Add `shared_trip_matches` with `travel_intent_id`, `offering_id`, Passenger ownership snapshot, seat/price snapshots, lifecycle `OFFERED | ACCEPTED | DECLINED | EXPIRED | CANCELLED`, expiry/terminal timestamps and optional resulting `trip_booking_id`. Direct browser access is denied.

## Compatibility

A Shared request can match a Trip offering only when request kind is `SHARED_REQUEST`, request is ACTIVE, acceptable service is `RAAHI_TRIP` or `ANY`, route and origin market match exactly, offering is FILLING and current, Product is enabled, offering departure is inside the requested outbound window, Passenger is not the Driver, Passenger has no active booking/live duplicate match, and unbooked/unheld capacity can satisfy the request.

## Matching

The same private matcher runs when a Shared request is created and when a Driver publishes a Trip offering. It locks the offering and Passenger intents, allocates FIFO, and increments `held_seats` atomically with match creation. Hold duration comes from product rule `shared_match_hold_minutes` with a conservative default.

## Passenger acceptance

`accept_shared_trip_match(match_id, idempotency_key)` verifies ownership, locks match/offering, releases expired holds, rechecks Product and Driver/vehicle eligibility, consumes held capacity into an ordinary `trip_booking`, resolves the originating intent, and invokes `confirm_trip_threshold_locked` if the existing confirmation threshold is now met.

Passenger decline releases a live hold but leaves the Shared request active. Cancelling the Shared request cancels live matches and releases holds. Driver cancellation must invalidate outstanding offers and release holds.

## Role projections

Driver demand discovery is aggregate only: route, requested time window/bucket, active request count, total seats and oldest request. No Passenger name, phone, profile id or individual journey history is exposed.

Passenger request detail can show request status and live Driver-ready offers with Driver name, vehicle, Trust booleans, departure/return, price, protected seats and expiry. Raw DL/RC evidence stays private.

## Service-switch semantics

OFF means no new discovery, Shared request, match offer, match acceptance or ordinary Trip booking. Confirmed Ride/booking/commitment fulfilment continues.

## Acceptance criteria

Existing Slice 11/12 contracts remain true; historical intents default to INTEREST; Shared requests remain non-booking demand until acceptance; matching is route/time compatible and FIFO; Driver demand projection exposes no Passenger identity; holds protect capacity; expiry/decline/cancel release exactly once; acceptance creates exactly one canonical Trip booking; threshold confirmation still creates one Ride/Commitment; retries are idempotent; Product OFF blocks only new commitments; direct table access remains denied.

## Non-goals

No SMS/push delivery, Trust file storage, Admin verification workflow, frozen-UI replacement, production deployment, or payment-model change in this slice.
