# Raahi 2.0 Target Domain / Data Contract v1.0

**Status:** Architecture-to-code contract
**Date:** 2026-09-05
**Authority:** Must conform to Architecture Freeze, UML Freeze, Experience North Star and Acceptance Matrix

## 1. Purpose

This document defines the stable business objects and server-authoritative boundaries for the next Raahi marketplace kernel.

It is intentionally independent of legacy table names. Database migrations may reuse current tables only when doing so preserves these contracts cleanly.

Canonical execution rule:

**Human expresses intent → Raahi validates rules → System changes authoritative state atomically → UI reads projections → Admin handles exceptions.**

Core technical doctrine:
- PostgreSQL remains authoritative state;
- client never directly owns marketplace truth;
- one canonical command per business transition;
- commands are idempotent where retries are expected;
- state transitions are legal and auditable;
- immutable facts/history are preserved;
- Realtime invalidates/refetches projections rather than becoming a second state authority.
## 2. Identifier doctrine

Every durable domain object receives a stable opaque ID generated server-side or by an approved UUID mechanism.

Never use display names, route codes, phone numbers, email addresses, registration numbers or array positions as durable foreign keys.

Human-readable codes may exist for operations but are mutable labels, not identity.

Material event records reference the durable IDs of the objects involved.

## 3. Identity domain

### User
Represents one authenticated human/account identity.

Owns:
- display profile;
- authentication linkage;
- contact/phone authority references;
- capabilities;
- preferences;
- relationships to Passenger/Driver/Admin scopes.

### Capability
Examples: PASSENGER, DRIVER, ADMIN_ACCESS.

Capabilities are server-authoritative grants. Client metadata cannot self-grant capability.

A User may possess Passenger and Driver capabilities simultaneously. Capability does not imply current availability or permission for every scoped action.
### Driver Profile
Extends User with marketplace-supply identity.

Owns:
- Home Market;
- standing;
- verification linkage;
- vehicle relationships;
- service preferences;
- reliability evidence references.

Home Market is organizational, not the immediate source of supply eligibility.

### Admin Grant
Represents Permission + Scope, never a universal boolean admin assumption.

Examples:
- MARKET_OPERATIONS on Market Gomoh;
- STATE_OPERATIONS on Jharkhand;
- TRUST_SAFETY on Jharkhand;
- VERIFICATION on Jharkhand;
- LOCAL_COMMERCE on Market Dhanbad;
- PLATFORM_ADMIN on India/platform.

An Admin action is valid only when the caller possesses the required permission covering the target object's scope.

## 4. Geographic domain

Hierarchy:

**Country → State → Market → Location/Node**
### Market
A configurable Raahi operating cell. User-facing language may say Raahi Gomoh or Raahi Dhanbad; Market is the internal scalable boundary.

Fields/meaning include:
- parent State;
- display identity;
- lifecycle state;
- operating geometry/radius or recognized origin nodes;
- timezone/locale defaults;
- activation/pilot settings.

Market lifecycle: DISCOVERED → PREPARING → PILOT → ACTIVE → SCALING, with PAUSED where needed.

### Location / Node
A geocodable operational place within or relevant to Markets: town, city area, station, airport, boarding hub or other recognized node.

Location is not itself a Service Product.

### Corridor
A directed origin Location → destination Location relationship representing observed or configured mobility demand.

Corridor does not define fare, matching, schedule or service behavior.

### Service Product
Defines how mobility is sold/formed on a Corridor or Market context.

Examples: FIXED_ONE_WAY, FIXED_ROUND_TRIP, SCHEDULED_SHARED, OUTSTATION_PRIVATE where configured, with future types allowed deliberately.
A Service Product owns configurable policy such as:
- origin Market;
- corridor/version;
- service type;
- active/pilot/engine mode;
- authoritative fare rule;
- bookable capacity policy;
- formation/dispatch policy;
- boarding timer;
- refill window;
- Round Trip stay/return terms;
- any schedule windows;
- effective-from/version information.

Structural Product changes are future-effective/versioned when active or historical commitments would otherwise be reinterpreted.

## 5. Passenger location and travel-intent domain

Passenger browsing origin is freely chosen. It does not require physical presence merely to search or plan.

### Travel Intent
Represents meaningful Passenger demand that is not yet a committed booking.

Use cases:
- no existing product/supply;
- future date interest;
- emerging corridor demand;
- notification interest;
- product-discovery analytics.

Travel Intent must never silently become a Booking or consume capacity without an explicit canonical commitment action.
Travel Intent captures only data necessary for demand intelligence and follow-up; it is not permission to disclose Passenger identity to Drivers or merchants.

