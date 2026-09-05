# Raahi 2.0 Premium Experience North Star v1.0

**Frozen direction:** 2026-09-05
**Scope:** Passenger, Driver, Market Admin and State Operations experience
**Companions:** `RAAHI_2_0_ARCHITECTURE_FREEZE_V1.md`, `RAAHI_2_0_UML_FREEZE_V1.md`

## 1. Experience thesis

Raahi must not feel like a collection of transport forms. It should make local mobility feel visible, trustworthy, alive and surprisingly easy.

The user should rarely need to understand Raahi's internal service taxonomy. Raahi should understand the journey intent and present useful ways to travel.

Core consumer promise:

**Wherever you need to go, Raahi helps you see what is possible from here.**

Core Driver promise:

**Raahi shows useful demand around where you are operating and lets you choose how you want to serve it.**

Core operator promise:

**Raahi shows whether a Market is healthy, what needs attention, and where the next opportunity is emerging.**
## 2. Product personality

Raahi should feel calm, local, capable and warm. It should never feel like a control panel disguised as a consumer app.

Experience qualities:
- obvious next action;
- premium typography and spacing;
- restrained motion with clear purpose;
- confidence before commitment;
- progressive disclosure instead of dense forms;
- beautiful maps and vehicle imagery where useful;
- plain language rather than lifecycle codes;
- friendly empty states that create a next step;
- local relevance without looking provincial;
- no manipulative urgency, fake scarcity or noisy gamification.

Premium means clarity and trust, not visual excess.

## 3. Information architecture

Passenger navigation target:

**Home · My Rides · Explore · Offers · Profile**

Driver navigation target:

**Drive · Opportunities · My Trips · History · Profile**

Admin navigation target:

**Dashboard · Markets · Operations · Users · Trust & Safety · Businesses**
## 4. Passenger Home — the main Raahi moment

Home begins with a simple question:

**Where do you want to go?**

Primary controls:
- From
- To
- When: Now / Today / Tomorrow / Choose date
- passengers/seats only when relevant

`From` is freely selectable. `Use my current location` is a convenience, never a lock.

Below search, Home should make the local network feel alive without overwhelming the user:

- popular destinations from the selected origin;
- currently useful shared opportunities;
- upcoming trips worth discovering;
- recent/repeat journeys;
- restrained context such as `4 people are looking toward Dhanbad` when trustworthy.

The Home screen should answer both:

**I know where I need to go.**

and

**What can Raahi help me do from here?**
## 5. Search results — Ways to Go

The result screen should not expose five technical tabs. It should answer the journey intent with a ranked set of understandable choices.

Example: Gomoh → Dhanbad

**Shared ride**
₹X per seat · forming now
`3 of 4 seats ready`

**Round trip**
₹Y per seat · return after 4 hours

**Carpool**
Driver already travelling · 2 seats left

**Private car**
Request quotes from verified Drivers

Raahi ranks by relevance to the user's stated journey, not sponsorship. Sponsored Offers never enter this ranking.

If no current supply exists, the screen should transform failure into intent:

**Can't find the right ride? Tell Raahi you want to go.**

The Passenger can create demand or request a private car where appropriate without reaching a dead end.
## 6. Fixed One Way — ride formation

The Passenger does not browse a waiting Driver or pick a car. They join demand for the product.

Pre-commitment screen shows:
- route/product;
- fixed fare per seat;
- requested seats;
- boarding area/point;
- aggregate formation state;
- cancellation freedom before assignment;
- one clear `Join` action.

After joining, the emotional design should make waiting understandable rather than anxious:

**Your ride is forming**

`2 of 4 seats ready`

As compatible demand changes, the state updates calmly. Do not promise a Driver or departure until the matching rule actually clears.

No Driver identity, vehicle identity, phone or exact passenger identities appear before assignment.

When the compatible batch becomes ready, the experience changes decisively:

**Your ride is ready**

Only now does Raahi reveal the committed Driver and vehicle.
## 7. Trust reveal — assignment moment

Assignment should feel reassuring, not merely transactional.

