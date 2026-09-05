# Raahi Next — Build Status

**Checkpoint date:** 2026-09-05
**Stage:** Gate 0 complete; Slice 1 implemented; Dev Test Mode server key pending

## Gate 0 — GREEN

Raahi Next now has a dedicated clean application, Git branch and Supabase database.

### Preserved legacy/reference state
- Existing Raahi code remains untouched for reference.
- GitHub reference branch: `raahi-v2-reference-2026-09-05` at `f592e29`.
- Existing `Raahi V2 Dev` Supabase project was paused, not deleted, to free the Free-plan project slot.
- `SchoolTransportOS Dev` was not touched.

### Raahi Next resources
- Workspace: `C:\Users\Dipti\AppData\Local\Temp\raahi-next`.
- Runtime port: `4029`.
- GitHub repository: `rajeevbackup42112-coder/raahimini`.
- GitHub branch: `raahi-next-clean`.
- Supabase project: `Raahi Next Dev` (`dfgxtooftvtecfcogeiv`, `ap-southeast-2`).
- Supabase project cost at creation: `$0/month` under the current Free plan.

### Foundation migrations replayed successfully
1. `20260905103622_foundation_identity_markets_products`
2. `20260905103649_foundation_driver_supply_context`
3. `20260905103716_foundation_admin_commitments`
4. `20260905103738_foundation_command_integrity`
5. `20260905104010_foundation_advisor_hardening`

### Real database acceptance evidence
- Clean migrations applied to a fresh project and deterministic Gomoh/Dhanbad seed loaded.
- Anonymous catalog RLS exposes Gomoh + `GOMOH_DHANBAD_FIXED_OW` only; Dhanbad PREPARING/draft Product remains hidden.
- Authenticated self-RLS proved one user can read only their own Profile/Capabilities; new user receives Passenger capability.
- Same-Driver overlapping commitment: blocked by Postgres exclusion constraint.
- Same-Vehicle overlapping commitment: blocked by Postgres exclusion constraint.
- Duplicate idempotency identity: blocked.
- Historical Product-rule mutation: blocked.
- Selecting a Vehicle without Driver access: blocked.
- Revoking access to the currently selected Vehicle: blocked.
- Supabase security advisor: **0 findings**.
- Performance advisor: no unindexed-FK findings; only expected unused-index INFO on the new empty database.

### Application gate
- Next.js 16.3.3 / React 19.2.x / strict TypeScript.
- Supabase SSR browser/server clients added with Next.js 16 `proxy.ts` session refresh.
- App is connected locally to `Raahi Next Dev` via publishable client credentials only.
- No service-role/server secret is committed. Local Dev Test Mode still needs `SUPABASE_SECRET_KEY` in ignored `.env.local`.
- TypeScript: PASS.
- ESLint: PASS.
- Vitest: 35/35 PASS.
- Production build: PASS.

### Non-blocking housekeeping
- Local Supabase CLI has no authenticated access token, so generated database types have not yet been written to the repository. The connected Supabase service can generate them; this will be completed once CLI/project auth is configured, and does not alter product behavior.
- Google OAuth is configured on `Raahi Next Dev` and live initiation reaches the Google sign-in screen. It remains available as a fallback while Dev Test Mode is used for rapid persona testing.

## Next executable stage
**Slice 1 — Driver chooses and verifies Current Operating Market.**

The command must prove: physical presence, Driver capability/standing, one Operating Market, commitment conflict protection, event history, idempotency, and no automatic Product enrolment.

## Slice 1 — Driver Operating Market

### Implemented
- Added configurable `market_presence_zones`; Market verification is data-driven rather than city-branch code.
- Operating Market stores verified Market, verification zone, timestamp, method and GPS accuracy; exact Driver coordinates are not retained in Operating Market state.
- Added canonical `driver_set_operating_market` command with Driver capability/standing checks, physical presence verification, commitment conflict guard and idempotency.
- Idempotency is claimed before time-sensitive GPS validation so a successful retry returns the original result even after its GPS evidence ages out.
- Added `get_my_drive_context` projection with Home Market, current Operating Market and eligible Market choices.
- Privileged RPC implementations live in `private`; exposed public functions are `SECURITY INVOKER` wrappers.
- Added `/drive`, `/api/driver/operating-market`, Google sign-in entry and OAuth callback plumbing.
- Browser never writes Operating Market tables directly.