## 6. Driver operating domain

### Driver Operating Context
Represents where an eligible Driver is genuinely prepared to supply mobility now.

Contains:
- Driver;
- Current Operating Market;
- verified location evidence/time;
- activation timestamp;
- status;
- optional expiry/revalidation policy.

Rules:
- exactly one current Operating Market per Driver at a time;
- Driver chooses/expresses intent;
- System verifies physical eligibility;
- changing Operating Market exits incompatible uncommitted availability/queues;
- active commitments cannot be abandoned by changing Operating Market;
- Operating Market selection itself never joins a queue or accepts work.

GPS/location is used for this operational verification and later fulfilment needs, not as justification for unnecessary all-day tracking.

### Driver Service Preference
Persistent willingness to see/participate in service categories or specific products where appropriate.

Preference is advisory eligibility/filter state, not a commitment.
## 7. Fixed Route supply/demand objects

### Driver Availability
One explicit offer of supply for one Service Product using one Vehicle.

Fields/meaning:
- Driver;
- Vehicle;
- Service Product;
- Operating Market snapshot;
- server queue timestamp;
- status;
- queue/priority metadata;
- eligibility snapshot/recheck markers.

Availability = **Service + Product + Vehicle + Operating Market + Time**.

No Ride is created merely because Driver Availability enters FIFO.

### Fixed Passenger Request
One Passenger/group request for a Fixed Service Product.

Fields/meaning:
- booking holder User;
- Service Product;
- seat quantity;
- boarding choice/area where applicable;
- server queue timestamp;
- status;
- bypass/protected-priority state;
- material request version.

Passenger group is atomic unless Passenger explicitly accepts splitting in a future product.
### Fixed matching invariant
For each Service Product, System owns deterministic compatible FIFO matching.

Initial V1 clearing default: create a Ride only when a compatible Passenger batch fills the Vehicle's configured bookable Passenger capacity, unless that Product explicitly uses another approved formation policy.

Driver does not choose passengers. Passenger does not choose Fixed Driver.

Pre-match visibility is aggregate liquidity only.

Example capacity 4:
- P1 requests 3;
- P2 requests 2;
- P3 requests 1.

Compatible clearing selects P1 + P3. P2 retains priority for the next compatible vehicle.

Starvation protection is server state. After the frozen compatible-bypass threshold, an older request receives protected priority without freezing unrelated incompatible capacity forever.

Matcher transaction must atomically:
1. lock/recheck eligible Driver Availability;
2. lock/recheck Passenger Requests;
3. recheck Vehicle/product eligibility;
4. create Mobility Commitment;
5. create Ride;
6. create Ride Bookings;
7. transition source queues/requests;
8. record business events.
If any step fails, no partial assignment may survive.

## 8. Cross-service commitment authority

### Mobility Commitment
The universal scheduling/obligation lock for Driver and Vehicle.

Every service that commits Driver/Vehicle time must create or reserve through this authority:
- Fixed One Way assignment;
- Fixed Round Trip assignment;
- accepted Outstation quote;
- committed Carpool journey/bookings where applicable;
- confirmed Raahi Trip.

Fields/meaning:
- Driver;
- Vehicle;
- owning service object;
- origin Market;
- start/end commitment window or open active boundary;
- status;
- creation reason;
- released/terminal reason.

P0 invariant: one Driver or Vehicle cannot acquire incompatible overlapping active commitments.

Conflict checks are server-side and serialized/atomic. Client calendar checks are advisory only.

A commitment cannot be erased to hide cancellation/failure; it transitions terminal and remains historical.
## 9. Ride, Booking and Event domain

### Ride
Authoritative fulfilment object created after a real commitment exists.

Contains/snapshots:
- service type/Product reference;
- origin Market;
- origin/destination;
- Driver;
- Vehicle;
- agreed commercial terms/fare authority;
- scheduled/actual timestamps;
- current lifecycle state;
- Round Trip linkage/terms where relevant;
- material configuration version.

Ride state is not derived from whatever screen a user last opened.

### Ride Booking
Represents Passenger/group commitment to a Ride.

Contains:
- Ride;
- booking holder;
- seat quantity;
- fare/share snapshot;
- boarding/drop context;
- lifecycle;
- outbound/return participation state where applicable;
- cancellation/no-show reason state.

Physical numbered seat ownership is not required as the commercial identity of canonical Fixed booking unless a future product explicitly needs assigned seats.
### Ride Event
Immutable/factual event stream for material lifecycle facts.

