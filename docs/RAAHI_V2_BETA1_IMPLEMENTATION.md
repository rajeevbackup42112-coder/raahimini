# Raahi V2 Beta1 — Implementation Status

Status: active, draft only
Branch: `v2.0-beta1`
Base: `v2.0-beta1-design`

## Implemented

### Passenger demand activation
- no-driver state offers `I need a ride`
- anonymous passenger can authenticate and return to the same route
- signed-in passenger creates a NOW intent through the canonical client contract
- default wait tolerance is 30 minutes
- route UI shows aggregate interest only
- demand is explicitly described as interest, not a booking or capacity reservation
- passenger can cancel the live intent
- while a NOW intent is active and the screen stays open, Raahi rechecks supply about every 15 seconds; this is an in-app check only, not push notification

### Scheduled travel intent
- `demandApi` supports `SCHEDULED` intent creation with an explicit earliest/latest window
- `/plan-ride?route_id=...` provides a lightweight future travel-interest screen
- no-driver route experience links directly to `Plan a ride for later`
- route summary can show upcoming scheduled-interest count alongside live NOW interest
- default UI window is tomorrow 08:00–09:00 local time and remains editable
- invalid/past/reversed windows are rejected client-side before RPC submission
- scheduled interest never auto-books
- the Next.js search-params route is wrapped in Suspense so production prerendering remains valid

### Driver demand visibility
- Driver Home route cards fetch aggregate outbound demand
- reverse-route demand is projected for the candidate return journey
- return demand is advisory only and cannot change queue order
- queue join / availability action remains the existing FIFO action
- no driver is promoted, reordered or auto-activated because of demand

### Admin unserved-demand visibility
- Admin Home includes an aggregate unserved-demand overview
- only routes with demand and no active car are highlighted
- NOW and scheduled interest counts are shown separately
- no passenger identity is exposed
- admin view is observational only and does not mutate queue/trip state

## Isolated backend now active

A fresh Supabase project named `Raahi V2 Dev` is connected and reserved for V2 development only.

Project ref: `euqonxznewasaymdzach`.

Applied in the isolated project:
- V10 core schema
- V10 operational tables
- V10 Gomoh/Dhanbad seed locations/routes/stops/vehicles
- Beta1 demand migration `20260821162000_v2_beta1_demand_intents.sql`

Beta1 backend surface now includes:
- `demand_intents` with RLS
- one active NOW intent per passenger+route
- bounded wait tolerance
- scheduled window validation
- `create_demand_intent`
- `cancel_my_demand_intent`
- `expire_demand_intents`
- `get_route_demand_summary`
- audit rows for create/cancel actions
- aggregate-only public demand projection

The production-linked `Raahi Mini` project and the historical `Raahi` project were not modified.

## Preserved invariants

Beta1 does not change:
- booking HELD/CONFIRMED lifecycle
- trip-seat ownership
- trip capacity
- fare snapshots
- driver FIFO
- activation order
- start/complete trip semantics
- cancellation/no-show semantics
- PostgreSQL authority / Realtime invalidation model

## Validation

Frontend/build:
- Beta1 foundation workflow #150: SUCCESS
- return/admin slice exposed a snake_case/camelCase type mismatch; repaired
- `/plan-ride` missing-Suspense production-build failure found and repaired
- workflow #170: SUCCESS
- workflow #175: SUCCESS

Isolated database:
- core schema migration: PASS
- operational tables migration: PASS
- Beta1 demand migration: PASS
- seed routes present: 2 locations, 2 routes
- `demand_intents` RLS enabled: PASS
- NOW create: PASS
- repeated NOW create returns same intent with `deduplicated=true`: PASS
- aggregate summary reflects active NOW intent and LOW label: PASS
- cross-passenger cancellation denied: PASS
- owner cancellation: PASS
- repeated cancellation idempotent: PASS
- valid future scheduled intent: PASS
- past scheduled window rejected: PASS
- reversed scheduled window rejected: PASS
- expiry function marks stale ACTIVE intent expired: PASS
- temporary SQL test users/intents/audit rows cleaned up after validation: PASS
- security advisor reviewed
- performance advisor reviewed

Advisor notes:
- SECURITY DEFINER warnings on the canonical Beta1 RPC surface are expected and must remain bounded by explicit grants and in-function caller checks
- anonymous `get_route_demand_summary` intentionally exposes aggregate counts/labels only; underlying rows remain protected by RLS
- early V10 bootstrap helper warnings remain until the later V10 hardening migrations are replayed into this fresh environment

## Next implementation slices

1. Replay remaining V10 hardening/read-projection migrations into `Raahi V2 Dev` until the environment reaches production-parity for the preserved V1 engine.
2. Verify Beta1 function privileges and no trip/queue/seat mutations under demand operations.
3. Point a non-production V2 app configuration at `Raahi V2 Dev` without committing secrets.
4. Run browser acceptance for passenger NOW demand, scheduled demand, driver return demand and admin unserved demand.
5. Add notification dedup/threshold behavior only after the core demand lifecycle remains green.


## Beta1 demand notification / rate-limit slice

- Uses the existing `raahi_invalidation_events` Realtime stream; no paid/external notification provider is introduced.
- `demand_notification_state` is internal-only, RLS-enabled, and has no anon/authenticated table grants.
- Server triggers emit `DEMAND_LOW`, `DEMAND_MEDIUM`, `DEMAND_HIGH`, `DEMAND_URGENCY`, or `SUPPLY_AVAILABLE` only on meaningful state transitions.
- Unchanged demand is suppressed; demand escalation and shorter NOW wait tolerance can re-alert.
- Supply appearance stops supply-seeking alerts; if demand remains after supply later disappears, the current demand tier may signal again.
- Driver Home listens only while an authenticated driver is choosing routes, filters events to routes departing the selected location, refetches aggregate demand before showing the alert, and keeps `Go Available` on the existing `join_driver_queue` RPC.
- The notification layer never allocates seats, creates bookings/trips, changes driver FIFO, or mutates queue order.

V2 Dev validation: notification state initialized at `NONE`, no spurious zero-demand event was emitted, internal helper/trigger functions have no anon/authenticated EXECUTE privilege, protected operational tables remained unchanged, TypeScript passed, and the production build passed.