# Raahi V2 Handover

Updated: 2026-08-24 12:12 IST
Project: **Raahi 2.0 only — do not mix with Raahi School.**
Repository: `rajeevbackup42112-coder/raahimini`
Branch: `v2.0-beta1`
PR: **#68 — draft, open, unmerged**
Committed documentation head before this handover refresh: `04920b8`
Latest validated implementation checkpoint: `636ce21` — `fix: pipeline directional dispatch at trip start`
Local mobile-first hardening package: `9ccd8fe` — `feat: simplify mobile passenger and driver flows` (local only; not merged or deployed).
CI: **Validate Raahi Mini #299 SUCCESS** on the validated implementation line.

## Executive status

Raahi 2.0 is in **pre-RC1 hardening**. The major launch experience is built; current work is release confidence rather than broad feature construction.

The product now materially delivers the V2 objectives: passenger certainty, driver economics, Admin exception-first operations, active-trip privacy/GPS, loved-one visibility, repeat-use convenience and safer release discipline while preserving the proven V1/V10 engine.

The mobile-first simplification pass is now validated. Do **not** start another redesign pass; preserve the simplified hierarchy and close the remaining release-infrastructure gates.

## Canonical working model

The assistant acts as both Project Owner/Manager and Implementer/Builder. Work end-to-end when safe. Stop only for credentials/auth boundaries, billable resources, genuinely unresolved product choices, destructive/security-sensitive changes, or explicit production/merge approval.

## Major capabilities built and proven

- Unified login, trusted role routing, visible display identity and progressive profile completion.
- Passenger Home and unified journey/status experience.
- Exact numbered seat selection backed by the authoritative `trip_seats` ledger; deliberate Seat 3 hold/confirmation/My Ride display proven.
- No-driver demand intent remains separate from booking.
- Persistent demand recovery is implemented: Raahi remembers the request and can surface `A Raahi car is available`; explicit booking is still required.
- Passenger wait tolerance and urgency projection are implemented as advisory demand metadata.
- Driver current-route economics, fare/full-car context and demand guidance.
- Direction-specific pipelined FIFO dispatch: **Start Trip is the same-direction handoff**; opposite directions operate independently.
- Post-start-only reverse demand signal: **Low / Medium / High**, advisory only.
- Admin route-health-first dashboard, exceptions and structured support inbox/resolve flow.
- Structured Passenger/Driver Help that does not silently mutate trips.
- Active-trip-only GPS, Start Trip location gate, truthful fallback and automatic terminal cleanup.
- Share My Raahi one-trip secure link, anonymous read-only loved-one view, revoke behavior and up-to-30-minute successful-arrival visibility.
- My Raahi recent-route / Ride Again shortcut with no auto-booking.
- Driver daily summary based on completed trips/fare records.
- Current cancellation/no-show/Admin queue paths audited against V10 seat/FIFO/trip invariants.
- Staging-target safety guards, auth ingress/role-boundary contracts, RLS/RPC privilege checks and live invariant sweeps.

## Validation already green

- 17 business/safety contract files: PASS.
- TypeScript `tsc --noEmit`: PASS.
- Production Next.js build: PASS against isolated V2 Dev configuration.
- Mobile demand recovery: PASS through real driver lifecycle and explicit `Book Seat`.
- Wait tolerance 15/30/60: PASS through leave/reload persistence.
- Responsive authenticated sweep: 10/10 PASS across Passenger, Driver and Admin at 360/390/412px widths.
- Validate Raahi Mini #299: SUCCESS.
- Live pipelined-dispatch proof in isolated Raahi V2 Dev passed for same-direction handoff and opposite-direction independence.
- RLS/RPC privilege and live invariant sweep passed for current V2 additions.
- Exact-seat, support, GPS, Share My Raahi, terminal GPS cleanup, recent-route reuse and core passenger/driver/admin lifecycle acceptance have all been exercised successfully.

## Remaining release gates — do these next

1. **Clean-room migration replay:** replay canonical migrations from empty/disposable isolated RC database. Creating a new Supabase branch/project is billable and requires explicit user approval.
2. **Guaranteed non-production staging E2E:** target must positively attest isolated V2 backend before tests start.
3. **Rollback rehearsal on staging:** application rollback + forward-only database recovery procedure.
4. **Explicit user production approval:** only then merge PR #68, create V2 Production, configure secrets, migrate, deploy and tag.

## Local Dipti state

Canonical checkout: `C:\Users\Dipti\RaahiV2Current`

The branch currently matches `origin/v2.0-beta1`, but the working tree contains **local validation-only auth harness edits and helper scripts** (`next-env.d.ts`, test-auth/auth callback/middleware/contracts plus local patch/run helpers). These are not canonical product changes and must not be casually committed. Inspect before cleaning or switching worktrees.