Examples:
- MATCHED;
- DRIVER_ACKNOWLEDGED;
- DRIVER_EN_ROUTE;
- DRIVER_ARRIVED;
- PASSENGER_BOARDED;
- PASSENGER_NO_SHOW;
- DEPARTED;
- OUTBOUND_COMPLETED;
- RETURN_BOARDING_STARTED;
- DRIVER_FAILED;
- BREAKDOWN_REPORTED;
- COMPLETED;
- CANCELLED.

Event minimum metadata:
- event ID;
- aggregate/object IDs;
- server timestamp;
- actor type/ID where applicable;
- previous/current state where applicable;
- canonical reason code;
- evidence/provenance reference;
- idempotency/command correlation reference.

Current state supports fast operation; events support reconstruction/audit. Neither should contradict the other.
## 10. Fixed fulfilment lifecycle contract

Fixed One Way Ride states:

MATCHED → DRIVER_ACKNOWLEDGED → DRIVER_EN_ROUTE → DRIVER_ARRIVED → BOARDING → READY_TO_DEPART → IN_PROGRESS → COMPLETED.

Exceptional states/events include DRIVER_FAILED, CANCELLED and SYSTEM_EXCEPTION with recovery rules.

Rules:
- post-match Driver has no fresh commercial accept/reject decision;
- acknowledgement is operational confirmation only;
- arrival requires canonical proximity evidence;
- boarding timer starts at verified arrival, not assignment;
- Passenger no-show may release seats under policy;
- short refill cannot hold compliant users indefinitely;
- Driver failure preserves Passenger recovery priority;
- system failure must not create user reliability penalties.

Fixed Round Trip extends the same Ride through:

OUTBOUND_BOARDING → OUTBOUND_IN_PROGRESS → OUTBOUND_COMPLETED → WAITING_FOR_RETURN → RETURN_BOARDING → RETURN_IN_PROGRESS → COMPLETED.

Outbound completion never releases the Driver/Vehicle commitment or return seats.
## 11. Outstation domain

### Outstation Request
Passenger-owned private-car demand.

Contains origin Market/locality, destination, date/time, one-way/round-trip, passenger count and optional relevant notes.

Lifecycle: DRAFT → OPEN/QUOTING → DRIVER_SELECTED/CONFIRMED → UPCOMING → fulfilment → COMPLETED, with CANCELLED/EXPIRED and DRIVER_CANCELLED → REOPENED recovery.

### Outstation Quote
Driver-owned commercial proposal linked to one Request.

Contains:
- Driver/Vehicle snapshot;
- price;
- included/excluded toll/parking terms;
- note;
- revision number;
- submitted/updated timestamp;
- validity/expiry;
- status.

Quote revisions are preserved. Drivers never receive competitor quote amounts.

Acceptance references an exact revision and atomically rechecks revision freshness, quote validity, Driver/Vehicle verification, capacity, standing and Mobility Commitment conflicts.

Exactly one quote can win. Other current quotes become terminal/not-selected. Stale notifications cannot reopen a closed Request.
## 12. Carpool domain

### Carpool Journey
Driver-created journey that exists independently of Passenger demand.

Contains origin, destination, departure, Driver/Vehicle, spare capacity, contribution/fare and publication state.

Rules:
- Driver must be making the underlying journey;
- eligible Passenger booking is instant in V1;
- capacity consumption is atomic;
- Driver cannot reduce below committed bookings;
- price locks after first booking;
- material destination/time change requires re-consent or cancellation path;
- Driver cancellation does not convert the journey into another service type.

Home Market does not artificially prohibit a genuine Carpool journey; canonical eligibility and commitment conflicts still apply.

## 13. Raahi Trip / Explore domain

### Trip Offering
Driver-created shared leisure/day-travel opportunity.

Contains origin, destination, departure/return, Driver/Vehicle, seats, per-seat price, minimum confirmation threshold, confirmation deadline and descriptive itinerary context.

Lifecycle: DRAFT → PUBLISHED/FILLING → CONFIRMED → UPCOMING → fulfilment → COMPLETED, with NOT_CONFIRMED/EXPIRED and DRIVER_CANCELLED branches.
Rules:
- Passenger bookings consume capacity atomically;
- below-threshold bookings are explicitly not yet confirmed;
- reaching threshold before deadline confirms once and creates/locks commitment as defined;
- once confirmed, later Passenger cancellations do not unconfirm the Trip;
- missing threshold by deadline releases bookings without Passenger reliability penalty;
- price locks after first booking;
- confirmed Driver/Vehicle material changes require canonical cancellation/re-consent treatment;
- initial product sells transport/wait/return, not bundled hotel/guide/ticket/package-tour promises.

