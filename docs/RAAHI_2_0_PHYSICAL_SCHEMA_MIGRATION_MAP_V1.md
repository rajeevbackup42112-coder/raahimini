# Raahi 2.0 Physical Schema & Migration Map v1.0

**Date:** 2026-09-05
**Status:** Pre-migration design; no DDL authorized by this document
**Target authority:** Architecture Freeze + UML + Experience North Star + Target Domain Contract

## 1. Evidence baseline

This mapping was prepared from:
- local worktree `raahi-demo-ready` at target-design checkpoint;
- read-only inspection of Supabase project `Raahi V2 Dev`;
- current applied migration list through the 2026-09-05 car-request truth revisions;
- newer `raahi-demand-refinement` worktree migrations not present in the older architecture worktree.

Important discovery: the live Dev schema is ahead of this local architecture worktree. It already contains `route_interest_signals`, `car_request_agreements` and `car_request_change_proposals` plus newer Outstation commands.

Therefore implementation must begin from a reconciled integration worktree that contains the latest accepted migrations. Never recreate or overwrite those live objects from this older branch.

Classification:
- **REUSE** — target can use the object substantially as-is;
- **EXTEND** — retain data/object but add or supersede semantics safely;
- **NEW** — create clean target object;
- **LEGACY-ONLY** — preserve history/current legacy engine; target must not depend on it.
## 2. Identity / authorization mapping

### `profiles` — EXTEND / retain legacy compatibility
Keep `profiles.id`, display name, phone mirror and restriction fields.

`profiles.role` remains temporarily because the current application/RPCs require the exclusive passenger/driver/admin enum. It becomes **legacy routing compatibility**, not target capability authority.

Do not drop or repurpose `role` while any legacy RPC/UI depends on it.

### `user_capabilities` — NEW
Suggested columns:
- user_id FK profiles/auth user;
- capability (`PASSENGER`, `DRIVER`, future explicit capabilities);
- status;
- granted_at/by;
- revoked_at/by;
- metadata/reason where needed;
- unique active user+capability.

Backfill:
- all existing profiles receive PASSENGER capability unless policy says otherwise;
- every existing Driver row receives DRIVER capability;
- Admin permission moves to scoped grants rather than being modeled only as capability.

Target authorization reads capability tables; legacy commands continue reading `profiles.role` until retired.
### `admin_scope_grants` — NEW
Suggested columns:
- user_id;
- permission code;
- scope_type (`MARKET`, `STATE`, `PLATFORM`);
- scope_id where applicable;
- status;
- granted_by/at;
- revoked_by/at;
- unique active permission+scope per user.

Backfill existing Admin accounts with a deliberately chosen initial scope only after owner review; do not silently turn every current Admin into permanent nationwide Platform Admin.

### Auth profile trigger — EXTEND
Current live `handle_new_user()` already safely defaults new profiles to `passenger` rather than trusting user-editable metadata for role.

Target addition: create PASSENGER capability in the same trusted onboarding boundary or via an idempotent companion trigger/function.

Driver self-onboarding in the newer marketplace branch currently writes `profiles.role='driver'`. Target self-onboarding must instead grant DRIVER capability/Driver Profile while preserving Passenger capability. Keep the current function only for legacy compatibility until target onboarding replaces it.

### Exclusive-role guard triggers/RPCs — LEGACY-ONLY
Do not weaken them globally while legacy Fixed/Outstation flows still rely on role exclusivity. New target RPCs use capabilities. Remove old role exclusivity only after every affected legacy path has been retired or capability-safe replacements are live.
## 3. Geography / Market mapping

### `markets` — NEW
Do not reuse Outstation service areas as the universal Market object; they are service-specific and currently encode only an Outstation pickup-area concept.

Suggested columns:
- id UUID;
- code/slug;
- display_name;
- state/country identifiers;
- lifecycle_state;
- timezone;
- is_discoverable/is_operational flags derived or explicit;
- created/updated/published timestamps.

Initial backfill candidates come from current known operating areas such as Gomoh, Dhanbad, Parasnath, Madhuban and Bokaro, but activation state must reflect actual Raahi Market launch state rather than blindly copying `outstation_service_areas.is_active`.

