# Raahi Next - Staging to Production Runbook V1

## Purpose
Promote an approved Raahi Next staging release into a fresh Production environment without copying synthetic staging data or changing marketplace meaning.

## Source of truth
- One GitHub repository: `rajeevbackup42112-coder/raahimini`.
- Staging integration branch: `raahi-next-clean`.
- Production must deploy the exact approved commit/tag; do not maintain a second production repository.
- Current Supabase `dfgxtooftvtecfcogeiv` is STAGING only.
- Production Supabase must be newly created.

## Promotion prerequisites
Before production promotion, record:
- approved Git commit SHA and immutable release tag;
- exact Supabase migration list/hashes;
- successful TypeScript, ESLint, complete test suite and production build;
- successful role/scope and responsive acceptance;
- current Supabase security/performance advisor output;
- production hostname and Google OAuth callback configuration;
- production environment-variable inventory;
- rollback owner and Product enablement order.

## Never copy staging data
Do not clone or restore STAGING into Production.
Do not migrate synthetic identities, Drivers, Vehicles, queues, requests, Rides, bookings, commitments, Cases, payments, Travel Intents, Local Offers, metrics or operational observations.
## Production Supabase creation
1. Create a new Supabase project in the agreed organization/region.
2. Record project ref, API URL and production publishable/secret credentials in the approved secret store.
3. Replay the repository migration history in chronological order. Never edit or skip an already-approved migration to make Production differ from Staging.
4. Run Supabase security and performance advisors after migration replay.
5. Verify RLS/direct-client-deny contracts and command/projection availability before application traffic.

## Production configuration seed
Seed only deliberate canonical configuration:
- Markets and Market lifecycle;
- Locations and geo zones;
- Corridors;
- Service Products and immutable rule versions;
- Admin scope assignments / initial Platform Admin;
- approved commerce/Market policy configuration where applicable.

Do not infer configuration from staging transaction data.

## Product release switches
- Create/verify a switch for every Production Product.
- Start **all Production Product switches OFF** regardless of Staging state.
- Product lifecycle and feature switch remain independent.
- Platform Admin owns switch changes and must provide a reason.
- A disabled switch blocks new entry only; existing fulfilment must remain operable.

## Authentication and Test Mode
- Configure production Google OAuth redirect/callback URLs for the production hostname.
- `RAAHI_TEST_MODE_ENABLED=false` in Production.
- Never place `SUPABASE_SECRET_KEY` in a `NEXT_PUBLIC_` variable.
- Verify the public production hostname remains hard-blocked by Test Mode before launch.
## Application deployment
1. Deploy the exact approved commit/tag from the single GitHub repository.
2. Set Production Supabase URL/publishable/server-secret values only in the Production environment.
3. Set the production application URL/hostname.
4. Run a production build/smoke before enabling any Product switch.
5. Verify Admin Release Control and Operational Health before Passenger/Driver traffic.

## Initial production acceptance
With all Product switches OFF:
- authenticate Platform Admin through production OAuth;
- verify Market/Admin scope isolation;
- verify Release Control shows lifecycle, switch and effective availability distinctly;
- verify Operational Health loads with zero unexplained transaction history;
- verify rejected-GPS telemetry remains service-role-only and a normal Driver cannot call the recorder directly;
- verify Test Mode endpoint is unavailable on the public host;
- verify no synthetic staging identity/data exists.

## Canary enablement order
Use Add -> test -> canary -> observe -> expand. A suggested order is:
1. Gomoh Fixed One Way;
2. Gomoh Fixed Round Trip;
3. Gomoh Outstation;
4. Carpool;
5. Raahi Trips;
6. Travel Intent / Market Intelligence as required;
7. Local Offers after commerce acceptance.

Enable one Product/Market at a time, observe Operational Health, then expand deliberately.
## Notification integration
External notification delivery is not yet configured in Raahi Next. Operational Health must continue to report `notification_delivery = GAP` until a provider is integrated and delivery outcomes are persisted.

Before production relies on notifications:
- configure the provider in a non-production/staging context first;
- use controlled test numbers/accounts;
- persist send attempts, provider acknowledgement/failure and correlation IDs;
- expose delivery failures through Operational Health;
- run acceptance for expected delivery, provider failure and retry/idempotency behavior.

## Rollback / incident response
If a newly enabled Product shows a material defect:
1. Platform Admin disables that Product/Market switch with a reason.
2. Confirm new Passenger/Driver entry is blocked.
3. Do **not** cancel or rewrite existing Ride/Booking/Commitment truth solely because the switch is off.
4. Use existing fulfilment/support paths for live work.
5. Inspect Operational Health, Audit Events, command correlation IDs and Cases.
6. Roll application code back to the previous approved Git tag only if needed; do not reverse database history casually.
7. Any database correction must be a new forward migration unless a formal disaster-recovery event requires infrastructure restore.

## Production expansion rule
Expand only when the canary Market/Product has no unexplained command failures, stuck commands, Ride/commitment exceptions, unresolved critical support/payment issues or unreviewed GPS anomaly pattern.

## Production release record
For every release, archive the Git SHA/tag, migration hashes, production advisor results, enabled Product switches, OAuth/notification acceptance, health snapshot, rollback decision owner and any known accepted limitations.