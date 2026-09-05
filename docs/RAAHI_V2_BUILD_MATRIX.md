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
| Passenger | Real plotted Driver live-location map | BUILT + VALIDATED V8 | Authorized `IN_PROGRESS` coordinates render on a keyless OpenStreetMap embed with live/last-known/unavailable states |
| Driver | Show only pickup/drop-off action stops | BUILT V5; DRIVER LIVE PASS | Driver uses meaningful pickup stops while collecting and destination after Start Trip |
| Driver | Automatic transition after all pickups / usable GPS | BUILT + VALIDATED V7 | UI automatically invokes canonical `start_trip` exactly when departure eligibility + fresh usable GPS are true; manual Start Trip removed |
| Driver | Automatic completion after final destination arrival | BUILT + VALIDATED V12 | Explicit Arrived-at-destination action triggers canonical completion automatically; manual Complete Trip removed |
| Admin | Dashboard: live health + attention-needed + recent activity | DEPLOYED V9 | Production bundle verified; authenticated visual acceptance remains evidence to capture |
| Admin | Registered Users directory + detail/actions | DEPLOYED V9 | Search/filters/detail + integrated canonical Driver onboarding are live |
| Admin | Full guarded Route Management | DEPLOYED + LIVE ACCEPTED V10 | Versioned drafts, stop reorder, preview/publish, create/duplicate/archive; draft isolation and busy-route guard proven live |

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
| V6 | Passenger/Driver next-state alignment; remove Passenger stop-by-stop primary progress | DEPLOYED | NOT REQUIRED | PASS | Production bundle verified; authenticated paired-screen acceptance not separately captured |
| V7 | Automatic Start Trip after manifest resolved + usable GPS, preserving canonical FIFO handoff | DEPLOYED | NOT REQUIRED | PASS | Production bundle verified; real automatic-departure ride acceptance remains to be captured |
| V8 | Real Passenger Driver-location map + final Passenger simplification | DEPLOYED | NOT REQUIRED | PASS | Production bundle verified; authenticated real-map ride screenshot still pending |
| V9 | Admin Dashboard + Registered Users + integrated Driver onboarding | DEPLOYED | MIGRATED (READ-ONLY) | PASS | Production bundle verified; authenticated Admin visual acceptance still to capture |
| V10 | Guarded full Route Management with versioning/future-effective publishing | DEPLOYED `07adb1a` | MIGRATED | PASS | LIVE ACCEPTANCE PASS: draft isolation + busy-route publish guard + discard |
| V11 | Consolidated Admin Operations / emergency controls + cleanup | DEPLOYED `66c543e` | MIGRATED (READ-ONLY) | PASS | LIVE ACCEPTANCE PASS |
| V12 | Automatic trip completion after explicit destination arrival | DEPLOYED `99c2343` | NOT REQUIRED | PASS | LIVE PASS: explicit destination arrival -> automatic completion; queue/accounting/GPS/share cleanup verified |
| V13 | Pre-go-live hardening: Admin auth/profile gate, Users mobile width, time-aware route-demand guard | PUSHED `fc02d33` | MIGRATED | PASS | PENDING ROCKET DEPLOY + headed regression |

V5 preflight on 2026-08-25: active trips = 0, live queue entries = 0, HELD requests = 0. The V5 operational migration was applied successfully. Live acceptance then showed Driver correctly destination-focused while Passenger still rendered legacy stop-by-stop progress after boarding.

## V5 passenger acceptance patch — 2026-08-26

| Area | Capability | Status | Evidence / next gate |
|---|---|---:|---|
| Passenger | Same operational truth as Driver after boarding | BUILT IN GIT | Confirmed + `IN_PROGRESS` passenger now sees destination as the next meaningful event |
| Passenger | Hide obsolete intermediate-stop progress after boarding | BUILT IN GIT | Legacy Driver Progress card is suppressed only for confirmed in-progress rides; pre-pickup progress remains available |
| Passenger | Destination-focused copy | BUILT IN GIT | `On your way to <destination>` + destination card; pickup label no longer dominates after boarding |
| Passenger | Real live Driver map | BUILT V8 | Keyless OpenStreetMap marker uses the existing authorized live-location projection; stale/no-GPS fallbacks remain truthful |