### `locations` — EXTEND
Keep current location IDs/history where useful.

Changes required for national scale:
- remove global `UNIQUE(name)` assumption;
- add stable normalized/slug fields with appropriate geographic scope;
- add location type (town/city/station/airport/boarding hub/etc.);
- add geospatial coordinates/boundary metadata as required;
- keep state/country normalized enough for scale.

A name such as `Madhuban` cannot be assumed globally unique across India.
### `market_locations` — NEW
Bridge Market ↔ Location so a Location can be primary to one Market yet still be relevant to another future operating cluster without schema surgery.

Suggested fields:
- market_id;
- location_id;
- relationship (`PRIMARY`, `SERVICE_NODE`, `DESTINATION_NODE`, etc.);
- active/effective timestamps;
- unique market+location+relationship as appropriate.

### `routes` / `route_stops` / `route_locations` — LEGACY-ONLY for new marketplace creation
These tables have excellent historical/versioned Fixed Route value but combine geography, public activation and fare assumptions from the legacy engine.

Do not force them to become universal Corridor/Product objects.

Preserve them for:
- legacy Fixed engine;
- historical display;
- migration/backfill source;
- existing Share/GPS/support relationships.

### `corridors` — NEW
Create clean directed geography separate from commercial product.

Suggested fields:
- corridor_family_id / version identity;
- origin_location_id;
- destination_location_id;
- status/version/effective timestamps;
- supersedes reference where structurally versioned.

Backfill current active route families into Corridor families without changing legacy route IDs.
### `corridor_stops` — NEW
Needed only where a product/corridor uses ordered operational/boarding nodes. Seed from current `route_stops` for migrated Fixed corridors.

Do not make every geographic waypoint an operational action.

### `service_products` — NEW
This is the key separation missing today.

Suggested fields:
- id/product_family_id/version;
- origin_market_id;
- corridor_id/version;
- service_type;
- lifecycle/status;
- engine_mode (`LEGACY_FIXED`, `TARGET_FIXED`, etc.) for controlled cutover;
- fare/currency authority or fare-policy reference;
- capacity/formation policy;
- acknowledgement/boarding/refill settings;
- Round Trip stay/return settings;
- schedule definition where applicable;
- effective/published/superseded timestamps.

Initial backfill can create target Product records representing current fixed corridors without activating TARGET_FIXED. Existing legacy route fares remain authoritative until Product cutover.

P0 cutover constraint: a Product has one booking/creation engine authority at a time.

## 4. Driver / vehicle mapping

### `drivers` — EXTEND
Keep stable Driver IDs/profile relationship and existing operational history.
Target additions:
- `home_market_id` FK markets;
- target standing field or separate standing object;
- deprecate duplicated display_name/phone as authority where Profile/Auth already own those facts;
- keep `is_active` for legacy compatibility until standing/capability cutover.

Home Market backfill should use known onboarding/current area evidence where reliable; ambiguous Drivers require explicit admin/Driver choice rather than guessed geography.

### `driver_vehicles` — NEW
Current `drivers.vehicle_id` is one current pointer. A scalable model should support Driver↔Vehicle relationship explicitly while keeping an active/default vehicle.

Suggested fields:
- driver_id;
- vehicle_id;
- relationship/status;
- is_default;
- effective timestamps;
- unique active relationship rules.

Backfill every existing non-null `drivers.vehicle_id` relationship. Keep legacy column until old RPCs retire.

### `vehicles` — EXTEND
Reuse stable Vehicle IDs/registration/model/type/history.

Add explicit `bookable_passenger_capacity` so target matcher never depends on ambiguous marketed seating terminology. Backfill from current `capacity` after validating current semantics.

Eligibility remains tied to verification/standing, not merely `is_active=true`.
### `driver_operating_context` — NEW
One current Operating Market per Driver, with verified-location evidence metadata.

Suggested fields:
- driver_id PK/unique active;
- market_id;
- status;
- verified_lat/lng or location evidence reference;
- accuracy_meters;
- verified_at;
- selected_at;
- last_revalidated_at;
- cleared_at/reason.

