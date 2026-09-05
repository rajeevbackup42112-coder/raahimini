# Raahi 2.0 Architecture Freeze v1.0

**Frozen:** 2026-09-05
**Status:** Target architecture for the next Raahi marketplace implementation
**Scope:** Raahi mobility platform only; never Raahi School
**Relationship to current code:** The current Demo Ready engine remains valid legacy implementation evidence until each product is deliberately migrated. This document defines the target, not an assertion that the target is already built.

## 1. Company definition

Raahi is a local mobility network that discovers travel demand, organizes relevant supply, creates trusted journeys, and helps each local market become progressively more connected.

Raahi is not merely a booking app, taxi aggregator, carpool feature, or route directory. It is intended to become a repeatable operating system for local and regional mobility markets.

**North star:** Make local mobility visible, trustworthy, discoverable and enjoyable in a way that did not exist before.

**Expansion principle:** Start geographically narrow; design structurally broad.

**Operating principle:** Humans express intent â†’ Raahi defines rules â†’ System applies and executes rules â†’ Admin handles exceptions.

**System authority without discretion:** Automatic marketplace decisions must map to explicit, inspectable business rules.
## 2. Geographic operating model

Raahi launches as a network of **Markets**. A Market may be presented publicly as a town/city brand such as `Raahi Gomoh` or `Raahi Dhanbad`, but the database concept is deliberately not tied to municipal boundaries.

Hierarchy:
- Country
- State
- Market
- Location / mobility node
- Corridor
- Service Product

Examples of Locations include Gomoh, Dhanbad, Ranchi, Ranchi Airport, Parasnath and Madhuban. Airports, stations and mobility hubs may be Locations even when they are not Markets.

Every journey has exactly one **Origin Market**. The Origin Market owns that journey's operational marketplace, metrics and local exception context.

A Market launches only when Raahi has a credible plan for useful liquidity. Town existence alone is not sufficient reason to create a Market.

Markets may later be regrouped operationally without rewriting journey history. Historical journeys preserve the Market identity that owned them when committed.

## 3. Market lifecycle

`DISCOVERED â†’ PREPARING â†’ PILOT â†’ ACTIVE â†’ SCALING`, with `PAUSED` available when quality or operating conditions require it.

Market activation is a business/operations decision. The System may identify opportunity, but it does not autonomously launch a Market.
## 4. Driver market model

A Driver has one **Home Market** and at most one **Current Operating Market** at a time.

Home Market is organizational identity: onboarding relationship, primary market attribution, Driver acquisition metrics and local governance context. It does not by itself grant queue priority.

Current Operating Market is where the Driver is physically prepared to work now. For immediate mobility products, Raahi verifies reasonable physical presence when the Driver selects or activates that Market.

Changing Operating Market does not automatically join any route or make the Driver available for all work. Driver intent remains explicit at the Product level.

Canonical eligibility for Fixed One Way / Fixed Round Trip:
`verified Driver + eligible Vehicle + Current Operating Market = Product Origin Market + explicit Product availability + no conflicting commitment + Product-specific location rules`.

Once eligible, Drivers share the same Product FIFO regardless of Home Market. Home-market Drivers and visiting Drivers do not receive different FIFO priority.

A Driver may have only one Current Operating Market. Changing it exits incompatible uncommitted availability in the former Market and never transports FIFO position.

An active commitment controls the Driver/Vehicle operational context until the commitment reaches a legal release state.

GPS is used at the moment operational presence needs proof, while queued for products that require continuing proximity, and during active fulfilment. Raahi does not continuously track idle Drivers merely because they are signed in.
## 5. Mobility catalogue

A **Corridor** describes geographic connection. A **Service Product** describes how Raahi commercially and operationally serves that connection.

A single Corridor may support multiple Products without duplicating geography.

Initial Product families:
1. Fixed One Way â€” Passenger FIFO + Driver FIFO; System creates the journey when the clearing rule is met.
2. Fixed Round Trip â€” separate pool; same Driver/Vehicle and booked seats committed outbound, wait and return.
3. Carpool â€” Driver independently has a journey and publishes spare seats; eligible Passenger books.
4. Outstation â€” Passenger requests whole Vehicle; eligible Drivers privately quote; Passenger chooses.
5. Raahi Trips / Explore â€” Driver creates a planned shared leisure/day journey; Passenger discovers and books.

Future products such as Scheduled Shared Airport Ride are created as new Product types/policies, not as city-specific code paths.

