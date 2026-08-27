# Raahi V2 Release Readiness

Status: pre-RC1 hardening on `v2.0-beta1`

This checklist separates feature completion from production approval. Nothing in this document authorizes production deployment or PR merge.

## Governing release rule

Raahi V2 may move toward production only when the proven V1/V10 booking, seat, FIFO and trip invariants remain green and every V2 feature is either verified or explicitly deferred.

## Green product capabilities

- Unified login, display identity and progressive profile completion.
- Passenger Home, Driver Home and unified live-trip/status cards.
- Real numbered seat selection backed by the authoritative seat ledger.
- No-driver `I need a ride` demand intent remains separate from booking.
- Persistent passenger demand recovery across navigation; supply only restores normal booking availability.
- Demand aggregation, rate-limited driver/admin visibility and return-demand intelligence.
- Directional pipelined dispatch: Start Trip hands the same-direction queue to the next FIFO collector; opposite directions operate independently.
- Driver economics: fare, full-car collection context, demand and return-fill guidance.
- Admin route-health board, exception-first operations and structured support inbox.
- Active-trip-only GPS with usable fix required at Start Trip and automatic terminal cleanup.
- Share My Raahi: one-trip, hashed token, revocable, read-only, no phone/history disclosure.
- Recent-route / Ride Again shortcut without auto-booking.
- Driver daily summary based on completed trips only.
- Cancellation, no-show and Admin queue exception paths audited against current V10 invariants.

## Current hardening work

- Passenger wait tolerance: 15 / 30 / 60 minute choice.
- Driver urgency signal uses only the shortest active stated wait.
- Urgency is advisory only and cannot influence FIFO, matching, booking or dispatch.
- Server-backed demand recovery survives navigation/session return and reports supply without booking.
- Matching active NOW demand becomes `SATISFIED` only after a real seat request is inserted.
- V2 Dev schema and branch code contain these projections and guards; current mobile acceptance has now been rerun against the simplified production bundle.

## Browser/device acceptance completed

- Demand recovery E2E passed on mobile Playwright: `I need a ride` -> leave -> real driver lifecycle restores supply -> `A Raahi car is available` -> explicit `Book Seat`.
- Wait tolerance 15 / 30 / 60 passed through navigation and reload, with canonical cancellation between cases.
- Responsive authenticated sweep passed 10/10 across Passenger, Driver and Admin at 360x800, 390x844 and 412x915, including horizontal-overflow and primary touch-target checks.
- Driver mandatory-location Start Trip flow was exercised with mobile geolocation emulation; the backend recent-fix safety gate remained intact.

## Staging gate

Before RC1 can be called release-ready:

1. Use a staging URL whose environment is guaranteed non-production.
2. Confirm staging uses only the isolated V2 Supabase environment and never V1/legacy production credentials.
3. Require `/api/staging-safety` to attest `safe: true` and the isolated V2 Dev Supabase project ref before Playwright starts.
4. Run the authenticated staging Playwright suite.
5. Run passenger, driver and Admin smoke paths on mobile-size and desktop-size viewports.
6. Capture failure evidence and resolve every invariant-affecting defect.

The staging workflow is test-only and does not deploy the application. It now fails closed when the URL is absent/non-HTTPS or when the target app cannot positively attest the isolated V2 Dev backend. No connected Vercel project currently exists, so no staging deployment is being created implicitly.

## Database / security gate

- Migration history must replay cleanly from an empty/disposable V2 database in canonical order.
- RLS and RPC privilege checks must be rerun for every V2 table/function added after Beta1.
- No client may directly mutate core operational tables.
- No public RPC may bypass verified-phone, role, seat-capacity, queue or trip-lifecycle rules.
- GPS/support/share projections must remain scoped and privacy-safe.
- No production or historical Supabase project may be touched during RC validation.

## Machine-free hardening results

Completed against isolated `Raahi V2 Dev` while the headed browser machine was unavailable:

- No client-accessible public table was found with RLS disabled.
- Anonymous SECURITY DEFINER RPCs are limited to intended public read projections: locations, route discovery, public active car, route demand summary and token-scoped shared trip.
- V2 RPC execute grants match intended boundaries: passenger/driver/admin commands require authenticated sessions; public share read remains token-scoped.
- `get_my_active_now_demand()` is authenticated-only and read-only.
- `get_route_demand_summary()` is aggregate/read-only and cannot mutate booking, queue or trip state.
- Supabase security advisor RLS-without-policy notices for RPC-only tables are expected because direct table grants are revoked.
- Leaked Password Protection remains an optional Auth hardening item; Raahi's normal login is Google/OTP rather than password-first.
- Advisor-recommended indexes were added for new V2 support/share/location lookup foreign keys.
- The advisor no longer reports those new V2 foreign keys as unindexed.
- Older V1 policy-shape performance warnings were intentionally not rewritten during this hardening pass.