## 14. Vehicle and verification domain

### Vehicle
Durable vehicle identity with actual bookable Passenger capacity separated from marketing labels such as `5-seater`.

Lifecycle includes REGISTERED/PENDING_VERIFICATION/ELIGIBLE and unavailable/expired/suspended/retired states as required.

### Verification
Independent evidence states for Phone, DL, RC and Vehicle Photos.

Document lifecycle: NOT_SUBMITTED → SUBMITTED/UNDER_REVIEW → VERIFIED / REJECTED / NEEDS_RESUBMISSION / EXPIRED.

Uploaded does not mean Verified.

Raw DL/RC evidence remains private to authorized Driver/Admin roles. Passenger projections expose factual status indicators only.
### Driver Standing
ACTIVE / TEMPORARILY_RESTRICTED / UNDER_REVIEW / SUSPENDED / DISABLED.

Standing is separate from verification status and from individual Reliability Events.

## 15. Fare and direct-payment domain

Authoritative fare source depends on service:
- Fixed: Service Product fare snapshot;
- Outstation: accepted Quote revision;
- Carpool: published contribution snapshot;
- Raahi Trip: published per-seat price snapshot.

Historical agreed fare is immutable through ordinary operations.

### Payment Acknowledgement
Raahi records declarations; it does not initially custody money.

Lifecycle:
DUE → PASSENGER_MARKED_PAID → DRIVER_CONFIRMED_RECEIVED
or PAYMENT_DISPUTED.

Rules:
- Ride can be COMPLETED while Payment is DUE;
- Passenger marks their obligation paid;
- Driver confirms receipt;
- dispute creates/links a Case;
- Admin does not fabricate Driver receipt;
- UI never claims processor/bank success merely from these declarations.
## 16. Reliability and reason-code domain

### Reliability Event
Factual marketplace-behaviour evidence, not a public rating.

Examples:
- Driver missed acknowledgement;
- Driver post-assignment cancellation;
- Driver no-show;
- Passenger post-assignment cancellation;
- Passenger no-show;
- confirmed breakdown;
- return abandonment;
- system-caused failure correction.

Every event carries canonical Reason Code and evidence/provenance.

Reason examples:
PASSENGER_VOLUNTARY, DRIVER_VOLUNTARY, DRIVER_NO_SHOW, PASSENGER_NO_SHOW, BREAKDOWN, WEATHER_SAFETY, SYSTEM_FAILURE, ADMIN_CORRECTION, WRONG_VEHICLE.

Progressive enforcement derives from factual events plus policy; event existence is not automatically guilt or permanent punishment.

Service-specific restrictions are preferred when proportionate before account-wide restriction.

## 17. Case / support domain

Case is separate from Ride, Booking, Payment, Verification and Account state.
Case categories include Safety, Driver did not arrive, Passenger did not arrive, Wrong vehicle, Payment problem, Fare/quote disagreement, Behaviour, Breakdown, App/system problem, Verification and Other.

Case lifecycle:
OPEN → ACKNOWLEDGED → UNDER_REVIEW → RESOLVED / CLOSED_NO_ACTION / ESCALATED / DUPLICATE / UNABLE_TO_DETERMINE.

Rules:
- opening a Case never silently mutates Ride/Payment;
- critical safety may trigger separately recorded precautionary restriction;
- Admin can correct consequences, not rewrite evidence;
- enforcement state is separate from Case state;
- every Admin action is audited.

## 18. Business / Local Offer domain

### Business
Merchant/business identity scoped to relevant Market(s).

### Local Offer
Sponsored/contextual commercial content with lifecycle:
DRAFT → SUBMITTED/UNDER_REVIEW → APPROVED → SCHEDULED/ACTIVE → EXPIRED, with REJECTED/PAUSED/SUSPENDED/REMOVED branches.

Offer eligibility may use Market, origin/destination locality, category and timing context.

P0 invariant: Offer sponsorship never changes mobility matching, FIFO, quote selection, verification, commitment priority or safety behavior.

Merchant receives aggregate performance only; no named Passenger identity/phone/journey history.
## 19. Notification domain

Notification is delivery/read state around authoritative business events; it is never the source of business truth.

Minimum linkage:
- recipient User;
- source business object/event;
- priority/channel intent;
- created/delivered/read timestamps;
- deep-link object reference;
- stale/superseded handling where useful.