Every Product is configured within an Origin Market and points to its relevant Corridor/Locations.

Products own configurable commercial/operational policy such as fare source, capacity policy, boarding windows, confirmation threshold, stay duration and fulfilment rules.

No code should contain business logic equivalent to `if city == Gomoh`. Geography and Product behavior must be data/configuration driven.

## 6. Emerging-route discovery

A search for an unsupported destination is useful demand intelligence, not a dead end.
Raahi records a **Travel Intent** when a Passenger expresses legitimate demand that current Products cannot satisfy.

Travel Intent may include origin, destination, desired date/time/window, seats/group size, acceptable service form and notification interest. Intent is not a booking and creates no commitment.

Aggregated intent can surface an **Emerging Corridor Opportunity** such as Gomoh â†’ Ranchi Airport.

Route/Product opportunity lifecycle:
`DEMAND_SIGNALLED â†’ UNDER_EVALUATION â†’ PILOT_APPROVED â†’ PILOT â†’ ACTIVE`, with `PAUSED` / `RETIRED` terminal governance states as appropriate.

The System may rank opportunities using demand frequency, time concentration, supply interest, fulfilment history and route economics. Human Market/State Operations approves launch policy.

## 7. Identity and capabilities

One authenticated User may hold multiple capabilities such as Passenger and Driver. Admin authority is independently scoped and never implied by Driver/Passenger capability.

User-facing Passenger/Driver **mode** changes interface context only. It does not mutate commitments, queue positions, verification or account history.

Driver eligibility additionally depends on approved Driver profile, current verification, Vehicle eligibility, standing and Product rules.

Capability authorization is enforced server-side. UI visibility is not authority.

## 8. Core marketplace ownership

Passenger/Driver state is not a screen property. PostgreSQL remains authoritative operational state.
Canonical target objects:
- User / Capability / Profile
- Market / Location / Corridor / Service Product
- Driver / Vehicle / Verification / Driver Standing
- Operating Market Session / Product Availability
- Travel Intent / Passenger Fixed Request
- Carpool Journey / Outstation Request / Outstation Quote / Raahi Trip Offering
- Mobility Commitment / Ride / Booking / Ride Event
- Payment Acknowledgement
- Reliability Event / Case / Reason Code
- Business / Local Offer
- Notification / Admin Audit / Rule Configuration

Every important object has a stable immutable ID. Material historical terms are snapshotted rather than re-read from mutable configuration.

## 9. Commitment ledger

Raahi must maintain one cross-service **Mobility Commitment** authority for Driver and Vehicle time conflicts.

A Driver/Vehicle cannot hold overlapping incompatible commitments across Fixed, Round Trip, Outstation, Carpool or Raahi Trips.

The commitment check is server-side and atomic at the point a marketplace action becomes binding.

The first valid atomic commitment wins. A stale client cannot override a newer commitment.

Configuration may define buffers around journeys where operational reality requires them.

## 10. Fixed One Way marketplace

Passenger enters the Product passenger queue independently of Driver supply. Driver enters the Product driver queue independently of Passenger identities.
Pre-match visibility is aggregate liquidity, not identities. Passenger does not browse a Fixed Driver; Driver does not browse Passenger identities.

Initial clearing policy is `FULL_CAPACITY` based on bookable passenger capacity unless Product configuration intentionally specifies another approved policy.

Passenger group requests are atomic. Compatibility batching respects Passenger FIFO while allowing requests that fit the available Vehicle. Starvation protection becomes deterministic policy rather than UI discretion.

Driver FIFO is per Product. Joining another Product creates a separate eligibility decision but cannot create impossible simultaneous commitments.

Matching atomically reserves/removes compatible queue entries, creates Ride/Bookings/Commitment, snapshots fare/terms and reveals the relationship.

Post-match Driver receives an operational Proceed/Acknowledge instruction, not a fresh commercial Accept/Reject choice.

## 11. Fixed Round Trip

Fixed Round Trip is a separate Service Product and separate Passenger/Driver pool from One Way.

A successful match reserves the same Driver, Vehicle and passenger capacity for outbound, destination wait and return.

Outbound arrival does not complete the Ride. Return seats cannot be silently resold during the wait.

Round Trip origin eligibility follows Current Operating Market, not Home Market. Once committed, the Driver/Vehicle remains locked through the return completion window.

## 12. Outstation

