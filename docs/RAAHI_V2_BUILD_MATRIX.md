# Raahi V2 Scope & Build Matrix

Updated: 2026-08-23
Phase: **pre-RC1 hardening**
Branch: `v2.0-beta1`
PR: #68 — draft/open/unmerged
Source of truth: Bible + Decision Log + Release Readiness

Status legend:
- **DONE** — implemented and materially validated.
- **BUILT** — implemented; a named acceptance/release gate remains.
- **PENDING** — required launch/release work not yet completed.
- **STRETCH** — useful but not required for V2 production.
- **DEFERRED** — intentionally post-V2.

## Governing rule

Raahi V2 evolves the proven V1/V10 engine. Booking, exact seat ownership, fare snapshots, trip lifecycle, role boundaries and directional FIFO may change only through explicitly approved, isolated and regression-tested rules.

## Core product build matrix

| Area | Capability | Launch class | Status | Current evidence / remaining gate |
|---|---|---:|---:|---|
| Identity | One public login + trusted role routing | Launch | DONE | Auth/role contracts + browser flows previously green |
| Identity | Display name / progressive profile | Launch | DONE | Built and used across V2 role experience |
| UX | Green lightweight design + plain-language status | Launch | DONE | Role screens visually exercised |
| Passenger | Action-first Home / current car | Launch | DONE | Current V2 UI accepted |
| Passenger | Unified booking/journey status | Launch | DONE | Seat/trip lifecycle exercised end-to-end |
| Seats | Real numbered BookMyShow-style seat selection | Launch | DONE | Deliberate Seat 3 → HELD → CONFIRMED → My Ride Seat 3 proven |
| Demand | `I need a ride` demand intent, not booking | Launch | DONE | Invariants/contracts green |
| Demand | Aggregation and driver/Admin visibility | Launch | DONE | Read-only projections + anti-mutation guards |
| Demand | Persistent demand recovery | Launch | BUILT | Contracts/build green; headed leave/return/supply/explicit-book E2E pending |
| Demand | 15/30/60 minute wait tolerance | Stretch→RC | BUILT | Advisory-only implementation; headed persistence acceptance pending |
| Driver | Current-route economics / fare / full-car context | Launch | DONE | UI + contract validation green |
| Driver | Directional pipelined FIFO dispatch | Launch | DONE | Live V2 Dev two-driver/two-direction proof + CI #299 |
| Driver | Post-start reverse-demand Low/Medium/High | Launch | BUILT | Backend/live proof green; final responsive driver UI sweep pending |
| Driver | Daily summary | Stretch | DONE | Completed-trip/fare-based implementation validated |
| Admin | Route-health-first operations board | Launch | DONE | Current car, seats, next driver, demand, exceptions exercised |
| Admin | Exception inbox / actionable operations | Launch | DONE | Exception-first UI built and accepted |
| Support | Passenger/Driver structured Help + Admin resolve | Launch | DONE | Fare-issue create → Admin Inbox → resolve proven without trip mutation |
| GPS | Start Trip usable-location prerequisite | Launch | DONE | No-GPS reject + simulated accurate fix + successful start proven |
| GPS | Active-trip live location + graceful fallback | Launch | DONE | Active tracking/privacy UI + scoped writes/reads validated |
| GPS | Automatic terminal tracking cleanup | Launch | DONE | Live GPS row deleted on completed trip |
| Sharing | Share My Raahi secure one-trip token | Launch | DONE | Hashed token, create/open/revoke proven |
| Sharing | Anonymous loved-one read-only trip page | Launch | DONE | Correct passenger/driver trip view; no phone/history exposure |
| Sharing | Successful-arrival visibility window | Launch | DONE | Product copy aligned to up to 30 minutes after arrival |
| Repeat use | My Raahi recent route / Ride Again | Stretch | DONE | Completed trip surfaced; no auto-book |
| Safety | Cancellation/no-show/Admin queue invariants | Launch | DONE | Current V10 paths audited; seat/FIFO/trip isolation preserved |
| Security | RLS/RPC privilege matrix | Launch | DONE | Current V2 tables/functions audited; no new unauthenticated mutation grants |
| Security | Operational role boundaries + auth ingress guards | Launch | DONE | Contract suite + CI |
| Environment | Isolated `Raahi V2 Dev` | Launch | DONE | V1 production kept untouched |
| Staging | Positive non-production safety attestation | Release gate | BUILT | Test workflow fails closed; guaranteed staging target still required |
| Migration | Clean-room canonical replay | Release gate | PENDING | Needs isolated disposable RC database; billable infra approval required |
| Browser | Demand-recovery headed E2E | Release gate | PENDING | Highest-priority next acceptance |
| Browser | Wait-tolerance headed E2E | Release gate | PENDING | Persistence/navigation/reload proof required |
| Browser | Final responsive authenticated role sweep | Release gate | PENDING | Passenger/Driver/Admin + post-start return-demand display |
| Staging | Authenticated staging E2E | Release gate | PENDING | Must run only against positively attested non-production target |
| Rollback | Staging rollback rehearsal | Release gate | PENDING | Run documented app rollback + forward DB recovery process |
| Production | Merge / V2 Prod / secrets / migrations / deploy / tag | Production | PENDING | Explicit user approval required |