Operational and promotional preferences are separate.

A stale notification opens current server projection; it does not replay an expired action.

## 20. Market metrics / analytics domain

Metrics should be derived from authoritative objects/events where feasible.

Company/Market metrics include:
- Travel Intents;
- successful assigned/completed journeys;
- Demand Success Rate;
- match/wait time;
- fill/occupancy rate;
- Driver availability/utilization;
- cancellations/no-shows/failures;
- repeat journey rate;
- emerging corridor demand;
- Time to Liquidity for new Markets/products;
- Local Offers revenue/engagement;
- Market operating cost/contribution indicators when finance data exists.
## 21. Canonical command doctrine

Every material mutation is a server command/RPC with:
- authenticated actor or explicitly public-safe caller;
- authorization/ownership checks;
- current-state validation;
- business-rule validation;
- atomic write transaction;
- idempotency key/correlation where retry can duplicate intent;
- event/audit output where material;
- no trust in caller-supplied role, queue timestamp, verification, fare authority or lifecycle state.

The UI may optimistically style non-critical controls, but authoritative success comes from command result + refetched projection.

## 22. Identity / Market commands

Conceptual commands:
- `set_my_display_name`
- `switch_experience_mode` (client preference only; never capability mutation)
- `admin_grant_capability_or_scope`
- `admin_revoke_capability_or_scope`
- `driver_set_operating_market`
- `driver_clear_operating_market`
- `admin_create_market_draft`
- `admin_transition_market_lifecycle`
- `admin_create_location`
- `admin_create_or_version_corridor`
- `admin_create_or_version_service_product`
- `admin_publish_service_product`

`driver_set_operating_market` must verify physical eligibility and reconcile incompatible uncommitted availability atomically.
## 23. Passenger search / intent commands

Search itself is read-only and may accept any active origin/destination selection.

Mutations:
- `create_travel_intent`
- `cancel_travel_intent`
- `update_intent_notification_preference`

Travel Intent creation must be rate-limited/abuse-aware and must not create Fixed queue position unless the Passenger explicitly joins that Fixed Product.

## 24. Fixed commands

Passenger:
- `join_fixed_queue(product_id, seat_count, boarding_context, idempotency_key)`
- `cancel_fixed_queue_request(request_id)`

Driver:
- `join_fixed_driver_queue(product_id, vehicle_id, idempotency_key)`
- `leave_fixed_driver_queue(availability_id)`

System/internal:
- `match_fixed_product(product_id)`
- `expire_or_protect_fixed_requests(product_id)`
- `handle_assignment_ack_timeout(ride_id)`
- `open_refill_window(ride_id)` / deterministic equivalent
- `close_refill_and_depart(ride_id)` / deterministic equivalent

Fulfilment:
- `driver_acknowledge_assignment`
- `driver_begin_approach`
- `driver_arrive`
- `driver_mark_boarded`
- `driver_report_passenger_no_show`
- `driver_report_breakdown`
- canonical trip progression/completion commands.
Fixed command guards:
- Passenger cannot select Driver;
- Driver cannot select Passenger;
- caller-supplied FIFO timestamps are ignored/rejected;
- Driver must be eligible in Product origin Operating Market at queue entry;
- joining a queue does not create Ride;
- post-match cancellation/failure reason is recorded;
- duplicate commands are idempotent;
- system outage correction can restore priority without deleting history.

## 25. Outstation commands

Passenger:
- `create_outstation_request`
- `update_open_outstation_request` where legal
- `cancel_outstation_request`
- `accept_outstation_quote(request_id, quote_id, revision, idempotency_key)`

Driver:
- `submit_outstation_quote`
- `revise_outstation_quote`
- `withdraw_outstation_quote`
- `ignore_outstation_request`
- `cancel_accepted_outstation_booking` with reason.

System:
- expire quotes;
- close losing quotes after atomic acceptance;
- reopen original Request after selected Driver cancellation;
- notify eligible supply based on Operating Market/service preferences.

Old quote revisions never reactivate silently when a Request reopens.
## 26. Carpool / Trip commands

Carpool Driver:
- `publish_carpool_journey`
- `update_uncommitted_carpool`
- `propose_material_carpool_change`
- `cancel_carpool_journey`

Carpool Passenger:
- `book_carpool_seats`
- `cancel_carpool_booking`
- `accept_or_reject_material_change`.

Raahi Trip Driver:
- `create_trip_draft`
- `publish_trip_offering`
- `update_unbooked_trip`
- `cancel_trip_offering`.