Acceptance patch is application-only; no new database migration is required. Focused contract added at `tests/contracts/passenger-next-state-v5-contract.cjs`. TypeScript/build revalidation is still required before Rocket redeploy because the remote validation device became unavailable during this patch.


## Production roadmap after V6 validation

Detailed Admin scope is authoritative in `RAAHI_V2_ADMIN_CONTROL_PLAN.md`. V9–V11 must use audited RPCs and preserve FIFO, GPS, seat ownership, phone verification and historical route semantics.


## 2026-08-27 Version 10 guarded Route Management checkpoint

V10 final runtime candidate: `ce56d489e19d220862f104b928831ab30e6e56c8` (foundation commit `2c6191e9512e948c6474c535d9ad7770242682f4`). Migration `v2_prod_v10_route_versioning` is applied. Existing DG-01/GD-01 routes were backfilled as current published v1 without changing their active state. Pre/post migration operational state remained DG-01: 0 live trips / 1 active demand; GD-01: 1 live trip / 0 active demand. No draft was created by migration.

Admin can prepare New Route, Duplicate or Edit as an inactive draft; add/remove/edit/reorder stops using drag or touch buttons; inspect a publish preview; and explicitly Publish. Publishing/archiving is blocked by live trip, live queue or active passenger demand. Historical route/stops remain attached to historical trips. `Ride this route again` now resolves a completed trip to the current active route version instead of an archived route id. Canonical Start Trip/FIFO/GPS functions were not redefined. Validation: 24/24 contracts PASS, TypeScript PASS, production build PASS. Rocket V10 deployment and live Admin acceptance remain pending.

## 2026-08-28 V14 auth hydration hotfix

| Version | Scope | Code | DB | Build | Live acceptance |
|---|---|---:|---:|---:|---:|
| V14 | Prevent authenticated profile-hydration deadlock introduced by V13 | CANDIDATE `65c1c4e` | NOT REQUIRED | 28/28 contracts + TS + build PASS | PENDING ROCKET |

V13 anonymous Admin gate, Users mobile-width fix and time-aware demand guards remain retained. V14 changes only auth hydration sequencing and related contracts.

## 2026-08-28 final production acceptance

| Version | Scope | Code | DB | Build | Live acceptance |
|---|---|---:|---:|---:|---:|
| V13 | Pre-go-live Admin/auth/responsive/demand hardening | DEPLOYED `6f3ff6b` | MIGRATED | PASS 27/27 | Superseded by V14 auth hotfix |
| V14 | Auth hydration hotfix preserving V13 hardening | DEPLOYED `38b7519` | NOT REQUIRED | PASS 28/28 | FINAL HEADED ACCEPTANCE PASS |

Final headed production matrix now includes real Passenger seat lifecycle, concurrent seat exclusion, demand recovery 15/30/60, Driver no-show/cancel recovery, support, same-direction two-Driver FIFO, real-browser GPS automatic departure, Passenger live/stale/recovered map, Share My Raahi privacy/revoke, explicit destination arrival, V12 automatic completion, role ingress and mobile overflow checks.

Final cleanup: 0 live trips, 0 live queue entries, 0 HELD requests, 0 current ACTIVE demand, 0 open support cases, 0 route drafts and 0 live GPS rows. Rollback reference: `prod-v14-frozen` -> `38b7519d615e171c59d537b18a61c1ba303c132f`.

## 2026-08-30 Demo Ready / go-live infrastructure

| Area | Capability | Status | Evidence / next gate |
|---|---|---:|---|
| Demo UI | Passenger / Driver / Admin investor-polish pass through Admin Access | BUILT + VALIDATED | Screen 16 checkpoint `1f074897`; prior V14 runtime remains frozen |
| Admin | Admin Access role-account read repair | CODED, NOT PROD-MIGRATED | Forward `p.role::text` fix; production function still pre-repair |
| OTP | Supabase-generated OTP delivered by Fast2SMS | CODED | `send-sms` Edge Function; Fast2SMS verify API intentionally absent |
| OTP | Fast2SMS credentials/template | BLOCKED ON EXTERNAL INPUT | Need API key + OTP ID/template, then controlled real OTP proof |
| Domain | `ride.myraahi.co.in` application identity | CODED | `NEXT_PUBLIC_SITE_URL`; test-auth/staging endpoints hard-block new production host |
| DNS | `myraahi.co.in` / `ride.myraahi.co.in` | PENDING PROPAGATION / HOSTING SETUP | Initial DNS check did not resolve new apex/subdomain; do not invent DNS target |
| Maps | Passenger live map | LAUNCH READY | Existing keyless OpenStreetMap remains launch choice |
| Backend | Supabase | RETAINED | No Convex migration planned for launch |
| Validation | Candidate `b937c409` | PASS | TypeScript + 30/30 contracts + production build 23/23 |
| Production preflight | Operational state | CLEAN SNAPSHOT | 2026-08-30 03:41 IST: 0 live trips/queues/HELD/current demand/support/drafts/GPS; recheck before mutation |