## Single next action

The next unresolved RC gate is the clean-room migration replay, which requires explicit approval because creating a fresh Supabase branch/project is billable. Until that approval, preserve the validated mobile-first package and do not merge or deploy it.

## Hard boundaries

- Do not touch Raahi School.
- Do not merge PR #68 without explicit approval.
- Do not create V2 Production, configure production secrets, run production migrations, deploy production or tag `v2.0.0` without explicit approval.
- Do not touch V1 production or historical/production-linked Supabase during V2 work.
- Do not weaken authentication/test-auth safety to make browser tests pass.
- Demand, urgency, return-demand, economics, support, GPS and sharing must never bypass canonical booking/seat/FIFO/trip commands.
- Never force-push over newer work.

## New-chat bootstrap

> This is **Raahi 2.0 / raahimini**, not Raahi School. Read `docs/RAAHI_V2_HANDOVER.md`, `docs/RAAHI_V2_DECISIONS.md`, `docs/RAAHI_V2_BIBLE.md`, `docs/RAAHI_V2_BUILD_MATRIX.md`, and `docs/RAAHI_V2_RELEASE_READINESS.md`. Verify GitHub and the isolated V2 Dev environment before acting. Resume from the single next action. Work autonomously; stop only for credentials, billable infrastructure, a genuinely new product decision, destructive/security-sensitive action, or production/merge approval.

## 2026-08-25 live staging / manual acceptance update

The active staging domain is now `https://myraahi.referralhub.co.in`, deployed through Rocket from the Rocket staging branches. Manual real-user acceptance is active and has intentionally reopened some UX work.

Recent implemented staging changes:
- Admin `/admin-driver-onboarding` route guard fixed so Admin is not redirected back to `/admin-panel`.
- Driver Onboarding vehicle type changed to a controlled dropdown.
- Seat capacity expanded to 4/5/6/7/8 in UI/client and canonical V2 Dev onboarding RPC validation.
- TypeScript and production build passed after the vehicle-option changes.

User-approved next product direction:
- Passenger live Driver location should render as a real map, not only a freshness/status card.
- Driver should see only meaningful pickup/drop-off stops and one dominant next action.
- Manual Start Trip/Complete Trip should be removed only through a deliberate backend state-machine redesign; current RPC lifecycle remains authoritative until that work is implemented and revalidated.
- Admin should gain Dashboard, Registered Users, guarded full Route Management, and Operations surfaces.

Release status is therefore **manual-acceptance / focused simplification in progress**, not production-ready. Previously green Passenger/Driver/Admin responsive acceptance is historical evidence and must be rerun for each affected redesigned flow.

Documentation discipline: every code/migration/product decision in this phase must update the Bible, Decision Log, Build Matrix and this Handover; Release Readiness must be updated whenever a release gate changes.

## 2026-08-25 22:21 IST — Stage / Prod V4 split and next-state foundation

User changed hosting roles:
- Frozen baseline: `https://myraahi.referralhub.co.in` — Rocket Version 4, keep intact.
- Active development stage: `https://myraahi-stage.referralhub.co.in`.

Stage branch baseline before this slice: `01759b63f786c93aa30ecbd3f72fc4556acc4728` on `rocket-staging-ready`.

Implemented locally for the next commit:
- staging bootstrap `NEXT_PUBLIC_SITE_URL` changed to the new stage hostname;
- `DriverActiveTrip` client contract extended with `next_action`, `next_operational_stop`, `operational_stops`;
- new migration `20260825223000_v2_stage_operational_stops.sql` defines meaningful Driver progression: next unresolved pickup while collecting, destination while in progress, and boarding confirmation only at the actual pickup stop.

Validation so far: TypeScript PASS; Next.js production build completed successfully against the staging branch configuration.

**Do not apply the new migration yet.** Current evidence still points Stage at Raahi V2 Dev, and frozen Prod V4 may share that backend. Applying it would alter Version 4 operational behavior even though the frontend deployment is frozen. First establish backend isolation or obtain explicit user approval for shared-backend impact.

Next action after committing this Git-only foundation: verify/establish safe Stage backend separation, then apply the operational-stop migration to Stage only and run focused Driver regression before changing visible Driver UI.

## 2026-08-25 23:06 IST — production train approved

The user explicitly replaced the temporary Stage-first plan with a one-version-at-a-time production rollout on `https://myraahi.referralhub.co.in`. Treat the earlier Stage/Prod split section above as historical/superseded.

Version 4 application baseline is frozen on Git branch `prod-v4-frozen` at `01759b63f786c93aa30ecbd3f72fc4556acc4728`. Database rollback remains forward-repair only.

