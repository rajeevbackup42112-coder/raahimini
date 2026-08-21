# Raahi V2 Beta1 — Backend Gate

Status: BACKEND PARITY + SQL REGRESSION GREEN; BROWSER ACCEPTANCE PENDING

## Current safe environment

A fresh Supabase project named `Raahi V2 Dev` is connected under a separate Supabase account and is used only for V2 development. Production-linked `Raahi Mini` and the historical `Raahi` project remain untouched.

Current project ref: `euqonxznewasaymdzach`.

The project began empty. Canonical V10 migrations were replayed into the isolated dev project, followed by Alpha1 identity and the canonical Beta1 demand-intent migration. Migration 5 seed data was not duplicated because the safe route/reference seed was already present. Migration 8's canonical `drivers.route_id` removal was explicitly approved for Raahi V2 Dev only.

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

## Canonical parity replay completed

PASS:
- V10 migrations through 33 replayed successfully
- Alpha1 migration 34 replayed successfully
- migration 5 safe seed not duplicated
- migration 8 dynamic-route schema applied, including approved removal of obsolete `drivers.route_id`
- Beta1 migration replayed after V10 hardening so its intended function grants are restored
- no production or legacy Supabase project modified

## Validation completed

PASS:
- Beta1 NOW intent creation
- repeated NOW dedupe returns the same intent
- aggregate route count/LOW label
- cross-passenger cancellation denied
- owner cancellation
- repeat owner cancellation is idempotent
- valid scheduled intent
- past scheduled intent rejected
- reversed scheduled window rejected
- stale demand expiry
- transactional Beta1 demand-invariant regression with zero persistent fixture data
- demand lifecycle proven not to mutate `trips`, `driver_queue`, `seat_requests`, or `trip_seats`
- V1 booking/FIFO/trip regression
- FIFO activation and next-driver activation
- held/confirmed seat accounting
- fare immutability
- simultaneous-trip isolation
- role-transition protection
- ordered trip progression/completion
- cancellation seat release
- direct RLS/table privilege checks match projection model
- security advisor rerun
- performance advisor rerun

The committed SQL regression fixture previously requested a 1-minute NOW tolerance even though the canonical contract permits 5–180 minutes. The database contract was correct; the repository test fixture has now been corrected to 5 minutes.

## Advisor notes

The final security/performance advisor pass still reports expected SECURITY DEFINER warnings and performance recommendations. These have been reviewed. Established V1 behavior was not changed merely to silence generic advisor warnings.

`get_route_demand_summary` intentionally exposes aggregate counts/labels to anonymous browsing while underlying demand rows remain hidden by RLS.

## Remaining before Beta1 release-ready

- interactive browser acceptance against the isolated V2 Dev backend
- isolated staging smoke/E2E for passenger, driver, and admin flows
- notification/rate-limit slice before Beta1 exit
- confirm latest GitHub Actions run remains green after housekeeping updates

A clean detached Beta1 validation worktree is available at:
`C:\Users\Dipti\RaahiV2Beta1Validation`

## Guardrails

- do not apply V2 development DDL to production-linked Supabase
- do not repurpose the historical `Raahi` project
- do not merge Beta1 until browser/staging gates pass
- demand must never mutate trips, driver queue, seat requests or trip seats
- demand must never bypass FIFO or reserve capacity
- create `Raahi V2 Prod` only after release-candidate approval; do not consume the second project slot early
