# Raahi V2 Alpha2 — Passenger, Driver and Live Status

Status: implementation active
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

Passenger active-car and passenger booking-status surfaces use this shared language.

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
- driver active-trip card is aligned with the unified presentation
- mobile regression review passes
- V1 booking/queue/trip invariants remain unchanged

## Current limitation

The local-machine validation channel is temporarily handled outside this chat. GitHub remains the source of truth for branch and PR state.