Changing this context uses one canonical command that also exits incompatible uncommitted target availability.

### `driver_service_preferences` — NEW
Supersedes target use of route-family alert preferences and Outstation-area preferences.

Allow product/service opt-in scoped to Market/Product without joining work.

Current `driver_route_preferences` and `driver_outstation_area_preferences` remain LEGACY-ONLY for their existing experiences. Their values may seed target preferences where meaning is genuinely equivalent.

### `driver_verifications` / `driver_verification_documents` — EXTEND / REUSE
This is strong existing infrastructure. Preserve private Storage and relationship-scoped trust projections.

Add expiry/validity/evidence metadata required by target eligibility rather than replacing the whole subsystem. Keep category-specific factual statuses and recent driver-photo/compliance additions.
## 5. Fixed marketplace mapping

### `driver_queue` — LEGACY-ONLY
Preserve current strict FIFO/history for legacy products. It is route-based and directly tied to ACTIVE_COLLECTING semantics, so it should not become target Driver Availability.

### `driver_availability` — NEW
Target product-specific Driver FIFO.

Suggested fields:
- id;
- driver_id;
- vehicle_id;
- service_product_id;
- operating_market_id snapshot;
- status (`QUEUED`, `RESERVED`, `ASSIGNED`, terminal states);
- joined_at server timestamp;
- reserved/assigned/left timestamps;
- cancellation/reason;
- priority correction metadata where needed.

Indexes/constraints:
- product + live status + joined_at for FIFO;
- no prohibited duplicate live Driver/Product availability;
- no incompatible Driver availability according to commitment/operating rules.

### `seat_requests` / `trip_seats` — LEGACY-ONLY for target Fixed
They assume an already-created collecting Trip and exact physical seats. Preserve legacy/historical behavior; do not extend them into target two-sided Passenger FIFO.

### `fixed_passenger_requests` — NEW
Independent Passenger demand before any Ride exists.
Suggested fields:
- id;
- passenger_id;
- service_product_id;
- seat_count;
- boarding context;
- status (`QUEUED`, `RESERVED`, `ASSIGNED`, terminal states);
- joined_at server timestamp;
- bypass_count/protected_priority_at;
- material_version;
- cancellation/reason timestamps.

Constraints/indexes enforce positive group size, legal product, and uniqueness rules for incompatible duplicate active demand.

### `trips` / `trip_progress` — LEGACY-ONLY
These embody ACTIVE_COLLECTING → IN_PROGRESS → COMPLETED and route-stop progression. Preserve historical truth and current legacy fulfilment.

### `rides` — NEW
Universal target fulfilment object after commitment.

Suggested fields:
- id;
- service_type;
- service_product_id nullable for non-configured service objects;
- source_object_type/source_object_id;
- origin_market_id;
- origin/destination location/text snapshots;
- driver_id;
- vehicle_id;
- commitment_id;
- state;
- agreed fare/price snapshot + currency;
- scheduled/actual timestamps;
- governing policy/version snapshot;
- Round Trip metadata/linkage.
### `ride_bookings` — NEW
Suggested fields:
- id;
- ride_id;
- passenger_id/booking_holder_id;
- seat_count;
- fare snapshot;
- state;
- boarding/drop context;
- outbound/return participation state;
- boarded/no-show/cancel timestamps + reason codes.

### `ride_events` — NEW
Append-only material Ride/Booking lifecycle events with actor, reason, previous/current state, evidence/correlation and server timestamp.

Do not use this table as an unaudited general log dump; event types are governed domain facts.

### `mobility_commitments` — NEW, P0 foundation
The universal Driver/Vehicle schedule lock.

Suggested fields:
- id;
- driver_id;
- vehicle_id;
- origin_market_id;
- service_type;
- source object type/id;
- planned_start_at;
- planned_end_at;
- state (`RESERVED`, `COMMITTED`, `ACTIVE`, terminal states);
- acquired_at;
- released_at/reason;
- metadata needed for audit only.