### Real database proof
- Valid Gomoh-home Driver → Dhanbad Operating Market: PASS.
- Passenger capability preserved while Driver context changes: PASS.
- Remote Gomoh coordinates attempting Dhanbad: rejected with `LOCATION_NOT_VERIFIED`.
- Same idempotency key + changed input: rejected with `IDEMPOTENCY_CONFLICT`.
- Completed command retried after GPS evidence becomes stale: returns original successful result.
- Active conflicting Gomoh commitment → Dhanbad switch: rejected with `ACTIVE_COMMITMENT_CONFLICT`.
- Public wrappers remain executable by authenticated Driver; anonymous command execution denied.
- Supabase security advisor after RPC hardening: **0 findings**.

### Application/browser proof
- Slice 1 + Dev Test Mode contracts: current Vitest total **35/35 PASS**.
- TypeScript: PASS.
- ESLint: PASS.
- Production Next.js build: PASS.
- Browser `/drive` unauthenticated guard: PASS.
- Browser sign-in page: PASS.
- Starter `Create Next App` metadata removed; page title is `Raahi`.
- Google OAuth initiation now reaches the Google sign-in screen: PASS.
- Localhost Test Mode form renders Passenger, Driver, Passenger+Driver, Market Admin and Platform Admin personas: PASS.
- Market-specific fields switch correctly between Home Market and Admin Market: PASS.
- Browser/anon provisioning privilege: DENIED; `service_role` only: PASS.
- Supabase security advisor after Test Mode migrations: **0 findings**.

### Acceptance status
Slice 1 implementation is checkpoint-ready. Rapid persona acceptance will use Dev Test Mode once the server-only Supabase secret key is added to ignored `.env.local`; Google remains available as a real-auth fallback.

Once the local server-only Test Mode key is configured, run final headed Slice 1 persona acceptance:
1. create a Passenger+Driver test identity with Home Market Gomoh;
2. verify current Operating Market;
3. reject a physically wrong Market;
4. confirm Home Market remains unchanged;
5. confirm Passenger capability remains present;
6. confirm choosing a Market does not auto-enrol a Product;
7. create Gomoh and Dhanbad Market Admin personas and verify their scope separation.

Then proceed to Slice 2: Passenger search + join Fixed demand for Gomoh → Dhanbad.

## Slice 2 — Passenger Fixed demand — COMPLETE

### Database / command proof
- Added `fixed_passenger_requests` independent of Ride/Driver creation.
- Fare, Product rule version and seat limit are snapshotted server-side at queue entry.
- FIFO `queued_at` is server-owned; Passenger cannot supply queue priority.
- Active duplicate demand is blocked per Passenger + Product.
- Same idempotency key returns the original result; changed input with the same key fails.
- Invalid seat count and anonymous command execution are rejected.
- Owner cancellation is idempotent and serialized; non-owner cancellation returns not found.
- Browser has no direct table privilege; explicit deny-all RLS policy is present.

### Passenger/browser proof
- Home supports free origin/destination selection without GPS gating.
- Gomoh → Dhanbad discovery exposes the PILOT Fixed One Way Product at ₹150/seat, max 4 seats.
- Dhanbad → Gomoh remains hidden because its Product is still DRAFT.
- Rajeev2 browser flow: 2 seats → ₹300 → `RIDE FORMING` → cancel → `REQUEST CANCELLED`: PASS.
- Pre-match state reveals no Driver identity.
- Dev Test Mode now returns users to their requested page after sign-in: PASS.
### Gate
- Slice 2 contract suite: 8 PASS.
- Total Vitest contracts: **43/43 PASS**.
- TypeScript: PASS.
- ESLint: PASS.
- Production build: PASS.
- Supabase RLS-without-policy finding resolved.
- Remaining Supabase Auth warning: leaked-password protection disabled. This is a pre-production Auth setting; Dev Test Mode uses server-generated random credentials and production login is Google.

### Next
**Slice 3 — Driver sees aggregate demand and explicitly joins Gomoh → Dhanbad Fixed FIFO.**

Driver queue entry must require verified Driver standing, eligible Vehicle, verified Current Operating Market = Product Origin Market, explicit Product preference/availability, no conflicting commitment, and server-owned FIFO time. Passenger identities remain hidden.

## Slice 3 — Driver Fixed availability / FIFO — COMPLETE