Version 5 candidate implements Driver meaningful-stop progression: unresolved pickup stops only while collecting; boarding/payment confirmation only at the actual pickup stop; after the existing Start Trip transition, progression goes to the route destination. Manual Start Trip intentionally remains for V5. Production hostname is added to the hard-block list for staging/test-auth endpoints.

V5 preflight immediately before release work: 0 active trips, 0 live queue entries, 0 HELD requests. TypeScript PASS and production Next.js build PASS.

Release sequence: commit/push V5 candidate and canonical migration -> apply forward migration -> deploy Rocket Version 5 -> focused live Driver/Passenger acceptance -> only then begin V6 automatic Start Trip.

## 2026-08-26 — Version 5 passenger acceptance patch

Live V5 acceptance proved the Driver screen correctly presents the destination after Start Trip, but the Passenger screen still showed the legacy `Driver Progress / Stop N of M` route-stop model and continued to say the Driver was at the pickup stop after the passenger had already boarded.

Approved correction is application-only: once a passenger request is `CONFIRMED` and the trip is `IN_PROGRESS`, Passenger must show the same next meaningful event as Driver — the trip destination. The pickup label is removed from the dominant trip card, a `Your destination` card is shown, and the intermediate stop-progress card is suppressed for that state. Pre-pickup passenger progress remains unchanged.

Git changes on `rocket-staging-ready`:
- Passenger UI alignment commit `e2b447dbe604ef167382b0623bda08c0d5c61537`.
- Focused contract `tests/contracts/passenger-next-state-v5-contract.cjs`, commit `6a46ccbae78bc22431dbeff408f3133f3886597a`.
- Decision/Build/Handover documentation follows on the same branch.

No database migration is needed for this acceptance patch. Do not begin Version 6 automatic Start Trip until this Passenger patch is revalidated (contract suite + TypeScript + build) and deployed/accepted live. The remote validation device became unavailable while this patch was being prepared, so revalidation is the single next action before Rocket redeploy.


## 2026-08-27 V6 combined-baseline validation

GitHub `rocket-staging-ready` had advanced to `7a8817738f2ff799299457cbf819c495afbf3ad3`; V6 work was rebased onto that remote baseline rather than overwriting it. The remote V5 Passenger patch is preserved and V6 supersedes its partial stop-progress behavior.

Combined V6 candidate: all 19 contract files PASS, TypeScript PASS, production Next.js build PASS. No database migration is required. V6 runtime commit is `be8eeaf242979cba228225ed297e5b11997331dd`; remaining gates are Rocket deployment and live Passenger/Driver visual acceptance.

Admin roadmap is now documented in `RAAHI_V2_ADMIN_CONTROL_PLAN.md`: V9 Dashboard + Registered Users, V10 guarded Route Management, V11 Operations. V7 remains automatic Start Trip; V8 remains real Passenger live map.

## 2026-08-27 V7 automatic departure candidate

The user deployed Rocket V6 and explicitly directed the production train to continue. A direct production-bundle check confirmed the V6 Passenger chunk contains the new `Requested`, `On the way`, `You are aboard` and destination-focused strings and no longer contains `Driver Progress`.

V7 is application-only. `DriverActiveCarContent` removes the Start Trip button/modal and automatically invokes the existing canonical `start_trip` RPC when `departure_eligible` and fresh local GPS readiness are both true. `DriverTripLocationPanel` expires pre-departure readiness after 50 seconds and refreshes into continuous IN_PROGRESS tracking after automatic start. `Close Empty Seats` stays explicit; Complete Trip stays manual.

Backend inspection confirmed `start_trip` still owns the authoritative invariants: no HELD requests, confirmed + driver-closed = capacity, fresh location <=60 seconds, accuracy <=200m, trip transition to IN_PROGRESS, and `activate_next_driver(route_id)` same-direction FIFO handoff. No V7 migration is needed.

Validation: 21/21 contract files PASS, TypeScript PASS, production build PASS. V7 runtime/docs candidate `478be880aa458bfb0e1eb74c52f031c6bc521364` is pushed to both `prod-v7-candidate` and `rocket-staging-ready`. Next action: deploy as Rocket Version 7, then exercise one real Driver flow with (a) full manifest automatic start and (b) empty-seat close followed by automatic start if practical.


## 2026-08-27 V8 Passenger live-map candidate

V7 production bundle check after user deployment: automatic-departure markers present; manual `Start Trip to` absent. `prod-v7-frozen` now preserves `c0aa81d46f8c8ca18d3901f1190f5b2eb4536dd4`. A real full-manifest automatic-departure ride has not yet been separately captured, so keep that as a neighboring acceptance item.