Reveal:
- Driver photo and display name;
- vehicle make/model and registration;
- approved car photos;
- factual badges such as `DL Verified`, `RC Verified`, `Car photos reviewed`;
- boarding point;
- live approach state/map when operationally available;
- contact action only after commitment.

Avoid vague claims such as `100% safe` or `Raahi guaranteed`. Trust copy must describe facts Raahi actually verified.

The main state progression should be human:

**Ride ready → Driver coming → Driver arrived → Boarding → On the way → Arrived**

A persistent ride detail surface owns the journey from assignment through completion. Notifications deep-link back to this surface rather than creating alternate truths.
## 8. Arrival and boarding

The Driver records arrival only when Raahi's location rule permits it. That event starts boarding time.

Passenger view should emphasize:
- `Driver has arrived`;
- exact boarding point;
- remaining boarding time;
- Call Driver / Need Help;
- clear consequence if boarding is missed.

One Passenger no-show must not visually freeze everyone else. If a short canonical refill window is running, compliant passengers should see truthful language such as:

**Raahi is checking for one replacement passenger. Departure will not be held beyond the refill window.**

Boarding mechanics should feel operational, not punitive.

## 9. Fixed Round Trip

Round Trip must look like one commitment with two legs, not two unrelated bookings.

Before joining, show:
- outbound route and fare;
- destination stay duration;
- expected return boarding time;
- same Driver/vehicle commitment;
- same reserved seats for return.

After outbound arrival, the ride screen becomes `Time in Dhanbad` / `Return at ...`, with clear 30-minute and 10-minute return reminders. The ride remains active until return completion.
## 10. Outstation — private car marketplace

Passenger experience begins with a restrained request:
- From / pickup locality;
- destination;
- date/time;
- one way / round trip;
- passenger count;
- optional useful notes.

Then one persistent request screen evolves:

**Request sent → Waiting for quotes → Quotes available → Driver selected → Upcoming → On the way → Completed**

Quote comparison emphasizes:
- total quoted price;
- Driver and vehicle;
- verification indicators;
- car photos;
- what toll/parking terms are included;
- quote validity.

Drivers never see competitor prices. Passenger chooses; Raahi may organize information but does not secretly choose a Driver.

If the selected Driver cancels, the same request becomes visibly `Reopened`. The Passenger should understand that Raahi is finding/re-inviting supply without making them reconstruct the trip from scratch.
## 11. Carpool

Carpool represents a Driver's real journey, not a commercial Fixed queue.

The listing should communicate:
- `Driver is already going`;
- origin/destination;
- departure time;
- Driver/vehicle/trust;
- spare seats;
- per-seat contribution;
- pickup flexibility if supported.

Eligible booking should be instant in V1. Passenger should not wait for subjective Driver approval after choosing a valid open seat.

If the Driver materially changes time or destination after bookings exist, the UI must clearly request Passenger re-consent or offer penalty-free cancellation.

## 12. Explore / Raahi Trips

Explore answers a different question:

**Where could I go?**

This is the repeat-engagement surface that can make Raahi enjoyable even without an urgent transport need.

Cards should foreground destination imagery, origin, date, departure/return, Driver/vehicle trust, per-seat price, seats left and whether the Trip is `Filling`, `Confirmed` or `Full`.
Trip detail must make confirmation risk explicit before booking:

**3 passengers needed to confirm by Saturday 6 PM**

A booking into a filling Trip is not presented as guaranteed. When threshold is reached, the emotional moment becomes:

**Your trip is confirmed**

Once confirmed, later cancellations do not visually push the Trip back into uncertainty.

Raahi Trips initially sell mobility: transport, wait and return. Do not make the first product look like a packaged-tour agency with hotels, guides, meals and tickets mixed into one promise.

## 13. Offers

Offers live in their own destination and may appear contextually where useful, never inside allocation logic.

Experience language:

**Useful around your journey**

Examples may include food, sweets, medicine, travel essentials or destination-local services. Every paid placement is visibly marked `Sponsored` or equivalent.

No pop-up interrupts booking, boarding, GPS, payment, safety or support. A merchant buys attention, never Passenger data or ride priority.
## 14. My Rides