### Database / command proof
- Added `driver_availability` as Product-scoped live supply, separate from persistent Driver Product preference.
- FIFO `queued_at` is server-owned; duplicate active Driver/Product and Vehicle/Product positions are blocked.
- Canonical commands: `set_driver_product_preference`, `join_fixed_driver_queue`, `leave_fixed_driver_queue`.
- FIFO entry requires active Driver standing, verified Current Operating Market = Product Market, explicit Product preference, active eligible Vehicle, required Driver/Vehicle verification, and no overlapping active/reserved mobility commitment.
- Operating Market changes withdraw incompatible QUEUED availability without touching reserved/assigned work.
- Disabling a Product preference withdraws that Product's uncommitted QUEUED availability.
- Database trigger rechecks Product + Market lifecycle on availability insert/update, so paused Markets cannot accept new Fixed supply.

### Driver/browser proof
- Dev Test Mode provisions synthetic Drivers with a service-role-only eligible Vehicle and verified PHONE, DRIVING_LICENCE, DRIVER_PHOTO, VEHICLE_RC and VEHICLE_PHOTOS fixtures.
- Driver workspace exposes only aggregate queued request/seat counts; Passenger identity remains hidden pre-match.
- Headed flow: `Serve this route` → `Make me available` → `Leave FIFO`: PASS.
- Wrong Vehicle, expired Driver verification, wrong Operating Market and cross-service commitment conflicts were rejected.
- Real Postgres paused-Market test rejected FIFO insertion with `FIXED_PRODUCT_NOT_AVAILABLE`: PASS.

### Gate
- Slice 3 contracts: 11 PASS.
- Total Vitest contracts: **54/54 PASS**.
- TypeScript: PASS.
- ESLint: PASS.
- Production build: PASS.
- Supabase security advisor: only existing leaked-password-protection Auth warning.
- Supabase performance advisor: no unindexed foreign-key findings; remaining notices are unused-index INFO on the fresh database.

### Next
**Slice 4 — Fixed matching + trust reveal.**

## Slice 4 — Fixed matching + trust reveal — COMPLETE

### Database / matching proof
- Added authoritative `rides`, `ride_bookings`, and immutable `ride_events`; browser roles have no direct table mutation path.
- Canonical system matcher is `match_fixed_product`, callable only by `service_role`; automatic queue triggers delegate to the same matcher.
- Product-level advisory lock, row locks, Driver/Vehicle commitment exclusion, and command idempotency prevent duplicate assignment.
- Matcher rechecks Driver standing, Operating Market, Product preference, active eligible Vehicle, verification, Market/Product lifecycle and commitment conflicts at match time.
- V1 `FULL_CAPACITY` policy is enforced from versioned Product rules; groups remain atomic.
- Exact 3-seat + 2-seat + 1-seat / 4-seat Vehicle test selected 3+1, left 2 queued, and incremented skip protection for the bypassed request.
- 3/4-seat demand correctly produced no Ride.
- Repeated matcher invocation produced one Ride and one Commitment only.

### Trust / browser proof
- Passenger projection remains private before assignment and reveals Driver name, Vehicle model/registration and verification statuses only after assignment.
- Raw DL/RC documents are never exposed to Passenger projections.
- Driver assignment projection shows matched Passenger groups only after assignment and has no commercial accept/reject step.
- Two isolated headed browser sessions proved automatic Passenger+Driver matching and post-match trust reveal.
- Passenger cancellation after assignment returns `409 FIXED_REQUEST_NOT_CANCELLABLE`.
- Driver Operating Market and new FIFO controls are locked in the UI while an active assignment exists, matching server-side commitment rules.
### Gate
- Slice 4 contracts: 12 PASS.
- Total Vitest contracts: **66/66 PASS**.
- TypeScript: PASS.
- ESLint: PASS.
- Production build: PASS.
- Supabase performance advisor: no unindexed foreign-key findings; remaining notices are expected unused-index INFO on the fresh database.
- Supabase security advisor: only existing Dev Auth leaked-password-protection warning.
- Synthetic Slice 4 browser Ride/Commitment/request/assigned availability cleaned after acceptance; reusable test identities remain.

### Next
**Slice 5 — Driver acknowledgement, approach, verified arrival, boarding, no-show/refill, and ready-to-depart.**

## Slice 5 — Approach, arrival and boarding — COMPLETE

