# Raahi Next - Staging Release Candidate Acceptance - 2026-09-07

## Environment
- Repository: `rajeevbackup42112-coder/raahimini`
- Branch target: `raahi-next-clean`
- Baseline checkpoint before RC hardening: `1873520b62583ba960b957a5012999a61c42adf5`
- Application runtime used for local acceptance: `http://localhost:4029`
- Supabase project `dfgxtooftvtecfcogeiv` is designated **STAGING** from this checkpoint onward.
- Port 4030 and SchoolTransportOS were not touched.

## Release-control contract
- Product lifecycle and Market canary enablement are separate facts.
- Only Platform/Global Admin can change a Product feature switch.
- Market Admin can inspect only its scoped release state and cannot launch/disable Products.
- Every switch change requires a human reason, is idempotent and emits an Audit Event.
- Disabling a Product stops new discovery/root participation only; it does not cancel or rewrite live queues, requests, bookings, Rides or Mobility Commitments.
- Stable switch keys are derived from Product codes, not environment-generated UUIDs.

## RC migrations
1. `20260907070519_rc_product_market_feature_switches.sql` - 15,649 bytes - MD5 `1b187c6ff96f348712ad17c417d9aec8`
2. `20260907074938_rc_operational_health_projection.sql` - 8,313 bytes - MD5 `15027fa91e564c3cbb8ab1547885a52c`
3. `20260907084856_rc_rejected_gps_observability.sql` - 6,940 bytes - MD5 `3287c7dcd0db0974bd84f1e4fbf0ec16`
4. `20260907102213_rc_rejected_gps_server_boundary.sql` - 3,454 bytes - MD5 `a1de4b0f48d0e4d51044dde3f5c8eb12`

All migrations were applied forward-only to STAGING and mirrored locally from the live migration history.
## Live Product-switch acceptance
- Gomoh Market Admin could read Gomoh release state with `can_manage=false`.
- Gomoh Market Admin mutation attempt was rejected with `PLATFORM_ADMIN_REQUIRED`.
- Platform Admin temporarily disabled only Gomoh Fixed One Way.
- During the canary disable, Gomoh-to-Dhanbad discovery still returned Fixed Round Trip but not Fixed One Way.
- A new Fixed One Way Passenger join was rejected with `FIXED_PRODUCT_NOT_AVAILABLE`.
- Ride / Ride Booking / Mobility Commitment counts remained exactly `12 / 17 / 12` throughout the switch test.
- Platform Admin restored Fixed One Way through the same audited switch command.
- No live fulfilment path was modified by the switch.

## Operational Health acceptance
- `/admin/health` is read-only and scoped through existing Admin authority.
- Platform Admin received both Markets plus global command-health facts.
- Gomoh Market Admin received Gomoh only and `global:null`.
- Health reports command ledger, FIFO demand/skips, Ride exceptions, overdue commitments, Cases, payment disputes/aging and accepted GPS evidence.
- Existing staging data surfaced one overdue synthetic Outstation Ride/Commitment, five unresolved acceptance Cases and four old DUE payment acknowledgements.
- Provenance inspection confirmed these warnings are synthetic acceptance history. Canonical historical facts were not rewritten to make the dashboard artificially green.
- Notification-delivery telemetry remains explicitly `GAP` because no external delivery provider is configured yet.

## Rejected GPS observability
- Recognized location-verification rejections are recorded after the underlying Ride command fails safely.
- Stored observation contains Market, Ride, Driver, service, action, rejection code, accuracy, captured timestamp and correlation ID.
- No latitude or longitude is persisted in `operational_observations`.
- Direct client table access is denied and authenticated Drivers cannot execute the recorder RPC directly.
- A service-role-only recorder validates the supplied actor profile against the Ride’s actual Driver before writing telemetry.
- Real HTTP proof created disposable Fixed Ride `4384a5e9-2575-4a96-85c5-e74365948882`, then rejected invalid arrival GPS with `ARRIVAL_LOCATION_NOT_VERIFIED` and correlation `1242f764-5332-4c32-9d72-08d4eec58ab3`.
- That correlation produced exactly one `GPS_REJECTED` observation through the server boundary; a direct authenticated Driver RPC attempt was denied with `permission denied`.
- The disposable Ride, Commitment, Fixed requests, Driver availability and observation were deleted with narrow synthetic acceptance cleanup; all fixture counts returned to zero.
## Responsive headed Chrome acceptance
Visible Chrome was exercised through the isolated browser lab outside the Raahi dependency tree.