Database design should enforce incompatible overlap at the strongest practical layer (exclusion/serialized locking + contract tests), not only application queries.
## 6. Demand intelligence mapping

### `demand_intents` — LEGACY-ONLY for target Travel Intent
Current object is useful but tied to a known `route_id`, making it unable to represent Gomoh → Ranchi Airport before a route/product exists.

Preserve its current demand-recovery behavior for legacy Fixed.

### `route_interest_signals` — REUSE as telemetry input, not canonical Travel Intent
The newer demand-radar table is valuable aggregate evidence for known routes. Keep it as supporting analytics.

Do not treat repeated page views as equivalent to committed Passenger demand.

### `travel_intents` — NEW
Suggested fields:
- id;
- passenger_id nullable only if future anonymous intent is deliberately allowed;
- origin_market/location/text normalized references;
- destination location/text normalized references;
- desired time/window;
- passenger count;
- intent type/source;
- status/expiry;
- notification preference;
- created/updated/satisfied/cancelled timestamps;
- matched Product/Corridor reference when later discovered.

This table is the source for emerging-corridor intelligence and no-result follow-up, never automatic booking.

## 7. Outstation mapping

### `outstation_requests` — EXTEND / REUSE
Strong existing Passenger request object. Preserve IDs/history.
Target additions/evolution:
- `origin_market_id` alongside legacy `origin_area_id` during transition;
- lifecycle extension for `REOPENED`, fulfilment linkage and target Ride/Commitment references;
- target commands use capability authorization rather than exclusive Passenger role;
- target rules support One Way and Round Trip as frozen in Domain Contract.

Important conflict: the currently applied marketplace migration enforces **new Outstation requests as Round Trip only**. That is a recent product rule, not compatible with the newly frozen target architecture. Do not destructively remove it today. Replace/supersede it only when the target Outstation command path is ready and acceptance criteria for both travel types are explicit.

### `outstation_service_areas` — LEGACY-ONLY as service-specific origin selector
Use it to seed Market mapping and preserve current Outstation behavior. New target lead eligibility should use Current Operating Market + service preference, not a separate permanent Outstation-area identity.

### `driver_outstation_area_preferences` — LEGACY-ONLY / optional backfill source
Target `driver_service_preferences` replaces this for new engine behavior.

### `outstation_quotes` — EXTEND / REUSE
Keep stable Driver-per-Request quote row and privacy/acceptance infrastructure.

The newer `current_agreement_id` pointer is valuable: it lets the row represent the Driver's current offer while immutable versioned commercial truth lives in agreements.

### `car_request_agreements` — REUSE strongly
This newer schema already provides immutable, versioned terms with supersession, expiry, cancellation and exactly one mutually accepted agreement per Request. It closely matches the target versioned Outstation truth model.
Target extension should add/derive Market/Commitment/Ride linkage without weakening immutable-term protection.

### `car_request_change_proposals` — REUSE strongly
Already models material Passenger change → Driver acceptance → superseding agreement. Keep and align terminology/UI with target Outstation change/re-consent flow.

### `outstation_driver_ignores` — REUSE
Ignoring a lead remains consequence-free and may remain a simple Request+Driver suppression row.

### Outstation fulfilment — NEW linkage
When an agreement becomes mutually accepted under target engine:
1. acquire `mobility_commitments` atomically;
2. create/link target `rides`;
3. preserve the accepted agreement as commercial authority;
4. close other active competitor offers;
5. expose target fulfilment projections.

Selected Driver cancellation releases commitment, records factual failure/reason, and returns the original Request to REOPENED without silently reactivating old agreements.

## 8. Carpool / Raahi Trips mapping

No current canonical Carpool or Explore/Raahi Trip storage exists.

### `carpool_journeys` — NEW
### `carpool_bookings` — NEW
### `trip_offerings` — NEW
### `trip_offering_bookings` — NEW

All reuse Driver/Vehicle/Verification/Commitment/Ride/Payment/Case foundations rather than inventing duplicate trust/payment systems.
## 9. Payment / reliability / support mapping