My Rides is service-agnostic. Passengers should not need separate histories for Fixed, Outstation, Carpool and Trips.

Sections:
- Active / needs attention;
- Upcoming;
- Past.

Each card shows the information that defines the commitment: route/destination, date/time, service form, Driver/vehicle when committed, fare and current state.

Past rides support:
- factual payment state;
- Report Issue while eligible;
- Share/receipt-like journey summary where useful;
- `Ride again` as a search shortcut, never an automatic transaction.

## 15. Passenger Profile and mode switching

One identity may possess Passenger and Driver capabilities.

Profile holds personal preferences, verification/contact status, support access and mode switch where Driver capability exists.

Switching to Driver mode changes the workspace, not the identity and never the underlying commitments.

The app should reopen in the last sensible mode, but an active time-sensitive commitment may surface prominently regardless of mode.
## 16. Driver Drive home

Driver mode should feel like a professional local-demand workspace, not a taxi meter.

Top context:

**Driving from Dhanbad**
`Location confirmed`

Driver may change Current Operating Market only through the canonical physical-location verification flow. Home Market remains visible in Profile, not as an obstacle on every screen.

Below, show useful Dhanbad-origin supply choices:

- Fixed One Way products and aggregate demand;
- Fixed Round Trip opportunities;
- Outstation lead count if opted in;
- Driver-created Carpool action;
- Create a Raahi Trip.

Changing Operating Market never joins a queue automatically. Driver explicitly decides what service/product to offer.
## 17. Driver demand visibility

Demand should help a Driver decide without becoming a speculative trading screen.

Useful signals:
- seats currently interested/queued where policy permits;
- `Low / Medium / High` demand where exact counts would mislead;
- own FIFO position after joining;
- number of Drivers already queued where useful;
- fixed fare / expected full-car fare context;
- time/date of the product.

Never show Passenger names, phone numbers or precise private pickup details before commitment.

Never promise earnings. Prefer factual copy such as:

**4 passenger seats currently waiting · 2 Drivers queued**

The Driver can make an informed choice and then tap `Join queue` / `Make me available`.

## 18. Driver Fixed queue

Once queued, the dominant state is simple:

**You're in the Dhanbad → Ranchi queue**

Show own position, aggregate compatible demand, Vehicle, and `Leave queue` before commitment. Do not offer Passenger browsing or selection.
When assigned, the Driver does not receive a commercial `Accept / Reject` choice. Joining FIFO already expressed willingness.

Assignment should switch immediately to:

**Ride assigned — proceed to boarding point**

with one acknowledgement action where required and a clear consequence if ignored.

## 19. Driver active fulfilment

During fulfilment, Driver UI should have one dominant next action at a time:

**Proceed to boarding point**
→ **I've arrived**
→ **Board passengers**
→ **Drive to destination**
→ **Arrived**

Secondary actions such as Call, Breakdown or Need Help remain available but visually subordinate.

The screen should avoid asking Drivers to manage internal state. Raahi validates transitions, timing and GPS in the background and explains only what matters.

For Round Trip, the same surface continues through destination wait and return; it must never look `Completed` after outbound arrival.
## 20. Driver Opportunities

Opportunities is for demand that requires Driver choice rather than FIFO participation.

Primary examples:
- Outstation requests that match the Driver's Operating Market/service preferences;
- future marketplace opportunities that genuinely require a response.

An Outstation lead card should show enough to decide whether to quote:
- origin locality;
- destination;
- departure and return timing;
- Passenger count;
- relevant notes;
- Vehicle eligibility.

Actions:

**Quote** · **Ignore**

Ignoring is consequence-free. Passenger phone/exact private address remain hidden before selection.

## 21. Driver Carpool and Trip creation

Carpool creation begins with `I'm already going somewhere` and keeps the form minimal.

Raahi Trip creation is more deliberate: destination, date, departure/return, vehicle, seats, per-seat price, minimum confirmation threshold and confirmation deadline, followed by a polished preview before publish.
## 22. Driver My Trips and History

My Trips unifies every current commitment regardless of service.