V8 is application-only. `PassengerLiveLocationStatus` now renders the authorized Driver coordinates on a keyless OpenStreetMap embed, polling every 15 seconds. Fresh/last-known/no-location states are distinct and truthful, and the embed sends no Raahi page referrer. The map card includes boarded-at and destination context; during `IN_PROGRESS` the old duplicate confirmation/destination cards are suppressed. Existing phone/share/support actions remain.

Validation: 22/22 contracts PASS, TypeScript PASS, production build PASS, OpenStreetMap embed HTTP 200. No database migration. Next: push V8 candidate to the Rocket source branch, deploy as Version 8, visually accept a real Passenger active ride, then begin Admin V9 Dashboard + Registered Users.

V8 runtime candidate `04c5624a09a5712b3e46dbe81137d4a06960d52d` is pushed to both `prod-v8-candidate` and `rocket-staging-ready`.

## 2026-08-27 V8 live + V9 Admin candidate

Production V8 is serving the new Passenger map bundle. Frozen rollback ref: `prod-v8-frozen` → `3222802dcec1caa79140ff76b51b41e6d8e3914d`.

V9 candidate is based directly on that V8 head. Built changes: Admin Home is now a live Dashboard; primary nav is Dashboard / Users / Routes / Operations; new `/admin-panel/users` provides searchable registered-user detail with Passenger/Driver/Admin, phone-verification, restriction, operational-state and vehicle context; eligible Passengers deep-link into existing Driver onboarding with their profile preselected.

New migration `20260827164000_v2_prod_v9_admin_dashboard_users.sql` is additive/read-only and defines three admin-only projections: dashboard summary, all registered users, recent meaningful audit activity. Current preflight while V9 was built: 16 profiles, 5 Driver rows, 1 live trip, 1 live queue entry, 0 HELD requests, 0 open support cases. The live ride does not block this migration because it performs no operational writes.

Validation: 23/23 contracts PASS, TypeScript PASS, production build PASS. Next gates: commit/push V9 → apply/verify read-only migration → Rocket V9 deploy → Admin visual/role acceptance. Do not begin V10 structural Route Management before V9 is understood live.

V9 DB verification after push: migration applied successfully. Admin-context checks returned 16 registered profiles (9 Passenger, 5 Driver, 2 Admin); anon execute is denied and authenticated execute is granted for all three new RPCs. Dashboard projection returned the current live state without mutating the one active trip. Runtime candidate: `b4af229dab950fbf14aa96c689b50e6c54853d12`. User reports Rocket V9 deployed; production bundle independently contains Dashboard, Registered Users, Active trips and Recent activity. Authenticated Admin visual acceptance remains the next live gate.


## 2026-08-27 V10 guarded Route Management candidate

V9 is live and its production Admin bundles were independently verified. V9 rollback reference remains `prod-v9-frozen`. The user directed the production train to continue despite authenticated Admin visual evidence not being separately captured.

V10 is now implemented and migrated. Final runtime candidate: `ce56d489e19d220862f104b928831ab30e6e56c8`; initial foundation commit: `2c6191e9512e948c6474c535d9ad7770242682f4`. New migration `20260827174500_v2_prod_v10_route_versioning.sql` / applied migration name `v2_prod_v10_route_versioning`. Existing routes became current published v1 rows in their own route families; migration created no drafts and did not change live operations. Pre/post state: DG-01 retained 1 active demand and no live trip; GD-01 retained 1 live trip and no active demand.

Admin Routes now supports New Route, Duplicate, draft-based structural editing, add/edit/remove/reorder stops (drag + touch arrows), publish preview, guarded Publish, Discard Draft, Fare, Pause/Enable and Archive. Publish/Archive are blocked if the current route has a live trip, live queue or active demand. Old route/stops are archived, not rewritten. Passenger `Ride this route again` resolves to the current active route version.

Security/regression: anonymous execute is denied for the new Route Management RPCs; authenticated execute is granted but every RPC checks Admin. Canonical `start_trip` still contains FIFO activation and GPS/freshness guards. V10 does not redefine Start Trip, queue join/activation or seat booking. Validation: 24/24 contracts PASS, TypeScript PASS, production Next.js build PASS.

Next action: deploy latest `rocket-staging-ready` as Rocket Version 10, then visually accept Admin Routes: create/edit a draft without affecting Passenger/Driver, confirm a blocked publish on a busy route if naturally available, and publish only an idle test change after explicit care. Do not begin V11 Operations expansion until V10 is understood live.


## 2026-08-27 V10 live acceptance