Raahi Trip Passenger:
- `book_trip_seats`
- `cancel_trip_booking`.

System:
- atomically confirm threshold when reached;
- expire/not-confirm at deadline;
- create/lock commitment on canonical confirmation;
- preserve confirmed state after later Passenger cancellations.

All capacity mutations serialize against the current remaining bookable capacity.
## 27. Payment / support commands

Payment:
- `passenger_mark_payment_paid`
- `driver_confirm_payment_received`
- `report_payment_issue`

No command in this initial model moves funds.

Support:
- `report_issue(object_type, object_id, category, details)`
- `add_case_evidence`
- `admin_acknowledge_case`
- `admin_resolve_case`
- `admin_escalate_case`
- `admin_apply_precautionary_restriction`
- `admin_correct_reliability_consequence` with audit/reason.

Support commands cannot quietly invoke cancellation/payment/queue commands as side effects unless a specifically designed recovery command makes that consequence explicit and auditable.

## 28. Verification / standing commands

Driver:
- submit/replace/remove own verification evidence under private-storage rules.

Authorized verification operator:
- `review_driver_verification`
- `mark_verification_needs_resubmission`
- `expire_verification` where policy/system does not do it automatically.

Standing/enforcement commands require appropriate scope and reason/evidence; serious permanent removal requires human-reviewed authority.
## 29. Offer commands

Authorized commerce/admin operators:
- create Business;
- create/review/approve/pause/remove Offer;
- set Market/context/schedule eligibility;
- view aggregate performance.

No Offer command has write access to marketplace queue, Ride, Quote, Booking, Payment, verification or ranking state.

## 30. Projection doctrine

Clients consume purpose-built projections for the next decision, not raw authoritative tables.

Projection principles:
- least data necessary;
- privacy stage aware;
- role/capability/scope aware;
- server-computed derived fields where business-sensitive;
- stale Realtime event causes refetch;
- projection may combine legacy + target history during migration but must label/normalize state correctly.

Core Passenger projections:
- active Markets/Locations;
- search `Ways to Go`;
- Fixed queue status/liquidity;
- assigned Ride detail;
- My Rides;
- Outstation request/quotes;
- Explore/Trip listings/details;
- Offers;
- payment/case status.

Pre-match Fixed projection never includes Driver identity/contact/vehicle identity.
Core Driver projections:
- Driver identity/Home Market/standing;
- Current Operating Market and verification status;
- origin-Market product/demand summaries;
- own Fixed queue positions;
- assigned/active Ride next action;
- eligible Outstation opportunities;
- My Trips / history;
- payment acknowledgements;
- verification status.

Pre-commitment Driver projections show aggregate demand, never Passenger identities/phones.

Core Market Admin projections:
- Market health summary;
- demand/supply/product health;
- active exceptions;
- emerging corridors;
- scoped users/Drivers;
- Cases;
- Market/Product configuration;
- Businesses/Offers;
- factual milestones.

Core State Operations projections:
- cross-Market health comparison;
- supply constraints;
- demand success/time-to-liquidity;
- safety/system escalations;
- cross-Market Driver operating patterns in aggregate/authorized detail;
- pilot/product performance.
## 31. Authorization model

Authorization is evaluated from trusted server state using Actor + Capability + Permission + Scope + Object relationship + Current state.

Examples:

Passenger may:
- browse any active Market origin;
- create own intent/request/booking;
- read own commitments/payment/Cases;
- read relationship-scoped Driver trust after applicable commitment/listing rules.

Driver may:
- set own Operating Market subject to physical verification;
- publish/queue/quote only when Driver standing/verification/Vehicle/Market rules permit;
- read Passenger fulfilment identity only for legitimate committed work;
- never read competitor Outstation prices.

Market Admin may:
- observe and configure only scoped Markets subject to permission;
- handle scoped exceptions;
- never manually reorder ordinary Fixed FIFO or choose a matching Driver merely because they are Admin.

State/Platform roles may have broader scope but still use canonical commands; scope breadth does not bypass marketplace invariants.
## 32. Progressive visibility contract

Fixed pre-match Passenger:
- product/fare;
- aggregate formation/liquidity;
- own request state;
- no Driver identity/contact/location.

Fixed pre-match Driver:
- product/demand aggregate;
- own queue position;
- no Passenger identity/contact.

Post-assignment Passenger:
- Driver photo/display name;
- vehicle/photos/registration;
- factual verification indicators;
- operational live approach/location;
- contact.

Post-assignment Driver:
- booking-holder names/seat counts;
- boarding/contact needed for fulfilment;
- no irrelevant Passenger history.