Sections:
- Needs attention;
- Upcoming;
- Active;
- Past.

History can show factual fare value and direct-payment acknowledgement without pretending Raahi holds or settles money.

Useful Driver summary may include:
- completed journeys;
- passengers/seats served;
- fares recorded;
- cancellation/no-show facts;
- service mix;
- home vs other Operating Market activity.

Avoid public star-score gamification in the first product. Reliability evidence belongs in factual operational history and enforcement.

## 23. Direct payment experience

After a ride, Passenger sees:

**Pay your Driver directly · ₹X**

Methods may be Cash / UPI / Other as a declaration only.

Passenger action: `I've paid`.
Driver action after that: `Payment received` or `Payment issue`.
The UI must never say `Payment successful` unless Raahi actually becomes the payment processor in a future product.

Ride may be complete while payment remains due. Payment dispute creates a Case without rewriting the Ride.

## 24. Market Admin Dashboard

The Market Dashboard answers:

**Is this Market healthy right now?**

Example header:

**Raahi Gomoh**
`Active · Jharkhand`

Top operational metrics should include:
- travel intents today;
- successful/assigned/completed journeys;
- demand success rate;
- active and available Drivers;
- median match/wait time;
- cancellations/no-shows;
- unresolved important Cases.

The primary experience is exceptions and opportunities, not a wall of database tables.
## 25. Market Dashboard — opportunities and stories

A second layer answers:

**Where should this Market grow next?**

Show emerging destination/corridor signals such as:

**Gomoh → Ranchi Airport**
43 searches · 19 shared-interest intents · growing
`Review opportunity`

The System surfaces evidence; Market Operations decides whether to evaluate/pilot a product.

The dashboard may also show factual milestones:
- 500 completed journeys;
- new corridor launched from observed demand;
- 90%+ completion week;
- first 25 active Drivers;
- a pilot reaching sustainable fill rate.

Success stories should be generated from verified metrics, never fabricated marketing copy. Personally identifiable stories require appropriate consent.

## 26. Market Operations

Operations is exception-first:
- active/stuck journeys;
- abnormal queue states;
- GPS/notification health;
- Driver cancellation/recovery;
- return-trip failures;
- open payment/support Cases;
- system exceptions.
Admin can inspect factual timelines and use guarded exception commands. Admin must never become the normal dispatcher.

## 27. Market configuration

Market setup/configuration should eventually feel like launching an operating cell, not commissioning custom software.

Configuration surfaces cover:
- Market identity and lifecycle;
- Locations/nodes;
- Corridors;
- Service Products;
- pricing/policy values;
- product activation/canary state;
- Market Admin assignments;
- Local Offers scope;
- notification/pilot configuration.

Structural changes are versioned/future-effective where history or live commitments would otherwise be rewritten.

## 28. State / Platform Operations

Jharkhand Operations should see Markets comparatively rather than drilling into every local transaction by default.

State view answers:
- Which Markets are healthy?
- Which are supply constrained?
- Which have poor demand success?
- Which Markets have unresolved safety/system risk?
- Which emerging Markets/corridors justify investment?
- Where are Drivers operating across Market boundaries?
- Which pilot products are ready to scale, pause or redesign?
State Operations has broader scope but should still inherit the principle: observe normal marketplace operation, intervene on exceptions.

## 29. Trust & Safety workspace

Trust & Safety is separate from normal Market dispatch.

Prioritize:
- critical safety Cases;
- wrong vehicle / identity mismatch;
- serious repeated Driver failures;
- document/verification concerns;
- suspicious marketplace abuse;
- return abandonment;
- escalation requiring broader account restriction.

Every case shows a factual event timeline, evidence access appropriate to permission, current standing and prior relevant events.

Precautionary restriction and final finding are visually and conceptually distinct.

## 30. Businesses / Local Offers operations

Market Commerce operators can manage:
- business identity;
- offer creative/content;
- origin/destination/locality context;
- schedule;
- sponsorship status;
- aggregate impressions/engagement where supported;
- approval/pause/removal.

They cannot access Passenger names, phones, private journey history or mobility ranking controls.
## 31. Notifications

