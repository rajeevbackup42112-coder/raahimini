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
- Sequential dispatch: next driver cannot become active while the current route trip is `IN_PROGRESS`.
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
- V2 Dev schema contains the wait-tolerance projection; branch CI must remain green before this slice is accepted.

## Still requires browser/device acceptance

- Persistent demand recovery visual E2E: `I need a ride` -> leave route -> supply appears -> Home recovery card -> explicit booking.
- Wait-tolerance UI visual acceptance and restored selection after navigation/reload.
- Final responsive sweep on representative passenger, driver and Admin screens after the latest changes.

These gates are pending because the authorized Windows validation machine is temporarily unavailable. They must not be silently converted to PASS from code review alone.

## Staging gate

Before RC1 can be called release-ready:

1. Use a staging URL whose environment is guaranteed non-production.
2. Confirm staging uses only the isolated V2 Supabase environment and never V1/legacy production credentials.
3. Run the authenticated staging Playwright suite.
4. Run passenger, driver and Admin smoke paths on mobile-size and desktop-size viewports.
5. Capture failure evidence and resolve every invariant-affecting defect.

The current staging workflow is test-only; it does not itself deploy the application. The staging target must still be revalidated before use.

## Database / security gate

- Migration history must replay cleanly from an empty V2 database in canonical order.
- RLS and RPC privilege checks must be rerun for every V2 table/function added after Beta1.
- No client may directly mutate core operational tables.
- No public RPC may bypass verified-phone, role, seat-capacity, queue or trip-lifecycle rules.
- GPS/support/share projections must remain scoped and privacy-safe.
- No production or historical Supabase project may be touched during RC validation.

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

## Final GO checklist

- [ ] Latest CI head green.
- [ ] Demand recovery headed browser acceptance green.
- [ ] Wait-tolerance headed browser acceptance green.
- [ ] Full authenticated passenger lifecycle green.
- [ ] Full authenticated driver lifecycle green.
- [ ] Admin route health / exception / support lifecycle green.
- [ ] GPS start, fallback and cleanup green.
- [ ] Share create / anonymous view / revoke / arrival expiry green.
- [ ] Two-driver sequential dispatch regression green.
- [ ] Cancellation/no-show/seat-release regression green.
- [ ] Migration replay on isolated release-candidate database green.
- [ ] RLS/RPC privilege audit green.
- [ ] Guaranteed non-production staging E2E green.
- [ ] Rollback procedure verified.
- [ ] Explicit production approval received.
