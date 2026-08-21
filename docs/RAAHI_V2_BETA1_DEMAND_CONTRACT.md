# Raahi V2 Beta1 — Demand Activation & Return-Demand Contract

Status: design frozen for implementation
Branch: `v2.0-beta1-design`
Base: Alpha2 code-complete branch
Source of truth: `docs/RAAHI_V2_BIBLE.md`

## Goal

Turn the no-driver state from a dead end into a lightweight demand signal while preserving the proven booking, trip and driver FIFO engine.

Beta1 adds demand intelligence around the V1 engine. It does **not** allocate seats, create trips, bypass FIFO or auto-book a passenger.

## Product rules

1. Public browsing remains anonymous.
2. Creating a demand intent requires authentication because Raahi needs a real passenger identity for deduplication and later notification.
3. `I need a ride` creates demand intent only. It is never a seat booking.
4. A passenger may optionally provide a wait tolerance.
5. Scheduled travel intent is also demand intent, not a reservation.
6. A driver seeing demand still enters the existing driver availability/FIFO flow.
7. Demand never promotes a driver ahead of another waiting driver.
8. When supply appears, interested passengers are prompted to book explicitly.
9. No opaque AI dispatch is introduced.

## Proposed data model

### `demand_intents`

One row represents one passenger's current interest in one route/time window.

Recommended columns:
- `id uuid primary key`
- `passenger_id uuid not null references profiles(id)`
- `route_id uuid not null references routes(id)`
- `intent_kind text not null` — `NOW` or `SCHEDULED`
- `earliest_at timestamptz not null`
- `latest_at timestamptz not null`
- `wait_tolerance_minutes integer null`
- `status text not null` — `ACTIVE`, `SATISFIED`, `CANCELLED`, `EXPIRED`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `satisfied_at timestamptz null`
- `cancelled_at timestamptz null`

Constraints:
- passenger must be the authenticated caller for self-service creation/cancellation
- `latest_at >= earliest_at`
- wait tolerance bounded to a small configured range
- one equivalent live `NOW` intent per passenger+route
- no intent row owns or reserves capacity

## Canonical commands

### `create_demand_intent(...)`
Authenticated passenger only.

Responsibilities:
- verify active route
- validate time window / wait tolerance
- deduplicate equivalent active intent
- insert/update only the caller's intent
- emit one audit/business event
- emit realtime invalidation event
- never mutate `trips`, `driver_queue`, `seat_requests` or `trip_seats`

### `cancel_my_demand_intent(p_intent_id)`
Authenticated passenger only.

Responsibilities:
- cancel only caller-owned active intent
- idempotent outcome
- emit invalidation

### `get_route_demand_summary(p_route_id)`
Safe projection for public/passenger UI.

Returns aggregate only:
- active `NOW` interest count
- scheduled interest count in bounded future windows
- coarse demand label such as `LOW`, `MEDIUM`, `HIGH`
- no passenger identity

### `get_driver_demand_context()`
Authenticated eligible driver projection.

Returns route-level demand relevant to the driver's current/likely return location:
- route
- active interest count
- scheduled-near-term count
- coarse urgency
- potential gross fare based on current route fare × interest count, clearly labelled estimate

This projection is advisory. It cannot change queue order.

## Demand lifecycle

### No-driver immediate demand

`No active car` → passenger taps `I need a ride` → authenticate if needed → create `NOW` intent → show waiting-demand state → eligible drivers see aggregated demand → driver chooses `Go Available` → existing FIFO/activation engine opens a car when appropriate → passenger receives availability signal → passenger explicitly books a seat.

### Scheduled intent

Passenger selects a future window → create `SCHEDULED` intent → demand appears in planning aggregation → near the window, if suitable supply exists, passenger is prompted to confirm/book → no automatic booking.

## Return-demand intelligence

Return demand is a projection over demand intents for the reverse/candidate return route.

Example driver message:

`Dhanbad → Gomoh return demand: 3 interested · likely fill: High`

Rules:
- informational only
- does not reserve return seats
- does not create a return trip automatically
- does not skip FIFO
- does not alter an active outbound trip

## Demand labels

Initial deterministic thresholds, configurable later:
- `LOW`: 1 active interested passenger
- `MEDIUM`: 2–3
- `HIGH`: 4+

These labels describe demand only. They are not promises of departure time or guaranteed fill.

## Anti-spam / dedup rules

- one live equivalent intent per passenger+route+time window
- repeated `I need a ride` refreshes/returns existing intent instead of creating duplicates
- notification event generated only on meaningful threshold change, supply appearance, or urgency transition
- stop supply-seeking alerts once an active collecting car exists
- do not repeatedly notify the same driver for unchanged demand
- expire stale `NOW` intents automatically
- scheduled intents expire at the end of their window

## Notification strategy for Beta1

Use existing app/realtime infrastructure first. Do not introduce a paid notification provider merely for Beta1.

Initial delivery surfaces:
- passenger in-app availability state
- driver Home demand card
- admin unserved-demand projection

External push/SMS/WhatsApp is deferred unless later justified and explicitly approved.

## Privacy and security

- public projections expose counts/labels only
- passenger identity is never exposed through route demand summary
- driver projection receives only aggregate demand
- self-service commands act only on `auth.uid()`
- RLS enabled on the table even though normal client behavior should use canonical RPCs
- revoke default PUBLIC function execution; grant only intended roles

## Invariants that must remain unchanged

Beta1 must not change:
- seat capacity enforcement
- booking HELD/CONFIRMED lifecycle
- physical `trip_seats` ownership
- driver origin FIFO
- driver activation order
- trip lifecycle
- fare snapshot rules
- cancellation/no-show rules
- Realtime authority model

## Implementation sequence

1. Add `demand_intents` migration and enums/check constraints.
2. Add canonical create/cancel/expire functions.
3. Add public aggregate demand projection.
4. Add authenticated driver demand projection.
5. Add deterministic expiry job/function without requiring a paid external service.
6. Add Passenger no-driver `I need a ride` UX.
7. Add passenger waiting-demand state and cancellation.
8. Add Driver Home demand/return-demand card.
9. Add Admin unserved-demand visibility.
10. Add SQL invariant tests and browser acceptance tests.

## Release gate

Do not apply Beta1 migration to the production-linked Supabase project during development. SQL must first be validated in an isolated environment before production consideration.