Rocket V10 is live at `07adb1a549493bbf8778d281e3af8882eb1002e2`; rollback branch `prod-v10-frozen` points to that exact deployment source. Production bundle and authenticated Ajit Admin screen both showed the V10 Route Management UI. A GD-01 draft v2 was created while GD-01 had one live trip, Stop 3 was changed only inside the draft, and the published v1 Stop 3 remained `Bachra Road`. The canonical publish RPC rejected the draft with `Publish is blocked while this route has a live trip`. The test draft was then discarded through the live UI; final state is zero GD-01 drafts, one current active published GD-01 v1 and the same live trip. No real route version was published during acceptance. V11 Operations is the next active production slice.

## 2026-08-27 V11 consolidated Operations candidate

V10 production acceptance is complete and frozen at `prod-v10-frozen` -> `07adb1a549493bbf8778d281e3af8882eb1002e2`; the acceptance-doc checkpoint is `10a15f5724faafc543db05ea11c0af6f0d4dde05`.

V11 branch `v11-operations-candidate` is based on that accepted checkpoint. Operations now consolidates live trip/next-action state, GPS health, queues, support and guarded Driver recovery. Migration `20260827194500_v2_prod_v11_admin_operations.sql` defines only `admin_get_live_trip_operations`; no ride-engine command is redefined. The migration is applied, and an authenticated Admin-context invocation returned the current GD-01 IN_PROGRESS ride as `DRIVE_TO_DESTINATION` with stale GPS, proving the projection executes.

Validation: 25/25 contracts PASS, TypeScript PASS, production build PASS. V11 runtime commit `29b041c760f738d02492c19fa0368d79834f86bd` is pushed to `prod-v11-candidate` and `rocket-staging-ready`. Next action: Rocket Version 11, then authenticated Admin Operations acceptance.

## 2026-08-27 V11 live acceptance

Rocket V11 is serving the `66c543e865d2998c5bf3c066b56f81acb19ffa87` source line. Production bundle markers and the authenticated Admin Operations screen confirm the V11 UI. It showed one live GD-01 trip with Naresh Kumar / JH10NK1234, `Drive to destination`, destination Dhanbad Station, stale GPS, no waiting Driver queue and no open support cases. Account/Profile is linked from the Admin header. Backend state matched the UI and no live ride data was changed during acceptance. `prod-v11-frozen` preserves the exact deployed source. The approved V9-V11 Admin roadmap is complete.

## 2026-08-27 V12 automatic completion candidate

V11 is production-accepted and frozen at `prod-v11-frozen` -> `66c543e865d2998c5bf3c066b56f81acb19ffa87`. V12 is based on the post-V11 documentation checkpoint `3d979ff2fcc93e85ba9b1f6eb527d500f48a4977`.

V12 removes the Driver Complete Trip button/modal. After the Driver explicitly taps Arrived at the route destination, `get_driver_active_car()` returns `COMPLETE_TRIP`; the client then invokes canonical `complete_trip()` automatically once. A failed finalization exposes Retry finalization without bypassing backend guards. No DB migration is required.

Backend review confirmed `complete_trip()` still requires the authorized active Driver, `IN_PROGRESS`, and current stop equal to the final route stop; it records COMPLETED, queue DONE, Driver trip count, behaviour and audit. Existing trip-status triggers retain terminal GPS cleanup/share expiry.

Validation: 26/26 contracts PASS, TypeScript PASS, production build PASS (23/23 static pages). GitHub Validate Raahi Mini run #315 also passed; its temporary full-contract CI shim was removed and PR #73 was closed unmerged. Runtime/test checkpoint: `fe22cae60217983ac788131f0217605ea0068c30`. Next action: push final V12 docs checkpoint to `rocket-staging-ready`, deploy Rocket Version 12, then live-test explicit destination arrival -> automatic completion and Passenger Arrived state.

## 2026-08-28 V13 pre-go-live hardening candidate

V12 automatic completion was production-proven in a headed authenticated Driver session: Arrived-at-destination caused canonical automatic completion with terminal queue/accounting/GPS/share cleanup. The final broad headed sweep then found four blockers: Admin chrome visible anonymously, role-profile loading flash, Users mobile overflow at 390px, and expired demand incorrectly blocking Route Publish/Archive.

V13 runtime commit `fc02d33616cab0fbf26aa5ec04c30a5fcde8ab0a` fixes those four issues only and is pushed to `prod-v13-candidate` and `rocket-staging-ready`. Migration `20260828083000_v2_prod_v13_pre_go_live_hardening.sql` / `v2_prod_v13_pre_go_live_hardening` is applied. It only redefines existing Admin route list/publish/archive RPCs to ignore expired demand windows. Privileges remain anon denied / authenticated granted with Admin guard.

Validation is green: 27/27 contract files, TypeScript and production Next.js build (23/23 pages). Canonical stale-demand cleanup expired 1 old row. Current backend cleanup state is 0 live trips, 0 live queue entries, 0 route drafts and 0 expired-but-ACTIVE demand rows.

