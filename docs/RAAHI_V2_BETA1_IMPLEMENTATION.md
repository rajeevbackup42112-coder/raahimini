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

### Scheduled travel intent
- `demandApi` supports `SCHEDULED` intent creation with an explicit earliest/latest window
- `/plan-ride?route_id=...` provides a lightweight future travel-interest screen
- no-driver route experience now links directly to `Plan a ride for later`
- route summary can show upcoming scheduled-interest count alongside live NOW interest
- default UI window is tomorrow 08:00–09:00 local time and remains editable
- invalid/past/reversed windows are rejected client-side before RPC submission
- scheduled interest never auto-books

### Driver demand visibility
- Driver Home route cards fetch aggregate demand context
- demand count/label is advisory only
- queue join / availability action remains the existing FIFO action
- no driver is promoted, reordered or auto-activated because of demand

## Backend contract still pending

The frontend currently expects these canonical RPCs:
- `create_demand_intent`
- `cancel_my_demand_intent`
- `get_route_demand_summary`

The SQL migration has not been added or applied because the tool safety layer blocked the write. This block has not been bypassed.

No Supabase project has been modified for Beta1.

## Required isolated-backend implementation

When a safe isolated database environment is available, implement:
- `demand_intents` table with RLS
- one active equivalent NOW intent per passenger/route
- bounded wait tolerance
- scheduled earliest/latest constraints
- canonical create/cancel functions acting only on `auth.uid()`
- aggregate public summary with no passenger identity
- driver aggregate projection
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

Completed before the scheduled-intent slice:
- Beta1 foundation type-check PASS
- production build PASS
- GitHub workflow #150 SUCCESS

The latest scheduled-intent/no-driver slice is covered by the same stacked validation workflow and must be green before this slice is considered code-complete.

## Next implementation slices

1. Add reverse-route/return-demand context to Driver Home.
2. Add admin unserved-demand projection UI.
3. Add canonical SQL only in a safe isolated database workflow.
4. Add invariant tests and browser acceptance once backend exists.