Current docs checkpoint after go-live planning: `4941b538d0fc4c21b1b256ff08c20d961e58bc01`.

## 2026-08-30 Parasnath route + Driver alert preferences

| Area | Capability | Status | Evidence / next gate |
|---|---|---:|---|
| Fixed route | `PM-01` Parasnath → Madhuban | DEV MIGRATED | Current/published/active, ₹150/seat, direct 46-minute segment |
| Driver | Persistent route demand-alert choices | BUILT + DEV MIGRATED | Stored by route family; explicit On/Off control is separate from queue join |
| Driver | Existing preference migration | VERIFIED | Every existing active Driver retained only GD-01 from most recent served-route history; PM-01 requires opt-in |
| Security | Preference read/write boundary | VERIFIED | anon denied; authenticated allowed with internal active/unrestricted Driver guard; Passenger write rejected |
| Ride engine | FIFO / seat / trip isolation | VERIFIED | Preference migration does not mutate Driver queue, trips or seat requests; queue participation remains explicit |
| Discovery | Passenger + Driver see PM-01 | VERIFIED | Both canonical route projections return Parasnath → Madhuban correctly |
| Validation | Final candidate | PASS | TypeScript PASS · 31/31 contracts PASS · production build 23/23 PASS |
| Dev state | Operational pre/post migration | CLEAN | 0 live trips · 0 live queues · 0 HELD · 0 current demand · 0 drafts |

## 2026-08-30 Contact Raahi checkpoint

| Area | Capability | Status | Evidence / next gate |
|---|---|---:|---|
| Contact | Public suggestions / general enquiry | BUILT + DEV MIGRATED | `/contact` works without login through guarded RPC |
| Contact | Local business promotion enquiry | BUILT + DEV MIGRATED | Dedicated PROMOTION category and transparent free-service message |
| Contact | Driver / partner enquiry | BUILT + DEV MIGRATED | Dedicated DRIVER_PARTNER category |
| Admin | General contact inbox + resolve | BUILT + DEV MIGRATED | Separate from ride Support Inbox; Admin-only read/resolve RPCs |
| Security | Direct contact table access | VERIFIED DENIED | anon/auth table access revoked; anon may execute validated submit RPC only |
| Abuse guard | Repeat contact throttle | VERIFIED | Same contact cannot submit again within 10 minutes |
| Validation | Contact candidate | PASS | TypeScript PASS · 32/32 contracts PASS · production build 25/25 PASS |
| Browser | Public Contact responsive + submit | PASS | 390px + 1440px no overflow; synthetic PROMOTION reached Message received and was cleaned |

## 2026-08-30 Driver verification checkpoint

| Area | Capability | Status | Evidence / next gate |
|---|---|---:|---|
| Driver trust | DL / RC / car-photo upload | BUILT + DEV MIGRATED | Private `driver-verification` bucket, 8 MB guard, Driver-own upload/delete policies |
| Driver trust | Admin review | BUILT + DEV MIGRATED | Dedicated Users-area review page; VERIFIED/REJECTED are Admin-only guarded RPC outcomes |
| Privacy | Raw DL/RC exposure | BLOCKED BY DESIGN | Passenger trust projection contains booleans + vehicle identity only; raw scans stay Driver/Admin-only |
| Privacy | Approved car photos | GUARDED | Relationship helper allows Admin, Driver self or confirmed Passenger; Outstation may extend explicitly |
| Lifecycle | Replace/remove semantics | VERIFIED BY CONTRACT + DB | Replacement -> PENDING; remove -> MISSING/PENDING as appropriate; private object cleanup wired |
| Ride engine | FIFO / seats / GPS / trip isolation | PRESERVED | No ride-engine function redefined |
| Validation | Driver verification candidate | PASS | TypeScript PASS · 33/33 contracts PASS · production build 27/27 pages PASS |
| Headed upload/review | Real-account click-through | PENDING | Remote execution guard blocked the automated private-document preview; perform later with real headed browsers if needed |
# 2026-08-31 validated Demo Ready candidate