Viewports:
- Desktop: `1440 x 900`
- Mobile: `390 x 844`

Roles/surfaces included Passenger, Driver, Gomoh Market Admin and Platform Admin across Home, Ways to Go, Carpool, Explore, Offers, Travel Interests, Driver, Outstation, Carpool, Trips, Market Intelligence, Release Control and Operational Health.

Measured result:
- No horizontal overflow on accepted surfaces.
- No page errors.
- No Next runtime/hydration dialog.
- No non-favicon failed response on accepted surfaces.
- Corrected targeted rerun proved `/go` renders `WAYS TO GO`, `/explore` renders `Where could I go?`, and Fixed Driver participation is on `/drive` at HTTP 200 on mobile/desktop.
- The earlier `/drive/fixed` 404 was an invalid harness route, not an application route.
- A first-load `/favicon.ico` console 404 remains cosmetic and non-functional.

## Security and Test Mode
- Test Mode defaults disabled.
- Test Mode requires an explicit allowed-host list.
- `ride.myraahi.co.in` and `www.ride.myraahi.co.in` are hard-blocked even if a future environment allowlist is misconfigured.
- `SUPABASE_SECRET_KEY` remains server-only and is not exposed through `NEXT_PUBLIC_` variables.

## Final engineering gate
- Staging-readiness contracts: **24/24 PASS**.
- Complete suite: **242/242 PASS across 19 files**.
- TypeScript: PASS.
- ESLint: PASS.
- Next.js production build: PASS.
- Production build route manifest includes `/admin/release-control`, `/admin/health`, all mobility surfaces and all current product APIs.
## Advisors
- Security advisor: only the existing Supabase Auth leaked-password-protection warning remains.
- Performance advisor: INFO-level unused-index notices only; no missing-RLS or unindexed-FK blocker was reported.
- Fresh `operational_observations` indexes are retained despite unused-index INFO because STAGING has not accumulated representative operational query statistics.

## Staging designation and production boundary
The current Supabase project is intentionally accepted as STAGING. Existing synthetic acceptance history may remain in STAGING and should be interpreted accordingly by Operational Health.

Production must **not** be made by cloning this database. Production will receive:
1. a new Supabase project;
2. the exact approved migration history;
3. a minimal explicit configuration seed for Markets, Locations, Products, rule versions, release switches and Platform Admin;
4. no synthetic Passenger, Driver, Ride, Case, payment, Travel Intent, Offer or operational-observation data.

All production Product switches should start OFF and be enabled deliberately by Market/Product canary after health checks.

## Readiness decision
**RAAHI 2.0 / Raahi Next is STAGING RELEASE CANDIDATE READY at the code + current STAGING database level**, subject to the checkpoint commit/push verification recorded outside this acceptance file.

Open items are production/hosted integration gates, not missing product slices:
- hosted environment/domain acceptance when the chosen staging/production host is configured;
- production Google OAuth callbacks/configuration;
- external notification delivery integration and telemetry before relying on notification delivery in production;
- creation of the fresh Production Supabase project and controlled Product enablement.
## Post-RC project hold
- Do not deploy this checkpoint to Netlify, Vercel or another hosted environment yet.
- Next project activity is UI review, agreed UI refinement, and a structured manual staging test matrix.
- Hosted deployment resumes only after explicit project approval following that review/testing.