Next gate: deploy latest `rocket-staging-ready` as Rocket Version 13. Then rerun headed production acceptance with Ajit/Admin, Rajeev1/Passenger, Naresh/Driver and Rajeev4/second Driver, including mobile Users, anonymous Admin ingress, role-loading behavior, fresh full ride lifecycle, seat concurrency and two-Driver FIFO. Do not declare GO LIVE until all blocking cases pass.

## 2026-08-28 V14 auth hydration hotfix candidate

After Rocket V13 deployment, headed production checks confirmed anonymous `/admin-panel` is correctly gated, but authenticated Ajit Admin pages stayed blank/loading and Naresh Driver pages stayed header-only. Root cause: V13 made `onAuthStateChange` async and awaited `loadProfile`, which can deadlock profile requests behind the auth callback.

V14 fixes only that sequencing: the auth event callback stays synchronous and schedules `hydrateSession` after it returns; loading remains true until profile hydration finishes. Validation is green: 28/28 contracts, TypeScript, production build. Runtime candidate: `65c1c4ed0e01dee12a02d4905e4a53ea289f5c83`. Next gate: Rocket V14, then repeat V13 headed checks before continuing final multi-user acceptance.

## 2026-08-28 final go-live handover

V14 is the final accepted production source for this release train. Rocket served `38b7519d615e171c59d537b18a61c1ba303c132f`; `prod-v14-frozen` points to that exact source.

Final headed acceptance used Rajeev1 Passenger, Naresh Driver, Rajeev4 second Driver and Ajit Admin. Rajeev4 was onboarded through the guarded Admin flow with TATA TIAGO / JH10RS1234 / 4 seats. Same-direction FIFO was proven live: Naresh collected first, Rajeev4 waited second, and canonical Start Trip promoted Rajeev4 exactly when Naresh departed.

A fresh Rajeev1 + Naresh ride proved booking, boarding/payment, Close Empty Seats, real-browser GPS automatic Start Trip, live Passenger map, stale/recovered GPS display, explicit destination arrival, automatic completion and Passenger Arrived. Final backend state: trip COMPLETED at stop 6, queue DONE, live GPS 0, active share links 0. Final environment cleanup is zero across live trips/queues/HELD/current demand/open support/drafts/GPS.

Release status: GO-LIVE READY. Do not alter FIFO, GPS, seat ownership, phone verification or lifecycle commands during launch-day support; use only existing audited recovery/configuration paths.

## 2026-08-30 Demo Ready → go-live handover

The investor-polish track is now complete through Admin Access. Screen 16 repaired the real `admin_list_role_accounts()` enum/text projection defect in Git while preserving Admin grant/revoke/self/final-admin/Driver-role guards. Screen 16 checkpoint: `1f074897059afeba2211a76c04331a554bab8465`.

Go-live engineering candidate `b937c40996805caab57b804b5f588975a9e97aa6` is pushed to `demo-ready-investor-polish`. It sets the candidate site identity to `https://ride.myraahi.co.in`, hard-blocks the new production hostname from test-auth/staging safety endpoints, and adds a signature-verified Supabase Send SMS Hook implementation that forwards Supabase-generated OTPs to Fast2SMS. Fast2SMS never verifies Raahi OTPs.

Candidate validation: TypeScript PASS, 30/30 contracts PASS, production Next.js build PASS (23/23 pages). Production has not received this code, the Admin Access migration, an Edge Function, an Auth Hook or DNS changes.

Read-only production preflight at 2026-08-30 03:41 IST: 0 live trips, 0 live queue entries, 0 HELD requests, 0 current ACTIVE demand, 0 open support cases, 0 route drafts and 0 live GPS rows. The Admin Access repair is still unapplied; production lists zero Edge Functions. Recheck all operational counts immediately before mutation.

The user owns `myraahi.co.in`. Planned app hostname: `ride.myraahi.co.in`. Initial DNS lookup immediately after purchase returned no apex or `ride` resolution, so wait for registration/nameserver propagation and obtain the exact custom-domain DNS target from the hosting provider; do not guess A/CNAME values. Keep `myraahi.referralhub.co.in` as rollback during cutover.

Next action: obtain Fast2SMS API key + OTP ID/template and the hosting custom-domain target. Then, with explicit production approval, deploy `send-sms`, configure secrets + signed Supabase Auth Hook, prove one real OTP through Supabase verification, apply the Admin Access forward migration, configure `ride.myraahi.co.in`, and run the full new-domain real-account acceptance in `docs/RAAHI_V2_GO_LIVE_PLAN.md`.

## 2026-08-30 Parasnath fixed-route + Driver alert-preference checkpoint

