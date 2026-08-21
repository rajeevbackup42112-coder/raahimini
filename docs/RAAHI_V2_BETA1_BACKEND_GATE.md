# Raahi V2 Beta1 — Backend Gate

Status: ISOLATED DEV BACKEND AVAILABLE; validation in progress

## Current safe environment

A fresh Supabase project named `Raahi V2 Dev` is now connected under a separate Supabase account and is being used only for V2 development. Production-linked `Raahi Mini` remains untouched.

Current project ref: `euqonxznewasaymdzach`.

The project began empty. The V10 core schema and operational tables were applied first, followed by the Beta1 demand-intent migration. No production project or historical `Raahi` project was modified.

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
- explicit function grants/revocations for the Beta1 RPC surface
- audit rows for create/cancel actions

The migration is committed at:
`supabase/migrations/20260821162000_v2_beta1_demand_intents.sql`

## Validation status

Completed:
- fresh isolated database target confirmed
- core schema migration applied cleanly
- operational-table migration applied cleanly
- Beta1 demand migration applied cleanly
- `demand_intents` confirmed with RLS enabled
- foreign keys to passenger profile and route confirmed
- security advisor run completed

Still required before Beta1 backend is considered release-ready:
- authenticated NOW create/dedupe test
- scheduled-window boundary tests
- cancellation ownership/idempotency tests
- expiry test
- aggregate privacy test
- explicit function privilege verification
- FIFO/trip/seat non-mutation checks
- performance advisor review
- browser acceptance against the isolated project

## Security-advisor notes

The advisor flags SECURITY DEFINER functions that are intentionally exposed as canonical RPCs. These warnings are not being ignored: each function must have a documented caller boundary and explicit grants. `get_route_demand_summary` intentionally exposes only aggregate counts/labels to anonymous browsing while the underlying demand rows remain hidden by RLS.

The baseline bootstrap also exposes some helper-function warnings inherited from early V10 migrations; these will be reconciled with the later V10 hardening migrations before this environment is considered production-parity.

## Guardrails

- do not apply V2 development DDL to production-linked Supabase
- do not repurpose the historical `Raahi` project
- do not merge Beta1 until isolated SQL/invariant/browser gates pass
- demand must never mutate trips, driver queue, seat requests or trip seats
- demand must never bypass FIFO or reserve capacity