Outstation pre-acceptance Driver:
- sufficient locality/destination/timing/count/notes to quote;
- no exact private pickup/phone.

Merchant:
- aggregate Offer analytics only.
## 33. Event and audit separation

Business Events describe what happened in the marketplace. Admin Audit describes who used privileged operational/configuration authority.

A single action may legitimately create both.

Examples:
- Driver cancellation creates Ride/Commitment/Reliability events;
- Admin correcting a false consequence creates an Admin Audit entry plus corrective event;
- Market Product publication creates configuration audit/event;
- ordinary Passenger search does not need privileged audit.

Events used for analytics must retain provenance and avoid silently changing definition over time. Material metric-definition revisions should be versioned/documented.

## 34. Idempotency contract

Commands vulnerable to network retry/double tap require caller-provided or server-derived idempotency identity scoped to actor + action/object.

At minimum cover:
- queue joins;
- bookings;
- quote acceptance;
- payment declarations;
- cancellations;
- arrival/boarding/completion transitions;
- Trip threshold confirmation;
- selected Admin recovery actions.

Same valid idempotency key returns/reconstructs the prior successful result; it never creates a second commitment.
## 35. Concurrency / locking contract

The database must serialize decisions where simultaneous success would violate an invariant.

Required atomic/locked zones include:
- Fixed matcher allocation;
- Driver/Vehicle Mobility Commitment acquisition;
- Carpool/Trip remaining capacity booking;
- Outstation quote acceptance;
- Trip threshold confirmation;
- queue cancellation vs matcher selection;
- Driver Operating Market change vs availability/commitment transition.

Do not rely on frontend disabling, `SELECT` then later `UPDATE`, or eventually-consistent UI checks for exclusivity.

P0 concurrency outcomes:
- Passenger allocated at most once;
- Driver/Vehicle committed at most once incompatibly;
- one Outstation quote accepted;
- final seat not oversold;
- one Trip confirmation event;
- one legal terminal transition.

## 36. Configuration doctrine

Timers/thresholds/policies that may reasonably evolve are centralized and versioned/configured, not scattered as UI constants.

Examples: Fixed capacity policy, acknowledgement timeout, boarding timer, refill window, starvation threshold, quote validity default, return reminders and enforcement cooldown values.
A Ride/Booking/Quote snapshots the governing commercial/operational terms needed to preserve historical meaning after future configuration changes.

## 37. Legacy coexistence contract

Current Raahi legacy objects remain historical/current-engine truth while migration proceeds.

Do not rewrite completed legacy trips into target objects merely for cosmetic unification.

During coexistence:
- a Service Product has exactly one creation engine authority at a time;
- no Product accepts Legacy and Target Fixed bookings simultaneously;
- committed legacy journeys finish under legacy lifecycle;
- new target commitments use target kernel;
- My Rides/History may combine projections from both models;
- migration tooling preserves origin/source provenance.

A cutover/rollback switch controls new commitment creation only; it does not retroactively mutate committed journeys.

## 38. No city-specific implementation rule

No business path may encode special behavior such as `if city == Gomoh` or `if route == GD-01` except fixtures/tests or temporary explicitly documented migration adapters.

Market, Location, Corridor, Product and policy configuration drive behavior.

Launching Raahi Dhanbad should predominantly be configuration + supply onboarding + operational activation, not a new application build.
## 39. Logical storage candidates

Physical names may be refined during migration design, but one authoritative storage responsibility must exist for each concept.

Suggested target stores:
- `user_capabilities`
- `admin_scope_grants`
- `markets`
- `locations`
- `corridors`
- `service_products` + version/policy data
- `driver_operating_context`
- `driver_service_preferences`
- `driver_availability_v2`
- `travel_intents`
- `fixed_passenger_requests_v2`
- `mobility_commitments`
- `rides_v2`
- `ride_bookings_v2`
- `ride_events_v2`
- existing/evolved vehicle + verification stores
- existing/evolved Outstation request/quote stores with quote revisions
- `carpool_journeys` + bookings
- `trip_offerings` + bookings
- `payment_acknowledgements`
- `reliability_events_v2`
- existing/evolved Cases
- existing/evolved Businesses/Offers
- notification/event delivery state.

Do not create duplicate stores merely because different screens need different shapes; use projections.
## 40. Required database constraints / invariant support

Where PostgreSQL can enforce a rule safely, prefer database constraints/indexes plus command checks over application convention alone.

