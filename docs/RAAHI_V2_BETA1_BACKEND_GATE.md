# Raahi V2 Beta1 — Backend Gate

Status: ISOLATED DEV BACKEND AVAILABLE; V10 parity replay in progress

## Current safe environment

A fresh Supabase project named `Raahi V2 Dev` is connected under a separate Supabase account and is used only for V2 development. Production-linked `Raahi Mini` remains untouched.

Current project ref: `euqonxznewasaymdzach`.

The project began empty. The V10 core schema and operational tables were applied first, followed by route/reference seed data and the Beta1 demand-intent migration. No production project or historical `Raahi` project was modified.

## Beta1 backend now present

- `demand_intents` table with RLS
- one active NOW intent per passenger+route
- bounded NOW wait tolerance
- bounded future scheduled window
- `create_demand_intent`
- `cancel_my_demand_intent`
- `expire_demand_intents`
- `get_route_demand_summary`
- aggregate-only public route demand projection
- explicit Beta1 function grants/revocations
- audit rows for create/cancel actions

Canonical migration:
`supabase/migrations/20260821162000_v2_beta1_demand_intents.sql`

## Validation completed

PASS:
- fresh isolated database target confirmed
- core schema applied
- operational tables applied
- route/reference seed data applied
- Beta1 demand migration applied
- NOW intent creation
- repeated NOW dedupe returns the same intent
- aggregate route count/LOW label
- cross-passenger cancellation denied
- owner cancellation
- repeat owner cancellation is idempotent
- valid scheduled intent
- past scheduled intent rejected
- reversed scheduled window rejected
- stale demand expiry
- temporary SQL test identities/data cleaned up
- security advisor reviewed
- performance advisor reviewed

## Remaining before release-ready

- replay all remaining V10 RPC/read-projection/hardening migrations in canonical filename order
- replay Alpha1 identity migration after V10 parity
- re-run security/performance advisors after parity replay
- verify all exposed function privileges explicitly
- run V1 booking/FIFO/trip invariant regression on the isolated database
- prove demand functions do not mutate trips, driver_queue, seat_requests or trip_seats
- browser acceptance against the isolated project
- notification/rate-limit slice before Beta1 exit

Exact replay order is tracked in `docs/RAAHI_V2_DEV_DB_REPLAY.md`.

## Security-advisor notes

The advisor flags SECURITY DEFINER functions that are intentionally exposed as canonical RPCs as well as early bootstrap helpers. These warnings are not being ignored. Later V10 hardening migrations are expected to narrow the inherited surface; the final post-replay advisor result is the one used for the release gate.

`get_route_demand_summary` intentionally exposes aggregate counts/labels to anonymous browsing while underlying demand rows remain hidden by RLS.

## Guardrails

- do not apply V2 development DDL to production-linked Supabase
- do not repurpose the historical `Raahi` project
- do not merge Beta1 until isolated SQL/invariant/browser gates pass
- demand must never mutate trips, driver queue, seat requests or trip seats
- demand must never bypass FIFO or reserve capacity
- create `Raahi V2 Prod` only after release-candidate approval; do not consume the second free project slot early
