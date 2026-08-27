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