Passenger owns the request. System determines eligible Driver audience from Operating Market/service preferences/verification/Vehicle/availability. Drivers own private quotes; Passenger owns final selection.
Quotes are private from competing Drivers and versioned. Acceptance rechecks current quote revision, expiry, Driver/Vehicle eligibility and cross-service conflicts atomically.

An accepted Driver cancellation reopens the original Passenger request under explicit recovery rules; old quotes never silently reactivate.

## 13. Carpool

Carpool begins from a Driver's independent journey, not passenger demand. Driver publishes origin, destination, departure, spare capacity and contribution.

Eligible Passenger booking is atomic and does not require ordinary V1 Driver cherry-picking approval.

Material time/destination changes after booking require Passenger re-consent or penalty-free exit under the configured rule.

## 14. Raahi Trips / Explore

A Driver creates a planned shared leisure/day-trip opportunity. Product is primarily transport plus wait/return, not an automatically bundled tour package.

Listing may define seats, per-seat price, minimum confirmation threshold and confirmation deadline.

Before threshold, bookings are `FILLING`, not falsely confirmed. Reaching threshold before deadline confirms the Trip and creates the required Driver/Vehicle commitment.

Once confirmed, later passenger cancellations do not automatically unconfirm the Trip.

## 15. Fulfilment and trust reveal

After commitment, services converge into a common fulfilment model where practical: Upcoming â†’ Driver En Route â†’ Arrival â†’ Boarding â†’ In Progress â†’ Completed, with product-specific legs/states layered explicitly.
Identity/trust reveal is progressive. Fixed Route reveals Driver/Vehicle identity after assignment. Outstation reveals quote-appropriate trust before selection but protects phone/exact private pickup until commitment. Raw DL/RC are never Passenger documents.

Operational live location is collected only when needed. `Arrived` requires Product-defined proximity/location evidence before boarding timers begin.

## 16. Payment

Raahi initially facilitates and records the transaction but does not hold passenger money. Passenger pays Driver directly.

Authoritative fare comes from the Product fare, accepted Outstation quote, published Carpool contribution or published Raahi Trip price as appropriate.

Payment state is separate from Ride state:
`DUE â†’ PASSENGER_MARKED_PAID â†’ DRIVER_CONFIRMED_RECEIVED`, with `PAYMENT_DISPUTED` as a separate factual branch.

A Ride may be COMPLETED while payment remains DUE. Raahi must never claim bank/payment-provider success merely because a user declared payment.

## 17. Support, reliability and safety

Reporting an issue creates a Case linked to the relevant Ride/Booking/Quote/Payment/Verification/Account/Offer. It does not silently mutate those source objects.

Reliability is evidence-first: factual events plus reason codes. Public star ratings are not the initial enforcement mechanism.

Safety can override ordinary optimization, timers and penalties. Precautionary restriction is distinct from a finding of guilt.

Admin corrects consequences through audited actions; Admin does not rewrite facts.
## 18. Administration and operating hierarchy

Admin authority is `Permission + Scope`, not one global `admin` boolean.

Target scopes include Platform, State and Market. Target permission families include Market Operations, Support, Trust & Safety, Verification, Route/Product Management, Local Commerce and Platform Administration.

Examples:
- Market Manager â€” Gomoh only
- Market Manager â€” Dhanbad only
- Jharkhand Operations â€” all Jharkhand Markets
- Verification Operator â€” approved verification scope
- Trust & Safety â€” case/enforcement scope
- Platform Admin â€” exceptional national/system authority

The Origin Market owns operational journey health. A Driver's Home Market owns primary Driver relationship/governance. Serious cross-market matters escalate to State/Trust & Safety according to policy.

Admin is never routine dispatcher. Admin cannot choose preferred Fixed Driver, reorder passenger demand for commercial reasons, alter private quote competition, fabricate payment, or create GPS truth.

## 19. Market dashboard

Every active Market should answer two questions:
1. Is the Market working right now?
2. Is the Market becoming a sustainable business?

Operational metrics include travel intents, served demand, active supply, match time, fill rate, completion, cancellations, no-shows, safety/support exceptions, GPS/system anomalies and unserved demand.
Business metrics include active Passengers/Drivers, repeat journey rate, completed journeys, demand success rate, Local Offers revenue, operating cost, retention, Driver activation, Market contribution and route/product economics where measurable.

Company-level north-star candidates:
- Successful Journeys per Active Market per Week
- Demand Success Rate
- Repeat Journey Rate
- Time to Liquidity for a new Market

Registered-user count is not a sufficient north-star metric.