## Explicit stretch / post-V2 scope

| Capability | Status | Rule |
|---|---:|---|
| Loved-one start/arrival notifications | STRETCH | Do not delay launch reliability |
| Family / multi-seat passenger labels | STRETCH | Seat semantics must remain exact |
| Scheduled travel intent | STRETCH | Intent only; never auto-book |
| Raahi Insights / demand heatmaps | STRETCH | Aggregate/privacy-first |
| Local Offers / sponsored area | STRETCH | Separate, transparent, never interrupt booking/live trip |
| Help Shape Raahi / idea voting | STRETCH | Only after core transport gates stay green |
| Wallet / mandatory online payment | DEFERRED | Not V2 |
| Surge pricing | DEFERRED | Not V2 |
| Complex ratings/reputation | DEFERRED | Not V2 |
| Opaque AI-controlled dispatch | DEFERRED | Conflicts with transparent FIFO discipline |
| Heavy ad marketplace | DEFERRED | Conflicts with lightweight service character |

## Current validation baseline

Latest validated implementation checkpoint: `636ce21`.
Validate Raahi Mini #299: **SUCCESS**.
17 business/safety contracts: **PASS**.
TypeScript: **PASS**.
Production build: **PASS**.
Current RLS/RPC/live-invariant audit on isolated V2 Dev: **PASS**.

## Recommended completion order

1. Demand-recovery headed E2E.
2. Wait-tolerance persistence headed E2E.
3. Final responsive Passenger / Driver / Admin sweep, including post-start return-demand signal.
4. Obtain user approval for billable disposable RC database if required; run clean-room migration replay.
5. Establish positively attested non-production staging; run authenticated staging E2E.
6. Rehearse rollback on staging.
7. Update Release Readiness; request explicit production GO.
8. Only after GO: merge PR #68 → create/configure V2 Production → migrate → deploy → smoke → tag `v2.0.0`.

## Release principle

**Do not trade proven ride reliability for feature count.** The remaining work is acceptance and release discipline, not another broad redesign.

## Manual-acceptance delta — 2026-08-25

| Area | Capability | Status | Evidence / next gate |
|---|---|---:|---|
| Staging | Final public staging domain `https://myraahi.referralhub.co.in` | LIVE | Google login manually proven for Admin |
| Admin | Driver Onboarding route reachable for Admin | FIXED | `RoleRouteGuard` now permits `/admin-driver-onboarding`; TypeScript/build passed |
| Admin | Vehicle type controlled dropdown | BUILT | Car/Hatchback/Sedan/SUV/MPV/Van in onboarding UI |
| Admin | Vehicle capacity 4/5/6/7/8 | BUILT | UI/client updated; V2 Dev `admin_onboard_driver` validation migrated; build passed |
| Passenger | Real plotted Driver live-location map | PLANNED | Current component is text/freshness only; must render actual coordinates and stale fallback |
| Driver | Show only pickup/drop-off action stops | BUILT V5; DRIVER LIVE PASS | Driver uses meaningful pickup stops while collecting and destination after Start Trip |
| Driver | Automatic transition after all pickups / usable GPS | PLANNED V7 | Manual Start Trip remains authoritative through V6; V7 must preserve FIFO/GPS exactly once |
| Driver | Automatic completion after final required drop-off where safe | PLANNED | Existing Complete Trip remains current behavior until redesign |
| Admin | Dashboard: live health + attention-needed + recent activity | PLANNED V9 | Detailed scope in `RAAHI_V2_ADMIN_CONTROL_PLAN.md` |
| Admin | Registered Users directory + detail/actions | PLANNED V9 | New guarded all-user read projection; integrate Driver onboarding from user detail |
| Admin | Full guarded Route Management | PLANNED V10 | Structural edits require versioning/future-effective publishing; never rewrite live/history stops |

### Validation impact
The previous mobile/responsive PASS baseline remains historical evidence, but Passenger live-trip, Driver active-trip and Admin route/user flows are **reopened** for acceptance because approved behavior is changing. For every implemented slice, rerun focused tests, neighboring role flows, TypeScript, production build, relevant contracts and manual real-user acceptance.