New Dev route `PM-01` is live in the existing Raahi V2 Dev backend: Parasnath → Madhuban, ₹150/seat, current/published/active, with endpoint stops Parasnath (0) and Madhuban (46 minutes). Passenger and Driver canonical route discovery both return the new route.

Migration `20260830111500_demo_ready_driver_route_preferences_parasnath.sql` adds `driver_route_preferences` keyed by Driver + route family. Existing active Drivers were seeded only to their most recently served route; all current existing Drivers therefore remained GD-01-only and PM-01 requires explicit opt-in.

Driver Home now exposes a separate Demand alerts On/Off choice per departing route. This preference filters realtime demand notifications but does not join the queue. Queue join, one-live-queue-per-Driver and per-route FIFO remain unchanged. When demand arrives for a subscribed route at another stand, the in-app action takes the Driver to that route rather than silently joining.

A reversible authenticated Beta1 Driver proof subscribed PM-01, read back GD-01 + PM-01, unsubscribed PM-01 and returned to GD-01-only. A Passenger write attempt was rejected with `Active Driver access required`. RPC privileges are anon denied / authenticated granted with internal Driver checks.

Validation: TypeScript PASS, 31/31 contracts PASS, production Next.js build PASS (23/23 pages). Dev operational state remained 0 live trips, 0 live queues, 0 HELD, 0 current demand and 0 route drafts.

Next product slice after this checkpoint: general Contact Raahi → Driver verification foundation → Outstation lead/quote marketplace → Local Offers → branding integration → hosted-domain acceptance.

## 2026-08-30 Contact Raahi checkpoint

General Contact Raahi is now implemented and migrated on Raahi V2 Dev. `/contact` is public and available before or after sign-in with categories for Suggestion, Promote my business, Driver / partner enquiry, General help and Other. It explicitly keeps ride-specific problems on the existing in-ride `Need Help?` path.

Migration `20260830114500_demo_ready_contact_raahi.sql` adds `contact_messages` plus one public validated submit RPC and two Admin-only read/resolve RPCs. Direct table access is revoked. The public path accepts anon/authenticated callers, validates lengths/categories and blocks repeat submissions from the same contact for 10 minutes. Admin resolution is audited.

Admin primary navigation is unchanged. Operations Support Inbox links to `/admin-panel/contact`, which lists open general enquiries and resolves them without touching ride state.

Validation: anonymous submit + duplicate guard + Passenger Admin denial + Admin read/resolve all passed with synthetic cleanup; TypeScript PASS; 32/32 contracts PASS; production build PASS (25/25 pages). Public headed acceptance on local isolated port 4028 passed at 390px and 1440px with no overflow and successful PROMOTION submission. Synthetic data was removed.

Next slice: Driver verification foundation for Driving Licence, Vehicle RC and car photos. Raw document assets must remain Admin-only; passengers should later see verified status plus approved vehicle/car-photo information, not unrestricted document scans.

## 2026-08-30 Driver verification checkpoint

Driver Verification is implemented on `demo-ready-investor-polish` after Contact Raahi. The Dev backend has a private `driver-verification` Storage bucket plus reviewed `driver_verifications` / `driver_verification_documents` state. Driver Home links to `/driver-verification`; Admin Users links to `/admin-panel/verifications`.

DL and RC are private to Driver/Admin. Approved car-photo/trust access is relationship-scoped through `can_view_driver_trust()`: Admin, Driver self, or a Passenger with a CONFIRMED fixed-route seat relationship. Outstation should extend that helper only for the Passenger/Driver participants of a real request/quote; do not make the bucket or trust projection globally authenticated-readable.

Replacing an identity document resets its group to PENDING and attempts to delete the retired private object. Removing a current document updates verification state and deletes the Driver-owned Storage object through a Driver-own DELETE policy. Admin review cannot verify a group with no current upload.

Backend proof: unrelated Passenger trust request denied; Driver self and Admin allowed; private bucket and INSERT/SELECT/DELETE policies verified. Engineering: TypeScript PASS, 33/33 contracts PASS, build 27/27. Automated headed private-document preview was blocked by the remote execution safety layer, so real headed upload/review remains a later manual acceptance item.

Next product slice: **Outstation request + quote marketplace**, reusing verified Driver state and route/location origins without touching fixed-route FIFO.
# Launch-closure handover — 2026-08-31

The validated Demo Ready checkpoint is `0e455f00ad52d0dfa95d3cf32f74aee338cfe490` on remote `demo-ready-investor-polish`. It contains Outstation Areas v2, master Raahi branding, deterministic dependencies/CI, `.env` untracking and dependency security upgrades. GitHub `Demo Ready Validate` run `33357751663` passed for that exact checkpoint. Raahi V2 Dev includes migration `20260831082254_demo_ready_outstation_service_areas_v2`.

