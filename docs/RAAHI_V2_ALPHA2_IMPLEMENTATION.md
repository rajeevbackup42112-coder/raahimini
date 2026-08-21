# Raahi V2 Alpha2 — Passenger, Driver and Live Status

Status: code implementation complete; validation active
Branch: `v2.0-alpha2`
Base: `v2.0-alpha1`
Source of truth: `docs/RAAHI_V2_BIBLE.md`

## Goal

Make Raahi feel clearer during the moments that matter most without changing the proven V1 booking, queue, seat or trip engine.

Alpha2 focuses on three surfaces:
1. Passenger Home
2. Driver Home
3. Unified live trip/status presentation

## Passenger Home

The passenger home is now action-oriented:
- greets signed-in passengers by display name
- keeps anonymous browsing available
- shows route health in plain language
- surfaces stable route fare
- prioritizes live availability and the next useful action
- keeps one clear path into the live car and Book Seat flow

Route-health labels:
- Good availability
- Limited availability
- No driver yet
- Car in transit

## Driver Home

The driver route-selection surface now acts as a driver home:
- greets the driver
- keeps current location prominent
- presents each route as an operational card
- states the next action clearly
- preserves current queue/FIFO behavior

The active-trip surface now uses the same `UnifiedTripCard` language and shows:
- route and vehicle
- confirmed seats and seats left
- fare per seat
- expected amount collected from confirmed passengers
- held-seat attention state
- one plain-language next action

No dispatch rule is inferred from UI state.

## Unified live card

`UnifiedTripCard` is the shared visual shell for live journey state.

It can present:
- route
- live status
- vehicle
- seats filled / seats left
- fare
- pickup/current stop
- confidence / next-action message
- role-specific child actions

Passenger active-car, passenger booking-status, and driver active-trip surfaces now use this shared language.

## Explicit invariants preserved

Alpha2 does not change:
- seat allocation semantics
- capacity rules
- request hold/confirm lifecycle
- driver FIFO
- trip start/completion semantics
- fare calculation or snapshot rules
- cancellation/no-show rules
- realtime authority model

PostgreSQL remains authoritative and Realtime remains invalidation/refetch only.

## Validation gates

Before Alpha2 can leave draft:
- TypeScript type-check passes
- production build passes
- no new direct writes to core operational tables
- passenger live-card flow renders correctly
- passenger booking-status flow renders correctly
- driver route/home flow renders correctly
- driver active-trip flow renders correctly
- mobile regression review passes
- V1 booking/queue/trip invariants remain unchanged

## Automated acceptance alignment

`tests/e2e-staging/public-active-car.spec.mjs` has been updated for the Alpha2 live-card contract. It accepts either the explicit no-active-car state or the V2 `Live Raahi` projection, and when a car is collecting it requires a clear `Book Seat` or full-car outcome.

The validation workflow now also runs for stacked pull requests targeting `v2.0-alpha1`, so Alpha2 receives type-check and production-build CI before Alpha1 is merged to `main`.

## Current limitation

Browser/mobile and real authenticated role-flow validation still requires the temporary local-machine channel. GitHub remains the source of truth for branch and PR state.