Latest live invariant sweep returned zero violations for:

- client-accessible public tables without RLS;
- trip aggregate counts versus `trip_seats` ledger states;
- over-capacity/seat-ledger aggregate contradictions;
- duplicate active driver queue entries for the same driver/route;
- HELD/CONFIRMED seat-request counts versus their seat ledger;
- active NOW demand remaining for a passenger who has already created a HELD/CONFIRMED booking on the same route.

## Rollback gate

The RC rollback procedure is documented in `docs/RAAHI_V2_ROLLBACK_RUNBOOK.md`.

Key rule: application code may roll back to a known-good compatible build, but operational database state is forward-only by default. Database defects are repaired with reviewed forward migrations rather than destructive snapshot restores or ad-hoc row rewrites.

Operational rollback rehearsal remains pending until a guaranteed-nonproduction staging target exists.

## Clean-room migration replay

A fresh Supabase development branch/project is not currently present. Creating a Supabase branch requires an explicit billable-cost confirmation, so this was not done while the user was offline. The clean-room canonical migration replay remains a real RC gate rather than being inferred from the existing V2 Dev database.

## Production blockers

The following remain intentionally blocked until explicit approval:

- Merge PR #68.
- Create Raahi V2 Production Supabase.
- Copy or configure production secrets.
- Point a public production domain at V2.
- Run production migrations.
- Tag `v2.0.0`.

## Stretch features not required for production V2

These should not delay transport reliability:

- Loved-one start/arrival notifications.
- Family / multi-seat labels.
- Extended Raahi Insights and demand heatmaps.
- Local Offers / sponsored content.
- Idea voting / Help Shape Raahi.

Only promote a Stretch feature when the launch and staging gates above remain green.

## Corrected dispatch live proof

Validated in isolated Raahi V2 Dev after migration 20260823071332_v2_rc1_pipelined_dispatch.sql:
- Gomoh → Dhanbad Driver 1 was ACTIVE_COLLECTING #1; Driver 3 was WAITING #2.
- Driver 1 Start Trip changed Driver 1 to IN_PROGRESS and immediately activated Driver 3 for the next Gomoh → Dhanbad car.
- Dhanbad → Gomoh remained independently ACTIVE_COLLECTING throughout.
- Driver 4 joined as WAITING #3; completing Driver 1 did not activate Driver 4.
- Only when Driver 3 pressed Start Trip did Driver 4 become ACTIVE_COLLECTING.
- Return-demand RPC returned no signal before Start Trip and coarse Low after Start Trip.
- Synthetic Gomoh → Dhanbad test trips were closed through canonical lifecycle commands; no synthetic live queue/trip/GPS state remained.

## Current validation checkpoint

- Mobile-first UI simplification was developed from hardening base `15cd0f2`, packaged locally as `9ccd8fe`, and isolated from validation-only auth harness edits.
- Validate Raahi Mini workflow #299: **SUCCESS**.
- All 17 business / safety contracts, including corrected pipelined dispatch and Windows-safe test-auth guard: **PASS**.
- TypeScript: **PASS**.
- Production build: **PASS**.

## Final GO checklist

- [x] Latest validated code head green before this documentation-only refresh.
- [x] Demand recovery mobile browser acceptance green.
- [x] Wait-tolerance mobile browser acceptance green.
- [x] Final responsive authenticated passenger / driver / Admin sweep after latest UI changes green.
- [x] Full authenticated passenger seat/trip lifecycle previously proven green.
- [x] Full authenticated driver trip lifecycle previously proven green.
- [x] Admin route health / exception / support lifecycle previously proven green.
- [x] GPS start, fallback and cleanup green.
- [x] Share create / anonymous view / revoke / arrival-window behavior green.
- [x] Corrected pipelined two-driver/two-direction dispatch regression green in isolated Raahi V2 Dev.
- [x] Cancellation/no-show/seat-release invariant audit green.
- [ ] Migration replay on isolated release-candidate database green.
- [x] RLS/RPC privilege and live invariant audit green on V2 Dev.
- [ ] Guaranteed non-production staging E2E green.
- [ ] Rollback procedure rehearsed on guaranteed non-production staging.
- [ ] Explicit production approval received.