## Historical Stage simplification workstream — 2026-08-25 (SUPERSEDED)

| Area | Capability | Status | Evidence / next gate |
|---|---|---:|---|
| Hosting | Prod V4 frozen on `myraahi.referralhub.co.in` | BASELINE | User-declared Rocket Version 4 rollback point; do not modify during stage work |
| Hosting | Stage on `myraahi-stage.referralhub.co.in` | CONFIGURED IN GIT | Staging branch bootstrap site URL updated; live redeploy/acceptance still required |
| Driver | Next operational-stop projection | BUILT IN GIT | Migration adds `next_action`, `next_operational_stop`, `operational_stops`; TypeScript contract added |
| Driver | Skip empty intermediate stops safely | BUILT IN GIT | Proposed RPC guard permits next waiting pickup / final destination only; migration not applied yet |
| Driver | Boarding confirmation only at pickup | BUILT IN GIT | Backend hardening included in unapplied stage migration |
| Driver | Automatic Start Trip after final pickup | PLANNED | Must preserve GPS prerequisite and same-direction FIFO handoff exactly once |
| Driver | One dominant WHAT'S NEXT screen | PLANNED | Depends on operational-stop backend contract becoming live on isolated Stage |
| Passenger | Actual live driver map | PLANNED | Current text-only location status remains until map phase |
| Admin | Dashboard + registered Users | PLANNED | Build after Passenger/Driver next-state flow stabilizes |
| Admin | Guarded full Route Management | PLANNED | Requires route versioning / future-effective change design |

**Historical note:** this Stage-isolation blocker was superseded when the user explicitly approved the one-version-at-a-time production train. The V5 operational migration has since been applied.

## Production version train — current slice

| Version | Scope | Code | DB | Build | Live acceptance |
|---|---|---:|---:|---:|---:|
| V4 | Known-good pre-simplification baseline | FROZEN | Existing | Historical PASS | Baseline |
| V5 | Driver meaningful pickup stops + destination; boarding only at pickup; production test-auth hard block | DEPLOYED | MIGRATED | PASS | Driver destination PASS; Passenger mismatch promoted to V6 fix |
| V6 | Passenger/Driver next-state alignment; remove Passenger stop-by-stop primary progress | BUILT + LOCALLY VALIDATED | NOT REQUIRED | PASS | PENDING DEPLOY/LIVE |
| V7 | Automatic Start Trip after manifest resolved + usable GPS, preserving canonical FIFO handoff | PLANNED | PLANNED | PENDING | PENDING |
| V8 | Real Passenger Driver-location map + final Passenger simplification | PLANNED | TBD | PENDING | PENDING |
| V9 | Admin Dashboard + Registered Users + integrated Driver onboarding | PLANNED | PLANNED READ PROJECTION | PENDING | PENDING |
| V10 | Guarded full Route Management with versioning/future-effective publishing | PLANNED | PLANNED | PENDING | PENDING |
| V11 | Consolidated Admin Operations / emergency controls + cleanup | PLANNED | TBD | PENDING | PENDING |

V5 preflight on 2026-08-25: active trips = 0, live queue entries = 0, HELD requests = 0. The V5 operational migration was applied successfully. Live acceptance then showed Driver correctly destination-focused while Passenger still rendered legacy stop-by-stop progress after boarding.

## V5 passenger acceptance patch — 2026-08-26

| Area | Capability | Status | Evidence / next gate |
|---|---|---:|---|
| Passenger | Same operational truth as Driver after boarding | BUILT IN GIT | Confirmed + `IN_PROGRESS` passenger now sees destination as the next meaningful event |
| Passenger | Hide obsolete intermediate-stop progress after boarding | BUILT IN GIT | Legacy Driver Progress card is suppressed only for confirmed in-progress rides; pre-pickup progress remains available |
| Passenger | Destination-focused copy | BUILT IN GIT | `On your way to <destination>` + destination card; pickup label no longer dominates after boarding |
| Passenger | Real live Driver map | PLANNED | Location status remains text-only until the dedicated map slice |

Acceptance patch is application-only; no new database migration is required. Focused contract added at `tests/contracts/passenger-next-state-v5-contract.cjs`. TypeScript/build revalidation is still required before Rocket redeploy because the remote validation device became unavailable during this patch.


## Production roadmap after V6 validation

Detailed Admin scope is authoritative in `RAAHI_V2_ADMIN_CONTROL_PLAN.md`. V9–V11 must use audited RPCs and preserve FIFO, GPS, seat ownership, phone verification and historical route semantics.