Notifications exist to reduce uncertainty and drive a clear next action.

Priority examples:
- Ride ready / Driver assigned;
- Driver arrived;
- return boarding reminders;
- new Outstation quote;
- selected Outstation Driver cancellation/reopen;
- Raahi Trip confirmed/not confirmed;
- payment declaration/acknowledgement;
- important Case/safety updates.

Informational events should remain in-app or batched where possible.

Every notification opens the exact authoritative object. If the notification is stale, the destination screen shows current server truth rather than replaying the old action.

Promotional notifications require separate preference/consent from operational communications.

## 32. Empty, loading and failure states

A premium Raahi experience treats uncertainty as part of the product.

Never leave a spinner without context for an operationally meaningful wait. Use stable skeletons for short loads and explicit states for longer processes.

Examples:
- `No shared ride is forming yet` → create travel intent / private car option;
- `No quotes yet` → show request is active and quote validity window;
- `Driver location temporarily unavailable` → keep route/state truth and retry;
- `This quote changed` → show latest version before acceptance;
- `You're offline` → make clear which actions require reconnection.
## 33. Visual system

The visual language should be recognizably Raahi without becoming decorative noise.

Principles:
- light, calm backgrounds;
- a strong but restrained Raahi green for primary actions/identity;
- typography strong enough to carry hierarchy without excessive containers;
- rounded surfaces only when they create grouping, not around every line;
- map/photo surfaces edge-to-edge where immersive context helps;
- status colors used semantically and accessibly;
- icons support labels rather than replace important wording;
- motion communicates state transition, not spectacle.

Core reusable components should include:
- journey search field;
- Ways to Go option card;
- liquidity/formation indicator;
- trust card;
- persistent journey timeline;
- driver demand card;
- metric tile with context/trend;
- case/exception card;
- Market opportunity card;
- sponsored offer card.

Design tokens and components should be shared across Passenger/Driver/Admin, with density adapted by role.
## 34. Mobile, accessibility and language

Passenger and Driver are mobile-first and one-handed where practical. Critical actions should not depend on hover, tiny controls or dense tables.

Admin must work responsively but may use wider layouts for comparative operations and configuration.

Accessibility requirements:
- adequate contrast;
- large touch targets;
- meaningful labels for icons/actions;
- status not communicated by color alone;
- text scaling without layout collapse;
- keyboard-accessible Admin workflows;
- reduced-motion respect.

Copy should be designed for later Hindi/local-language support from the start: short sentences, no clever English-dependent wordplay in critical states, and no business rule embedded only in prose strings.

## 35. Privacy as experience

Privacy should be visible through sensible disclosure rather than legal text alone.

Examples:
- queued Fixed Passenger sees liquidity, not Driver identity;
- Driver sees demand, not Passenger identity;
- phone appears after commitment;
- exact Outstation pickup becomes selected-Driver information;
- operational GPS starts/stops for operational purpose;
- raw DL/RC never appears in Passenger surfaces;
- Offers never imply that a merchant knows the Passenger's identity or journey history.
## 36. Market identity without product fragmentation

Customer-facing experiences may say `Raahi Gomoh`, `Raahi Dhanbad` or `Available from Gomoh` where local identity builds relevance.

These are Market contexts inside one Raahi product, not separate applications, deployments or incompatible accounts.

A Passenger may search journeys originating in any active Market. A Driver's Operating Market controls supply eligibility. An Admin's scope controls operational visibility.

If a Passenger searches from a place where Raahi has not launched a Market, Raahi should not pretend full local operations exist. It may:
- record Travel Intent;
- show cross-market/Outstation options that genuinely exist;
- invite notification of future availability;
- explain that Raahi is not yet active there.

This creates an expansion funnel rather than a fake nationwide footprint.

## 37. Experience instrumentation

Each major surface should emit privacy-conscious product events sufficient to answer business questions.