## Release-gate reopening — 2026-08-25

Manual real-user acceptance on `https://myraahi.referralhub.co.in` found UX/workflow issues that are now part of the approved product plan. As a result, the previous responsive-role acceptance remains useful historical evidence but is not sufficient for production approval after the upcoming changes.

Reopened gates:
- Passenger active-ride live location: must render a real Driver map/location experience with truthful stale fallback.
- Driver active-trip workflow: must remove pre-trip route-stop progression clutter and move toward pickup/drop-off action stops with one dominant next action.
- Driver trip transitions: any removal of manual Start Trip or Complete Trip requires canonical backend transition changes plus FIFO/GPS/trip regression proof before acceptance.
- Admin: Dashboard, Users and guarded Route Management require new role/security/audit acceptance before release.

Already implemented in this manual-acceptance phase:
- Admin Driver Onboarding route-guard fix.
- Vehicle type dropdown.
- Seat capacity 4/5/6/7/8 across onboarding UI/client/backend validation.

Before production consideration, affected flows must pass TypeScript, production build, relevant contract/invariant tests, focused headed/browser regression and manual real-user acceptance on the final staging domain. Production merge/deploy remains explicitly blocked until user approval.

## 2026-08-25 stage refactor gate

The release posture changed when the user froze Rocket Version 4 on `myraahi.referralhub.co.in` and moved active work to `myraahi-stage.referralhub.co.in`.

Additional gates before any later promotion over Version 4:
- [ ] Stage hostname deployed from the intended staging branch/configuration.
- [ ] Stage Supabase backend proven isolated from the frozen Version 4 deployment, or explicit shared-backend-change approval received.
- [ ] Operational-stop migration applied to Stage only.
- [ ] Driver can reach only meaningful pickup stops while collecting; empty intermediate stops require no manual progression.
- [ ] Boarding/payment confirmation is rejected before the Driver reaches the passenger pickup stop.
- [ ] Existing FIFO handoff, GPS Start Trip gate, seat ledger and cancellation invariants remain green.
- [ ] Passenger/Driver visible simplification passes real-device acceptance after the backend foundation is live.
- [ ] Passenger live map renders real Driver coordinates with stale/unavailable fallback.
- [ ] Admin Dashboard, Users and guarded Route Management complete their own acceptance before promotion if included in the same release train.

Until these gates are green, Rocket Version 4 remains the rollback and user-facing baseline.

## Production train override — Version 5

User gave explicit approval to evolve the current production deployment one numbered version at a time. The earlier blanket production block is superseded for this approved version-train workflow, but each version still requires its own preflight, migration/deploy evidence and live acceptance.

Version 5 release gate:
- [x] V4 application rollback ref created: `prod-v4-frozen` at `01759b63f786c93aa30ecbd3f72fc4556acc4728`.
- [x] Production DB preflight: 0 active trips, 0 live queue entries, 0 HELD requests.
- [x] Version 5 TypeScript check PASS.
- [x] Version 5 production Next.js build PASS.
- [x] Version 5 canonical Git commit pushed: `18eeec515e9c2ec2ee76929ff2435f979d748c27`.
- [x] Version 5 forward migration applied and verified.
- [x] Rocket Version 5 deployed to `myraahi.referralhub.co.in`.
- [x] Focused live Driver operational-stop journey accepted: destination-focused Driver screenshot PASS.
- [~] Neighboring behavior: FIFO/GPS contract boundary remained intact; Passenger mismatch was discovered and promoted to the dedicated V6 fix.

Do not begin Version 6 automatic Start Trip until the Version 5 live behavior is accepted or any discovered defect is understood.


## 2026-08-27 V6 combined validation result

- [x] V5 frozen application ref retained before V6.
- [x] V6 rebased onto latest remote production-train baseline instead of overwriting newer Git history.
- [x] Passenger primary screen removes legacy Driver Progress / route-stop counter.
- [x] Confirmed in-progress Passenger sees destination / on-the-way state.
- [x] Pre-pickup Passenger still sees pickup / driver-here state.
- [x] 19 contract files PASS, including V5 compatibility + V6 operational-sync contracts.
- [x] TypeScript PASS.
- [x] Production Next.js build PASS.
- [x] No V6 database migration required.
- [x] V6 commit pushed to the Rocket source branch: `be8eeaf242979cba228225ed297e5b11997331dd`.
- [ ] Rocket V6 deployed to `myraahi.referralhub.co.in`.
- [ ] Same live ride visually accepted on Driver + Passenger screens.

