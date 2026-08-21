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

## Backend contract still pending

The frontend currently expects these canonical RPCs:
- `create_demand_intent`
- `cancel_my_demand_intent`
- `get_route_demand_summary`

The SQL migration has not been added or applied because the tool safety layer blocked the write. This block has not been bypassed.

No Supabase project has been modified for Beta1.

A read-only inspection of the separate Supabase project named `Raahi` showed that it contains the older pre-V2 queue/matcher architecture, including legacy operational tables and duplicate historical RPCs. It is therefore not being treated as a safe V2 development database and no writes were made to it.

## Required isolated-backend implementation

When a safe isolated database environment is available, implement:
- `demand_intents` table with RLS
- one active equivalent NOW intent per passenger/route
- bounded wait tolerance
- scheduled earliest/latest constraints
- canonical create/cancel functions acting only on `auth.uid()`
- aggregate public summary with no passenger identity
- expiry function/job
- audit/business events
- explicit EXECUTE grants and PUBLIC/anon revocation where appropriate

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

- Beta1 foundation workflow #150: SUCCESS
- return/admin slice exposed a snake_case/camelCase type mismatch; fixed by consuming `RouteDemandSummary` directly
- subsequent production build exposed missing Suspense around `/plan-ride` search params; fixed
- latest stacked validation must pass before Beta1 frontend is considered code-complete

## Next implementation slices

1. Add canonical SQL only in a safe isolated database workflow.
2. Add SQL invariant tests for create/dedupe/cancel/expiry/privacy/FIFO isolation.
3. Add browser acceptance once the backend exists.
4. Add notification dedup/threshold behavior after the core demand lifecycle is green.