Candidate base before checkpoint: `39097d70258ce6f4fff0981058d36a54e8503357` on local branch `demo-ready-investor-polish-local`, targeting remote branch `demo-ready-investor-polish`.

- Outstation post-accept stale refresh: fixed.
- Outstation Areas v2: implemented in code and applied to Raahi V2 Dev as migration `20260831082254_demo_ready_outstation_service_areas_v2`.
- Independent areas: Gomoh, Dhanbad, Parasnath, Madhuban and Bokaro.
- Live Areas v2 proof: Bokaro-opted Driver saw 1 lead; non-opted Driver saw 0; Shared Ride preferences were unchanged; synthetic request/preference rows were cleaned to 0.
- Full synthetic Outstation lifecycle: request → verified Driver lead → quote → pre-accept phone privacy → one accepted quote → contact unlock; cleanup passed.
- Branding: master name is Raahi across metadata, PWA, OAuth callback and visible/accessibility surfaces.
- Dependency/release hardening: committed deterministic lockfile, CI uses `npm ci`, `.env` is untracked but retained locally, Next.js `15.5.24`, Supabase JS `2.112.4`, scoped PostCSS/Sharp overrides.
- TypeScript: PASS.
- Contract suite: 36/36 PASS.
- `git diff --check`: PASS.
- Production dependency audit: 0 vulnerabilities.
- Production build: PASS, 32/32 pages.
- Local production smoke on isolated port 4028: primary Passenger, Driver, Admin, Outstation, Offers and Contact routes returned 200; test-auth/staging safety failed closed; server shut down after testing.
- Port 4030 and Raahi School: untouched.

Supabase advisor snapshot (Raahi V2 Dev, 2026-08-31): project healthy on PostgreSQL 17; 37 performance notices (9 unindexed foreign keys, 8 RLS init-plan optimizations, 14 unused indexes, 6 multiple-permissive-policy notices). Security notices are predominantly expected linter visibility over the guarded `SECURITY DEFINER` RPC boundary; direct tables remain RLS-protected and the important role/ownership/privacy guards have separate contract and live acceptance evidence. Leaked-password protection is disabled and is an owner-controlled Auth hardening item if password authentication is enabled. No advisor-driven schema change was made during release closure.

# 2026-09-05 Raahi 2.0 New Marketplace Program

The validated Demo Ready product remains the current implementation baseline. A new company/platform architecture has now been frozen before the next major implementation wave.

| Program layer | Status | Authority / next gate |
|---|---:|---|
| Product Constitution | FROZEN v1 | Problem/actors/ownership/rules/states/privacy/money/safety doctrine |
| Product surfaces / user flows | PROVISIONALLY FROZEN | Must be reconciled into Experience North Star |
| Impact analysis vs current build | COMPLETE | Reuse vs replace vs extend vs new is understood |
| Acceptance architecture | COMPLETE IN PRODUCT REVIEW | Must be committed as implementation slices are designed |
| Company / Market architecture | FROZEN v1 | `RAAHI_2_0_ARCHITECTURE_FREEZE_V1.md` |
| UML / domain / state / sequence model | FROZEN v1 | `RAAHI_2_0_UML_FREEZE_V1.md` |
| Premium Experience North Star | NEXT | Passenger + Driver + Market Admin end-to-end target experience |
| Shared marketplace kernel | NOT STARTED | Begin only after Experience North Star freeze |
| Fixed One Way V2 vertical slice | NOT STARTED | First full implementation slice after kernel |
| Fixed Round Trip V2 | NOT STARTED | After One Way acceptance |
| Outstation common-kernel integration | NOT STARTED | Preserve existing marketplace strengths; extend deliberately |
| Carpool | NOT STARTED | New product |
| Raahi Trips / Explore | NOT STARTED | New product |
| Market intelligence / expansion system | DESIGNED, NOT BUILT | Travel Intent + emerging corridor + Market dashboards |

**Current rule:** do not interpret `NOT STARTED` as a defect in the accepted Demo Ready baseline. These rows describe the next Raahi company/platform generation.
