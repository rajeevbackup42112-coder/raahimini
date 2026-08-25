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