Required protections include conceptually:
- one current Driver Operating Context;
- no duplicate active Fixed Passenger Request for incompatible same-person/product intent as defined;
- no duplicate active Driver Availability for same Driver/Product where prohibited;
- unique material revision identity for Outstation Quote;
- unique accepted quote per Outstation Request;
- active commitment exclusion/conflict serialization;
- positive seat/capacity values;
- fare/price non-negative and currency explicit;
- legal enum/state values;
- durable foreign-key integrity;
- one current published Product version per product family where versioned;
- one current Market lifecycle row/object;
- idempotency uniqueness scoped to command actor/action.

Partial unique indexes/exclusion constraints/advisory locks may be used where appropriate, but their intended business invariant must be documented in the migration and contract test.

## 41. Data minimization / retention

Store operational data because Raahi needs it for fulfilment, trust, support, legal/financial obligations or legitimate product improvement—not because it may someday be interesting.

Live precise Driver location receives stricter retention than ordinary immutable Ride events.
Operational phone visibility should end after the active commitment and defined short support window in normal UI/projections, recognizing that disclosure already seen cannot be technically erased from another person's memory/device.

Raw verification documents use private storage and purpose-limited access/audit.

Analytics should prefer aggregated/derived Market/Product facts over exposing individual journey histories to broad operators.

## 42. Observability contract

The kernel must make abnormal marketplace states detectable before relying on customer reports.

Monitor/derive alerts for:
- matcher transaction failures;
- unmatched requests beyond expected policy windows;
- impossible duplicate commitments;
- stuck Ride states/timers;
- notification delivery failures for critical events;
- GPS absence/staleness during required fulfilment stages;
- quote-expiry/acceptance errors;
- Trip threshold jobs failing;
- unusual Driver cancellation/no-show patterns;
- unresolved safety/system Cases;
- projection/RPC error rates;
- database lock/contention anomalies.

Operational monitoring is not authority to mutate state automatically unless the corresponding recovery rule is explicitly canonical.

## 43. Acceptance traceability

Every P0/P1 Acceptance Matrix scenario must map to at least one domain command/invariant/projection in this contract before implementation is called complete.
Minimum P0 trace examples:
- `Fixed passenger can queue with no active car` → Fixed Passenger Request independent of Ride;
- `No Ride at 3/4 seats under FULL_CAPACITY` → matcher policy;
- `P1=3,P2=2,P3=1` → compatible FIFO batching;
- `Driver cannot see Passenger pre-match` → projection privacy;
- `Driver failure preserves Passenger priority` → queue/reliability/recovery events;
- `Round Trip blocks overlapping job` → Mobility Commitment;
- `two quote accepts` → Outstation atomic acceptance;
- `completed Ride can remain payment due` → Payment separation;
- `Report Issue does not cancel` → Case separation;
- `Driver changes Operating Market` → physical verification + availability reconciliation.

## 44. P0 target invariants summary

1. No partial assignment.
2. No incompatible double Driver/Vehicle commitment.
3. No Passenger/Driver selection in Fixed pre-match.
4. No identity/contact leak before its relationship stage.
5. No direct-payment declaration masquerades as processed payment.
6. No Case silently rewrites Ride/Payment facts.
7. No merchant sponsorship affects mobility allocation.
8. No Admin dispatch/reorder shortcut bypasses deterministic marketplace rules.
9. No client-supplied role, FIFO timestamp, fare authority, verification or state transition is trusted.
10. No duplicate network retry creates duplicate commercial commitment.
11. No historical fact is destructively rewritten to make an exception disappear.
12. No Market expansion requires city-specific marketplace logic.
## 45. Implementation bridge

The next engineering-design artifact after this contract is the **Migration / Physical Schema Plan**, which must answer for every logical object:
- reuse current table;
- extend current table;
- create new target table;
- retain legacy table as historical/current-engine only;
- data backfill required or not;
- authorization/RLS/RPC boundary;
- indexes/constraints;
- cutover feature switch;
- rollback behavior;
- contract tests required before activation.

Do not write target migrations until that map is reviewed against the current repository schema and this contract.

The first functional target remains the Fixed One Way vertical slice, but shared identity/Market/Product/Operating-Market/Commitment foundations must exist first.

## 46. Freeze rule

This Domain/Data Contract is a target architecture contract, not permission to mutate production.

Material changes to ownership, identifiers, authorization, commitments, privacy, matching, payment or event semantics require a documented architecture decision and impacted acceptance review.

**Canonical data principle:**

> Store the facts and commitments Raahi needs to operate a trustworthy marketplace; derive screens and metrics from those facts rather than turning screens into the business model.