Do not start V7 automatic Start Trip until the V6 live alignment is accepted or any new discrepancy is diagnosed.

## 2026-08-27 Version 7 automatic departure gate

V6 deployment evidence:
- [x] User reports Rocket Version 6 published to `myraahi.referralhub.co.in`.
- [x] Production Passenger JS bundle independently checked: new V6 next-state strings present; legacy `Driver Progress` absent.
- [~] Paired authenticated Passenger/Driver screenshot acceptance was not separately captured before the user explicitly directed work to continue.

V7 candidate:
- [x] V6 frozen as `prod-v6-frozen` at `7a63aabf0aed5ccbc5821162f645241a3dd61ffe`.
- [x] Existing production `start_trip` implementation inspected before UI changes.
- [x] Automatic departure uses the canonical `start_trip` command rather than duplicating transition logic.
- [x] Server departure eligibility remains mandatory.
- [x] Fresh usable GPS remains mandatory and independently rechecked by backend.
- [x] Same-direction FIFO handoff remains inside canonical `start_trip`.
- [x] Close Empty Seats remains explicit; no silent capacity closure.
- [x] Manual Start Trip button/modal removed.
- [x] Pre-departure client GPS readiness expires at 50 seconds, before backend 60-second gate.
- [x] 21/21 contract files PASS.
- [x] TypeScript PASS.
- [x] Production Next.js build PASS.
- [x] No V7 database migration required.
- [x] V7 candidate pushed to Rocket source branch: `478be880aa458bfb0e1eb74c52f031c6bc521364`.
- [x] Rocket Version 7 deployed; production Driver bundle independently verified.
- [ ] Real Driver automatic-departure acceptance PASS.

Do not begin the next lifecycle/UI version until V7 live behavior is observed or any discrepancy is diagnosed.


## 2026-08-27 Version 8 Passenger live-map gate

- [x] V7 production bundle shows automatic-departure code and no manual Start Trip button string.
- [x] V7 rollback ref frozen as `prod-v7-frozen` at `c0aa81d46f8c8ca18d3901f1190f5b2eb4536dd4`.
- [x] Existing `get_active_trip_location` authorization/freshness contract inspected: `IN_PROGRESS` only, authorized trip participants/Admin only, 45-second freshness flag.
- [x] Passenger active ride renders a real Driver-position map using authorized latitude/longitude.
- [x] Fresh, last-known and unavailable states are explicitly distinguished.
- [x] Map refreshes about every 15 seconds.
- [x] No billable map API key or V8 database migration required.
- [x] Active-ride duplicate confirmation/destination cards removed; map carries boarded-at + destination context.
- [x] 22/22 contract files PASS.
- [x] TypeScript PASS.
- [x] Production Next.js build PASS.
- [x] OpenStreetMap embed endpoint reachable with HTTP 200 from validation device.
- [x] V8 candidate pushed to Rocket source branch: `04c5624a09a5712b3e46dbe81137d4a06960d52d`.
- [ ] Rocket Version 8 deployed.
- [ ] Real Passenger active-ride map visually accepted, including stale/unavailable fallback if practical.

Do not begin Admin V9 implementation until the V8 candidate is at least pushed and its production deployment state is understood.

## 2026-08-27 Version 9 Admin Dashboard + Users gate

V8 deployment evidence:
- [x] User reports Rocket V8 published.
- [x] Production Passenger bundle independently verified: live/last-known map states and OpenStreetMap embed present; legacy Driver Progress absent.
- [ ] Authenticated real-trip map screenshot acceptance captured.