- Canonical Driver transitions: acknowledge → approach → GPS arrival → boarding.
- Arrival requires fresh, accurate GPS inside Product-configured boarding zone; exact coordinates are not retained on the Ride.
- Boarding wait starts only after verified arrival.
- Passenger boarding/no-show are immutable Ride events.
- No-show is server-gated by boarding deadline; client time cannot override it.
- Bounded refill reuses the same Ride before ordinary matching.
- Full no-show recovery supports temporary 0 booked seats without violating capacity integrity.
- Driver workspace exposes actionable booking IDs/status only after assignment.
- Real Dev ride reached READY_TO_DEPART with 4/4 boarded seats.
- Rollback-only no-show test: 4-seat group → 0 seats → refill window → compatible Passenger assigned into same Ride; no extra Ride created.
- Slice 5 contracts: 8 PASS; total contracts: 74/74 PASS.
- TypeScript, ESLint and production build: PASS.
- Supabase: no actionable performance findings; only expected unused-index INFO. Known Dev Auth leaked-password warning remains pre-production configuration.

### Next
**Slice 6 — Ride execution and completion:** depart → in progress → destination completion → Commitment release → history projection.

## Slice 6 — Fixed execution + completion — PASS

- READY_TO_DEPART → IN_PROGRESS → COMPLETED is server-authoritative and idempotent.
- Destination completion requires fresh Dhanbad-area GPS evidence; exact coordinates are not retained.
- Ride completion atomically completes boarded Bookings and the shared Mobility Commitment.
- Driver Market/FIFO controls unlock only after commitment completion.
- Driver `/drive/history` shows completed factual journeys through an authenticated projection.
- Passenger request UI now reflects linked Ride completion without rewriting request ownership.
- Real browser/API acceptance: Gomoh completion rejected; Dhanbad completion accepted; Driver and Passenger completed states verified.
- Repository gate: 83/83 tests, TypeScript, ESLint and production build PASS.

## Slice 7 — complete
- Direct-payment acknowledgement is separate from Ride completion.
- Completed Fixed bookings create a DUE payment acknowledgement.
- Passenger can mark paid; Driver alone can confirm receipt afterward.
- Payment disputes create an OPEN PAYMENT_PROBLEM Case while Ride remains COMPLETED.
- Generic support Cases do not mutate Ride or Payment state.
- Passenger/Driver payment projections are ownership-scoped; client table mutation remains blocked.
- Real browser acceptance passed for Passenger mark-paid, Driver confirm-received, and support Case creation.
- Supabase advisor hardening completed for payment dispute Case FK.
- Full gate: 93/93 tests PASS + TypeScript + ESLint + production build PASS.

## Slice 8 — Fixed Round Trip — COMPLETE

- Added Gomoh → Dhanbad Fixed Round Trip as a Service Product on the existing Fixed corridor/kernel; no second marketplace engine.
- Passenger demand, Driver preference/FIFO, exact-fill batching, trust reveal, Ride, Booking and shared Commitment all reuse the proven Fixed authority.
- Same Driver + Vehicle Commitment remains active through outbound, destination wait, return boarding and return fulfilment.
- Round Trip lifecycle: READY_TO_DEPART → OUTBOUND_IN_PROGRESS → WAITING_FOR_RETURN → RETURN_BOARDING → RETURN_IN_PROGRESS → COMPLETED.
- Outbound completion requires Dhanbad proof; return completion requires Gomoh proof. Exact coordinates are not retained.
- Return attendance is tracked separately on the same Booking; unresolved return manifest blocks departure.
- Payment becomes DUE only after final return completion, not after outbound arrival.
- Real two-session browser/API acceptance completed a 4-seat ₹1,200 Round Trip end-to-end. Early return start and wrong-location return completion were both rejected with 409.
- Final database truth: Ride/Booking/Commitment COMPLETED, return BOARDED, Payment DUE ₹1,200.
- Passenger and Driver History visibly distinguish Gomoh → Dhanbad → Gomoh from One Way.
- Slice 8 contracts: 15 PASS; total contracts: **108/108 PASS**.
- TypeScript, ESLint and production build: PASS.
- Supabase: no actionable Slice 8 advisor findings; performance notices are unused-index INFO. Existing Dev Auth leaked-password warning remains pre-production configuration.

### Next
**Slice 9 — Outstation:** Passenger request → eligible Driver audience → private versioned quotes → exact atomic selection → shared Commitment → common fulfilment/payment/support.