Validated evidence carried into closure: TypeScript PASS; 36/36 contracts PASS; `git diff --check` PASS; production `npm audit` 0 vulnerabilities; production build PASS with 32/32 pages; isolated production-route smoke PASS. Synthetic Outstation and Areas v2 data was removed. Port 4030 and Raahi School were not touched.

Supabase triage found no launch-breaking platform health issue. Performance notices are tracked as a post-launch tuning batch; no late schema optimization was mixed into the accepted candidate. Security advisor warnings are largely consequences of the deliberate guarded-RPC boundary and must be evaluated function-by-function, never “fixed” by weakening guards or broadly exposing tables. Leaked-password protection needs an owner decision only if password sign-in is enabled.

Immediate continuation sequence:

1. Preserve checkpoint `0e455f00ad52d0dfa95d3cf32f74aee338cfe490` and its green CI evidence.
2. Prepare Netlify and run hosted acceptance only as far as current access allows.
3. Confirm the exact Netlify custom-domain DNS target before any GoDaddy edit.
4. Stop for owner approval before GoDaddy DNS, production OAuth, production DB/Auth Hook/Fast2SMS activation or any irreversible production setting.

Never touch Raahi School or port 4030. Preserve `prod-v14-frozen` → `38b7519d615e171c59d537b18a61c1ba303c132f` and keep the old public hostname available as rollback until new-domain acceptance is complete.

# 2026-09-05 Architecture Freeze handover

Raahi 2.0 has intentionally moved from launch-polish thinking into company/platform design before the next implementation wave.

## New target authority
Read these before planning any new marketplace code:
1. `docs/RAAHI_2_0_ARCHITECTURE_FREEZE_V1.md`
2. `docs/RAAHI_2_0_UML_FREEZE_V1.md`
3. `docs/RAAHI_V2_DECISIONS.md` — decisions dated 2026-09-05
4. the appended 2026-09-05 section of `docs/RAAHI_V2_BIBLE.md`
5. `docs/RAAHI_V2_BUILD_MATRIX.md` — New Marketplace Program section

The existing Master Architecture/current migrations remain legacy-engine truth. Do not rewrite that history to look like the new target is already implemented.

## Frozen new doctrines
- Raahi scales as local Markets connected into a mobility network.
- Every Driver has Home Market + at most one physically grounded Current Operating Market.
- Operating Market controls origin-supply eligibility; Product availability remains explicit; FIFO ignores Home Market.
- Location/Corridor is separate from Service Product.
- Travel Intent captures unmet demand and can surface emerging corridor opportunities.
- Target identity is capability-based, not mutually exclusive Passenger/Driver accounts.
- Migrated Fixed Route uses two-sided Passenger + Driver queues and atomic matching.
- One cross-service commitment ledger prevents Driver/Vehicle conflicts.
- Admin becomes permission + geographic scope; Admin is not routine dispatcher.
- Payment acknowledgement, Ride state and Support Case state remain separate.

## Single next action
**Freeze the Raahi 2.0 Premium Experience North Star** for Passenger, Driver and Market Admin against the new architecture. Do not start Foundation/kernel migrations before that experience target is complete enough to test the domain against it.

Never touch Raahi School or port 4030.

## 2026-09-05 Premium Experience North Star handover

After Architecture/UML Freeze commit `d34e6ef`, the Premium Experience North Star has been formalized in `docs/RAAHI_2_0_EXPERIENCE_NORTH_STAR_V1.md`.

Frozen experience rules include:
- Passenger `From` is freely selectable; current GPS is a convenience, not a browsing lock.
- Driver supply uses verified Current Operating Market.
- Raahi Gomoh / Dhanbad / future local labels are Market contexts in one platform.
- Passenger target navigation: Home · My Rides · Explore · Offers · Profile.
- Driver target navigation: Drive · Opportunities · My Trips · History · Profile.
- Fixed pre-match shows liquidity, not Driver identity; trust reveal happens only after assignment.
- Driver sees aggregate demand and chooses products/services, never individual Fixed passengers.
- Market Admin is exception/opportunity first; State Operations compares Market health.
- Experience quality is a release criterion alongside backend invariants.

No marketplace implementation code or database change belongs to this experience checkpoint.

### Single next action

Define the **Raahi 2.0 Target Domain/Data Contract v1**: entities, identifiers, invariants, ownership, command/RPC boundaries, projections, event schema, Market-scoped authorization and cross-service commitment rules. Reconcile it against the frozen UML and acceptance matrix before writing migrations.

Do not jump directly into new UI screens or migrations from legacy table assumptions. The target domain contract is the next architecture-to-code bridge.