### `payment_acknowledgements` — NEW
Do not extend legacy `driver_confirm_payment` semantics; that function currently changes Fixed seat lifecycle and means something different.

Suggested fields:
- id;
- ride_id/booking_id;
- authoritative amount/currency snapshot;
- state;
- passenger_marked_paid_at/method;
- driver_confirmed_received_at;
- disputed_at;
- linked_case_id;
- version/audit timestamps.

### `behaviour_events` — LEGACY-ONLY for target reliability
Current event enum and actor_role are coupled to exclusive roles and old Fixed lifecycle.

### `reliability_events` — NEW
Generic factual events with user/driver/passenger actor, service/object reference, Market, reason code, evidence/provenance and consequence linkage.

### `support_cases` — EXTEND / REUSE
Current separation from ride mutation is valuable.

Extend with:
- subject_type/subject_id for generic target objects;
- market_id;
- severity;
- richer state/resolution fields;
- escalation/assigned scope where required;
- reporter capability/context independent of legacy `user_role`.

Keep legacy trip_id/request_id fields for historical cases during coexistence.
### `audit_log` — REUSE / EXTEND
Keep as privileged/admin/configuration audit trail.

Add optional Market/scope/correlation metadata where useful. Do not turn it into the Ride event stream.

### `admin_config` — LEGACY/limited reuse
Current global key/value store is not sufficient for Market/Product/version-scoped policy.

### `rule_configurations` — NEW or Product policy storage
Use typed/scoped policy values with effective/version semantics. Service Product owns product-specific policy; platform defaults may live in a separate scoped config object.

## 10. Offers mapping

### `local_promotions` — EXTEND
Keep current content/schedule/commercial history, but normalize the business relationship as Raahi scales.

Target evolution:
- introduce `businesses` table;
- link Offer to business_id;
- link/scoped eligibility to Market(s)/Location/context/category;
- preserve transparent sponsored state;
- aggregate metrics only.

### `businesses` — NEW
Merchant identity and Market relationships belong outside each individual promotion row.

P0: no FK/path from offers can grant mobility ranking or private Passenger-data access.
## 11. GPS / sharing / notification mapping

### `trip_live_locations` — LEGACY-ONLY for target rides
It is correctly scoped to legacy `trips` and has good privacy semantics.

### `ride_live_locations` — NEW
Same minimal latest-location principle, keyed to target Ride/Driver, supporting approach/arrival/active fulfilment states as allowed by Product policy.

Do not expand into permanent Driver tracking.

### `trip_share_links` — LEGACY-ONLY
Keep existing loved-one links for legacy trips.

### `journey_share_links` — NEW
Target generic Ride/Booking share link, hashed token, one journey, revocable, expiring, read-only. Reuse current security design rather than attempting to point old FK columns at new objects.

### `demand_notification_state` / `raahi_invalidation_events` — REUSE where semantics fit
Current invalidation architecture is useful. Realtime continues to trigger canonical refetch.

### `notifications` — NEW if durable multi-channel state is needed
Store recipient, source event/object, operational/promotional class, channel/delivery/read status and deep-link reference. Do not make notification rows authoritative transaction state.

## 12. Security / schema-boundary design

Target core tables in exposed `public` schema must have RLS enabled and direct client grants minimized/revoked according to the existing guarded-RPC architecture.
Preferred target boundary:
- public exposed tables: RLS + no broad mutation grants;
- public client RPCs: explicit EXECUTE grants only to intended roles, with trusted authorization inside;
- privileged helper functions: prefer an unexposed internal schema where practical;
- every SECURITY DEFINER function explicitly sets safe `search_path`, checks actor/ownership/scope and has PUBLIC execute revoked;
- views exposed to clients must use appropriate security-invoker behavior or equivalent safe access design;
- never authorize from user-editable metadata;
- target Admin scope is read from trusted database state, not stale client claims alone.

Existing public SECURITY DEFINER RPCs remain legacy/reused only after function-by-function review; their existence is not a reason to copy the same exposure pattern blindly.

### `command_receipts` — NEW
Generic idempotency record for commands where duplicate network submission can create duplicate commitments.