Market dashboards may surface factual success stories such as milestone journeys, successful new Product launches, strong completion rates or Driver activation. Personal stories require appropriate consent/privacy.

## 20. Local Offers and monetization boundary

Local Offers may be Market- and journey-context aware, but commercial placement never changes mobility allocation, FIFO, eligibility, quote selection, verification or safety.

Businesses buy visibility, not named traveller data. Merchant analytics are aggregate unless a future explicit user-consent product says otherwise.

Early Raahi monetization should not damage marketplace density or trust merely to extract transport commission prematurely.

## 21. Platform stability rules

- Server state is authoritative; screens and notifications reflect state.
- Important commands are idempotent.
- Marketplace commitments and matching are atomic.
- Every material transition is legal-state guarded.
- Stale clients/notifications resolve to current server truth.
- Historical facts and agreed terms are preserved.
- Material Admin actions are audited.
- Configuration is data-driven and versioned where historical meaning matters.
- Market/Product feature switches permit controlled canary rollout.
- One Product cannot accept Legacy and V2 creation flows simultaneously.
- Monitoring must expose stuck states, matcher failures, notification failures, GPS anomalies and unresolved operational exceptions.
- System outages must not unfairly destroy FIFO/reliability evidence.

## 22. Scaling architecture

The product must be capable of launching another Market mostly through configuration and onboarding, not new application code.

A future `Launch Market` operating workflow should configure Locations, initial Corridors, Products, fares/rules, Admin scopes, Driver onboarding, Local Offers area, pilot dates and success thresholds.

Cross-Market Driver mobility is handled through Current Operating Market rather than cloning Driver accounts or permanently reassigning Home Market.

Market boundaries are operational cells, not walls. Network effects increase as neighbouring Markets share legitimately present supply and connected demand.

## 23. Experience standard

Raahi must be understandable without training, trustworthy at commitment, calm during fulfilment and useful even before a user urgently needs transport.

Passenger product should answer `Where can Raahi help me go?` and Explore should answer `Where could I go?`.

Driver product should reveal useful local demand and opportunities without becoming an opaque dispatcher.

Premium means exceptional hierarchy, language, typography, spacing, states, maps, trust presentation, motion and low cognitive frictionâ€”not ornamental complexity.

Investor readiness must arise from the real product: one coherent Passenger marketplace, Driver demand network, local operations system, trust infrastructure and repeatable Market expansion model.
## 24. Implementation doctrine

Existing code is reused only when it helps the target architecture without compromising product quality, scalability or safety.

Preferred sequence:
1. Freeze company/product architecture and UML.
2. Freeze premium Experience North Star.
3. Build shared kernel: capabilities, Markets/scopes, Products, Operating Market, commitments, events, payments and cases.
4. Build one complete Fixed One Way vertical slice.
5. Add Fixed Round Trip.
6. Integrate/extend Outstation into common commitments/fulfilment.
7. Add Carpool.
8. Add Raahi Trips / Explore.
9. Complete Market intelligence, Local Offers and growth systems.
10. Expand Market-by-Market using a repeatable operating playbook.

No broad UI migration should dictate the domain model. No domain implementation is complete merely because a screen renders.

Every slice requires business-rule contracts, concurrency tests where applicable, security authorization, TypeScript/build, focused browser E2E, neighbouring-flow regression and real-user/manual acceptance when operationally significant.

## 25. Architecture change governance

This v1.0 freeze may be changed only through an explicit Architecture Decision Record or an appended dated Decision Log entry that states what changed, why, affected UML/state machines, migration impact and acceptance impact.

Implementation discoveries do not silently redefine business rules.

The current legacy Master Architecture remains accurate evidence for the existing engine. For the new marketplace target, this Freeze plus `RAAHI_2_0_UML_FREEZE_V1.md` takes precedence over legacy design statements that conflict with it.

## 14. Passenger origin and location rule — frozen addendum

Passenger location is a journey-planning input, not an operating authorization boundary.

- A Passenger may freely choose any active origin Market/Location while browsing or planning.
- GPS may offer `Use my current location`, but browsing/search is not locked to physical presence.
- A Passenger physically in Gomoh may legitimately explore Dhanbad → Ranchi or another future journey.
- Immediate products may validate pickup feasibility at booking/boarding where operationally necessary.
- Passenger location choice never changes identity, capability, Home Market, priority, or marketplace standing.

Canonical distinction:

**Passengers can explore mobility from anywhere. Drivers can supply mobility only from where they are genuinely operating.**