V9 candidate:
- [x] V8 frozen as `prod-v8-frozen` at `3222802dcec1caa79140ff76b51b41e6d8e3914d`.
- [x] Dashboard / Users / Routes / Operations primary navigation built.
- [x] Dashboard live summary + route health + support exceptions + recent meaningful activity built.
- [x] Registered Users search/filters/detail built for Passenger, Driver and Admin.
- [x] Phone verified state comes from Auth confirmation, not editable client state.
- [x] Users → Make Driver reuses existing audited `admin_onboard_driver` workflow.
- [x] New V9 DB functions are admin-only, additive and read-only.
- [x] Current live-operation preflight recorded; no V9 operational table mutation required.
- [x] 23/23 contract files PASS.
- [x] TypeScript PASS.
- [x] Production Next.js build PASS.
- [x] V9 read-only migration applied and verified.
- [x] V9 candidate pushed to Rocket source branch: `b4af229dab950fbf14aa96c689b50e6c54853d12`.
- [x] Rocket V9 deployed; production bundle independently verified.
- [~] Admin Dashboard + Users bundle/role-gate implementation verified; authenticated Admin visual acceptance still to capture.

Do not begin V10 structural Route Management until V9 live behavior is accepted or any discrepancy is diagnosed.


## 2026-08-27 Version 10 guarded Route Management gate

V9 deployment evidence:
- [x] User reports Rocket V9 published.
- [x] Production Dashboard bundle contains Dashboard / Active trips / Recent activity.
- [x] Production Users bundle contains Passenger / Driver / Admin / Unverified / Restricted filters and Make Driver.
- [~] Authenticated Admin visual acceptance was not separately captured before the user explicitly directed V10 to proceed.

V10 candidate:
- [x] V9 application rollback reference preserved before V10.
- [x] Existing routes version-backfilled as current published v1 without changing active state.
- [x] Structural edits are draft-only; DRAFT is forced inactive/non-current.
- [x] Create / duplicate / edit / add-remove-reorder stops / preview / publish / discard / archive implemented.
- [x] Reorder supports drag plus touch-friendly arrow controls.
- [x] Publish and Archive reject live trips, live Driver queues and active passenger demand.
- [x] Prior published route/stops are archived rather than rewritten.
- [x] Passenger Ride Again resolves completed history to the current active route version.
- [x] New Route Management RPCs are Admin-guarded; anon execute denied.
- [x] Canonical Start Trip FIFO/GPS/freshness guards remain present and V10 does not redefine ride-engine commands.
- [x] Migration `v2_prod_v10_route_versioning` applied successfully.
- [x] Pre/post operational state unchanged: DG-01 1 active demand / no live trip; GD-01 1 live trip / no active demand.
- [x] 24/24 contract files PASS.
- [x] TypeScript PASS.
- [x] Production Next.js build PASS.
- [x] Final V10 runtime candidate pushed: `ce56d489e19d220862f104b928831ab30e6e56c8`.
- [x] Rocket V10 deployed at `07adb1a549493bbf8778d281e3af8882eb1002e2`.
- [x] Admin Routes live acceptance PASS: authenticated draft create/edit, current-route isolation, busy-route publish rejection, and live UI discard.
- [~] Neighboring route semantics were preserved during acceptance; a successful real version publish was intentionally not performed on the live two-route network.

Do not begin V11 Operations expansion until V10 live behavior is accepted or any discrepancy is diagnosed.

## 2026-08-27 Version 11 consolidated Operations gate

V10 live acceptance:
- [x] Rocket V10 authenticated Admin Routes UI verified.
- [x] GD-01 draft v2 created/edited while v1 had a live trip; published v1/live trip remained unchanged.
- [x] Canonical Publish rejected the busy route; test draft discarded.
- [x] V10 rollback frozen at `prod-v10-frozen` -> `07adb1a549493bbf8778d281e3af8882eb1002e2`.

V11 candidate:
- [x] Live trips, shared next-action truth, GPS health, FIFO queue, support and Driver recovery consolidated.
- [x] Existing guarded queue reorder/remove, Driver deactivation and support resolution remain the only Operations mutation paths.
- [x] New `admin_get_live_trip_operations()` migration is read-only and Admin-guarded.
- [x] Anon execute denied; authenticated execute granted, with `is_admin()` enforced.
- [x] Production pre/post migration state unchanged: 1 live trip, 0 waiting Drivers, 0 open support cases, 1 live-location row.
- [x] Authenticated Admin-context projection execution succeeds against current live state.
- [x] Canonical Start Trip still contains FIFO activation and GPS guard logic.
- [x] 25/25 contracts PASS.
- [x] TypeScript PASS.
- [x] Production Next.js build PASS (23/23 static pages).
- [x] V11 committed/pushed to Rocket source branch: `29b041c760f738d02492c19fa0368d79834f86bd`.
- [ ] Rocket Version 11 deployed.
- [ ] Authenticated Admin Operations visual acceptance PASS.