Suggested fields:
- actor_id;
- command_name;
- idempotency_key;
- target/result object reference;
- result summary/json where safe;
- created_at;
- unique actor+command+key.

Write receipt in the same transaction as the business mutation.

## 13. Commitment overlap implementation direction

Use database serialization as the final authority. The migration-design phase should evaluate a PostgreSQL range/exclusion constraint (for Driver and Vehicle planned commitment windows) plus canonical row/advisory locking for state changes.
Do not finalize the SQL form until verified against the current PostgreSQL/Supabase version and concurrency tests.

Required behavior:
- two simultaneous services cannot commit same Driver/Vehicle to overlapping work;
- release/cancel changes eligibility deterministically;
- future commitments remain possible when planned windows do not overlap;
- an over-running active Ride cannot be ignored merely because its original planned end passed;
- acquisition and source-service acceptance happen in one transaction where possible.

## 14. Migration waves

### Wave 0 — Reconcile source of truth
Before new DDL:
1. create/use a safe integration worktree from the newest accepted Raahi marketplace branch;
2. ensure repository contains every migration currently applied to `Raahi V2 Dev`, especially 2026-09-03/05 demand and car-request truth migrations;
3. preserve target Architecture/UML/Experience/Domain/Schema documents from this design line;
4. verify migration list vs repository; no missing live schema changes;
5. no production deployment.

### Wave 1 — Additive identity + Market foundations
Create:
- user_capabilities;
- admin_scope_grants;
- markets;
- market_locations;
- corridors/corridor_stops;
- service_products;
- driver_operating_context;
- driver_service_preferences;
- optional driver_vehicles;
- scoped rule configuration/idempotency foundation.

Backfill only facts with trustworthy source evidence. No legacy transport behavior changes.
### Wave 2 — Common commitment / Ride foundation
Create:
- mobility_commitments;
- rides;
- ride_bookings;
- ride_events;
- payment_acknowledgements;
- reliability_events;
- target live-location/share stores as needed.

Still no Fixed Product cutover. Prove authorization, idempotency and overlap rules first.

### Wave 3 — Two-sided Fixed target engine
Create:
- driver_availability;
- fixed_passenger_requests;
- matcher/internal functions;
- Passenger/Driver target projections;
- target Fixed commands.

Service Products remain on LEGACY_FIXED until target contract/concurrency suites pass.

### Wave 4 — First canary Fixed Product
Move exactly one configured Product to TARGET_FIXED when:
- no conflicting legacy live transaction exists for cutover boundary;
- all P0 matcher/commitment/security contracts pass;
- headed multi-account acceptance is ready.

Other Products remain legacy.

### Wave 5 — Target fulfilment / payment / support integration
Add assignment acknowledgement, approach, arrival, boarding timer, no-show/refill, Ride progression, direct-payment acknowledgement and target Case links.

Reuse verification/GPS/support architecture where it fits the target.
### Wave 6 — Fixed Round Trip
Add Round Trip Product/state behavior on the proven target commitment/Ride model. Do not introduce a second scheduling model.

### Wave 7 — Outstation target integration
Extend current Outstation Request/Quote/Agreement truth model with:
- Market/Operating-Market eligibility;
- common commitment acquisition;
- target Ride fulfilment;
- target Payment/Case linkage;
- DRIVER_CANCELLED → REOPENED recovery;
- One Way + Round Trip target rules.

Preserve the current agreement-version work rather than rebuilding it.

### Wave 8 — Carpool and Raahi Trips
Create additive Driver-originated journey models using common foundations.

### Wave 9 — Market intelligence / commerce / expansion
Activate Travel Intent → emerging Corridor → pilot Product workflows, richer Market dashboard metrics and contextual Offers.

### Wave 10 — Legacy retirement
Only after all affected Products are target-engine accepted:
- stop creating legacy driver_queue/trips/seat_requests for migrated Products;
- preserve historical data/projections;
- remove exclusive-role dependency from target UI/RPCs;
- retire obsolete commands/contracts deliberately;
- never drop legacy tables merely to make schema look cleaner.
## 15. Consolidated classification