Examples:
- origin/destination search;
- no-result intent;
- Ways-to-Go option viewed/chosen;
- Fixed queue join/cancel/match time;
- Outstation request/quote/selection;
- Explore view/book/confirm;
- Driver Operating Market selection;
- Driver opportunity view/queue join/quote;
- offer impression/engagement;
- support/safety funnel.
Metrics must derive from authoritative facts where possible rather than duplicate client counters.

Experience instrumentation must never become a hidden marketplace ranking input unless explicitly designed and governed.

## 38. Experience quality gates

A screen is not investor/launch quality merely because it is functional.

For each core journey ask:
1. Can a first-time user understand the next action without explanation?
2. Is authoritative state visible without internal terminology?
3. Is trust shown at the moment it matters?
4. Does the screen remain useful when supply/data is missing?
5. Does it work at realistic mobile widths and touch conditions?
6. Does refresh/relogin reconstruct the same transaction truth?
7. Does it avoid exposing information too early?
8. Does it feel like one Raahi design system?
9. Is the experience still coherent if the Market is Dhanbad, Ranchi or another future Market?
10. Would we be comfortable showing this exact live product to an investor and a real customer?

A P0 business-rule failure blocks release regardless of visual polish. A materially confusing core experience also blocks investor/launch-candidate status even if contracts are green.
## 39. Canonical screen inventory

Passenger launch-candidate surfaces:
- Home / origin-destination search;
- Ways to Go;
- Fixed queue formation;
- Fixed assigned/active ride;
- Round Trip ride;
- Outstation request + quote comparison + active ride;
- Carpool discovery/detail;
- Explore + Raahi Trip detail;
- My Rides;
- Offers;
- Profile / mode switch / support.

Driver launch-candidate surfaces:
- Drive / Operating Market;
- Fixed demand/product detail + FIFO;
- active fulfilment;
- Opportunities / Outstation lead + quote;
- Create Carpool;
- Create Raahi Trip;
- My Trips;
- History;
- Profile / verification / preferences.

Market/State operations surfaces:
- Market Dashboard;
- Market opportunity/emerging-corridor detail;
- Operations exceptions;
- Users/Driver relationship;
- verification/Trust & Safety;
- Market/Location/Corridor/Product configuration;
- Businesses/Offers;
- State portfolio dashboard.
## 40. Raahi signature moments

The product should deliberately excel at a small number of memorable moments:

1. **From here, what is possible?** — Home makes local mobility discoverable.
2. **Your ride is forming** — Fixed demand becomes understandable rather than invisible waiting.
3. **Your ride is ready** — committed Driver/vehicle trust is revealed at exactly the right moment.
4. **Driver has arrived** — map, boarding point and timer remove uncertainty.
5. **Driving from Dhanbad** — Driver instantly understands which local demand they can serve now.
6. **Your trip is confirmed** — Explore converts tentative leisure demand into a real shared journey.
7. **A new corridor is emerging** — Market Admin sees demand become a business opportunity.
8. **Raahi works here now** — a newly activated Market uses the same product system without custom code.

These moments should guide visual refinement and demo storytelling, but they must always be backed by real state.

## 41. Implementation consequence

Do not retrofit these screens around legacy `ACTIVE_COLLECTING` assumptions.

Build the marketplace kernel and reusable design system toward this experience. Existing authentication, verification, GPS, route versioning, Outstation, support and other components may be reused when they fit the frozen target cleanly.

First complete vertical slice remains Fixed One Way because it proves Search → demand → Driver supply → atomic matching → trust reveal → fulfilment → payment → support/history.

After the kernel and Fixed One Way slice are proven, extend the same experience language to Round Trip, Outstation, Carpool and Trips rather than creating isolated mini-products.
## 42. Freeze rule

This document is the target experience authority for Raahi 2.0 implementation.

A future screen may refine layout/copy during prototyping, but it must not silently change ownership, privacy, matching, Market, payment, commitment or lifecycle rules frozen in the companion architecture/UML.

If user research or implementation evidence reveals a material flaw, record the discovery, update the affected architecture/experience decision deliberately, and rerun impacted acceptance criteria.

**Canonical experience principle:**

> Raahi should make a complex local mobility marketplace feel simple without hiding or weakening the rules that make it trustworthy.