| Current/Target object | Decision |
|---|---|
| profiles | EXTEND; role becomes legacy compatibility |
| user_capabilities | NEW |
| admin_scope_grants | NEW |
| locations | EXTEND for national/scoped geography |
| markets / market_locations | NEW |
| routes / route_stops / route_locations | LEGACY-ONLY for target creation; backfill source |
| corridors / corridor_stops | NEW |
| service_products | NEW |
| drivers | EXTEND with Home Market/standing relationship |
| vehicles | EXTEND with explicit bookable Passenger capacity |
| driver_vehicles | NEW if multi-vehicle relationship enabled |
| driver_operating_context | NEW |
| driver_route_preferences | LEGACY-ONLY for target behavior |
| driver_outstation_area_preferences | LEGACY-ONLY for target behavior |
| driver_service_preferences | NEW |
| driver_verifications/documents | REUSE + EXTEND |
| demand_intents | LEGACY-ONLY for target Travel Intent |
| route_interest_signals | REUSE as analytics evidence |
| travel_intents | NEW |
| driver_queue | LEGACY-ONLY |
| driver_availability | NEW |
| seat_requests / trip_seats | LEGACY-ONLY for target Fixed |
| fixed_passenger_requests | NEW |
| trips / trip_progress | LEGACY-ONLY |
| mobility_commitments / rides / ride_bookings / ride_events | NEW |
| outstation_requests | REUSE + EXTEND |
| outstation_quotes | REUSE + EXTEND |
| car_request_agreements / change_proposals | REUSE strongly |
| outstation_service_areas | LEGACY-ONLY; Market seed/reference |
| outstation_driver_ignores | REUSE |
| carpool_journeys/bookings | NEW |
| trip_offerings/bookings | NEW |
| payment_acknowledgements | NEW |
| behaviour_events | LEGACY-ONLY for target reliability |
| reliability_events | NEW |
| support_cases | REUSE + EXTEND |
| audit_log | REUSE + EXTEND |
| admin_config | limited legacy reuse |
| rule_configurations | NEW/scoped |
| local_promotions | EXTEND |
| businesses | NEW |
| trip_live_locations | LEGACY-ONLY |
| ride_live_locations | NEW |
| trip_share_links | LEGACY-ONLY |
| journey_share_links | NEW |
| invalidation/realtime state | REUSE where semantic |
| notifications | NEW if durable multi-channel state required |
| command_receipts | NEW |

## 16. Migration safety gates

Before each schema wave:
- repository migration list matches applied Dev migration history;
- zero unaccounted schema drift;
- migration is additive unless a cutover-specific supersession is explicitly accepted;
- existing operational counts/state are captured read-only;
- relevant legacy contracts remain green;
- new target contract tests exist before behavior activation;
- no production mutation without explicit owner approval.
## 17. Foundation contract-test gates before first target migration activation

Identity/authorization:
- existing accounts backfill expected capabilities;
- Driver capability does not remove Passenger capability;
- Market Admin cannot read/change outside granted scope;
- legacy role-protected RPC behavior remains unchanged until retired.

Geography/Product:
- duplicate place names can coexist safely across geography;
- Product origin Market/corridor references are valid;
- one current published Product version per family;
- engine authority is unambiguous.

Operating Market:
- one current context per Driver;
- location validation required;
- changing Market clears incompatible uncommitted target availability;
- active commitment blocks inappropriate switch/abandonment.

Commitments:
- concurrent overlap acquisition allows at most one incompatible success;
- Driver and Vehicle both protected;
- release/cancel behaves deterministically;
- idempotent retry returns same commitment.

Security:
- direct table mutations denied where intended;
- RPC authorization checked with trusted DB state;
- raw verification/contact data remains relationship/scope protected;
- SECURITY DEFINER helpers have explicit revoke/grants and safe search path.

## 18. Freeze rule

This map authorizes **planning**, not database change. No target DDL has been applied by this architecture work.

The next implementation action is Wave 0: reconcile the newest marketplace source/migrations with these frozen design documents in a safe integration worktree, then build Wave 1 migrations and tests there.
