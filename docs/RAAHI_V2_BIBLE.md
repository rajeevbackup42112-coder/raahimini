# Raahi Mini V2 Bible

## Purpose
Raahi Mini V2 should not become a bloated transport app. It should become a more human, trustworthy, intelligent and operationally strong local mobility service.

The V2 design rule is:

**Every feature must strengthen at least one of these: trust, certainty, driver economics, ease of use, or sustainable operations.**

V1 remains the proven operational baseline. V2 is an evolution, not a rewrite of the core business model unless a specific rule is intentionally changed and tested.

---

## 1. Core Product Direction

Raahi V2 should feel less like software the user operates and more like a service that quietly guides the journey.

Primary outcomes:
- passengers understand what is happening without learning internal system terminology;
- drivers see clear economics, demand and next actions;
- admin sees exceptions and route health rather than raw tables;
- families can follow a loved one's trip;
- no-driver situations become demand signals instead of dead ends;
- the app remains lightweight, local and inexpensive to run.

---

## 2. Identity, Login and Profile

### 2.1 One login entry point
There should be one public login button for Passenger, Driver and Admin.

After authentication, Raahi determines the trusted role and routes automatically.

No separate Driver Login or Admin Login should be exposed in normal public UI.

### 2.2 Show who is logged in
Once authenticated, the header/profile area should clearly show the user's Raahi display name, for example:
- Hi, Rajeev
- Rajeev ▾

The login button should disappear after login and become a profile/menu entry.

### 2.3 Preferred display name / nickname
Google account name must not be assumed to be the user's preferred public name.

Profile should support a field such as:
**What should Raahi call you?**

Internally distinguish:
- Google/auth account name;
- trusted/legal identity if ever required;
- Raahi display name / nickname.

Normal user-facing screens should primarily use the Raahi display name.

### 2.4 Profile menu
Keep it shallow and simple:
- Display name
- Phone
- Preferred pickup point
- Role label
- Support
- Logout
- Language preference later if needed

### 2.5 Progressive profile completion
Browsing stays frictionless. Ask for additional profile information only when required for booking, driving or a trusted role.

---

## 3. UI and Visual Direction

### 3.1 Visual philosophy
Raahi V2 should look like a modern local mobility service, not a database dashboard, banking app or government portal.

### 3.2 Green brand direction
Use a stronger green identity while keeping screens light and calm.

Recommended design system:
- Primary brand green: headers, main CTAs, route highlights, active states
- Warm off-white / very light background: main page surfaces
- Soft secondary green: availability, success, live trip progress
- Amber/orange: caution, expiring hold, limited availability
- Red: destructive actions and errors only

Do not make the entire app dark green or visually heavy.

### 3.3 One obvious next action
Every screen should answer:
**What should I do now?**

Primary actions must be large, clear and context-sensitive.

### 3.4 Plain-language status copy
Avoid internal wording such as active collector, queue state, request lifecycle.

Prefer:
- Your seat is confirmed
- 1 more passenger needed
- Driver is ready
- Trip has started
- Your seat is reserved for 4:32
- Waiting for driver confirmation
- Location temporarily unavailable

### 3.5 Loading and empty states
Use stable skeleton/loading states rather than flicker.

Empty states should explain what is happening and what the user can do next.

---

## 4. Passenger Home and My Raahi

The passenger home should be action-oriented.

Primary live card should show:
- Route
- Current car
- Seats filled / seats left
- Fare
- Pickup point
- Departure confidence / likely wait
- One clear Book Seat button

### 4.1 My Raahi
For repeat users, show a compact personal area:
- greeting by display name
- current booking if any
- usual/recent route
- last trip
- Book Again
- favourite pickup point

Remember common choices without auto-booking.

### 4.2 Route health
Simple passenger-facing route state:
- Good availability
- Limited availability
- No driver yet

---

## 5. Seat Booking and Status Experience

Keep BookMyShow-style seat selection, but simplify the screen.

Show only what matters:
- vehicle seat layout
- occupied seats
- selected seats
- fare total
- hold countdown when relevant
- one clear confirmation action

Seat states must be visually distinct and consistent:
- Available
- Selected
- Held
- Confirmed
- Unavailable

### 5.1 Unified trip/status card
Use one consistent trip card design across:
- passenger
- driver
- admin
- loved-one tracking

The core route/status presentation stays consistent; role-specific actions differ.

### 5.2 Journey progress
Passenger status should visually show:
**Seat held → Driver confirmed → Ready to depart → Trip started → Destination**

Once a live booking exists, it should become the centre of the passenger experience.

---

## 6. Driver Experience

Driver home should revolve around one operational card.

Example:
**Gomoh → Dhanbad**
**3 / 4 seats filled**
**₹450 expected**
**1 seat remaining**
**Next action: Wait for passenger**

Actions should evolve naturally:
- Go Available
- Wait / Collecting
- Confirm passengers
- Start Trip
- Next Stop
- Complete Trip

Drivers should not need to navigate several screens while operating a trip.

### 6.1 Driver daily summary
Show:
- trips completed
- passengers carried
- approximate earnings collected
- fill time
- empty-return percentage
- missed/unserved demand if useful

---

## 7. Directional Dispatch and Return-Trip Intelligence

Raahi operates each one-way direction as its own FIFO pipeline.

### 7.1 Canonical dispatch rule
For Gomoh → Dhanbad, Driver 1 collects passengers. When Driver 1 presses **Start Trip**, Driver 1 becomes `IN_PROGRESS` and the next FIFO driver for Gomoh → Dhanbad immediately becomes `ACTIVE_COLLECTING` for the next car, if one is waiting. Driver 2 does not wait for Driver 1 to reach Dhanbad or complete a round trip.

Dhanbad → Gomoh operates independently under exactly the same rule. An in-progress car in one direction must never block collection in the other direction.

Hard invariant: only one `ACTIVE_COLLECTING` driver exists per one-way route at a time; FIFO within that route remains strict.

### 7.2 Return-demand signal
Do not show reverse-demand strength on Driver Home before departure. After **Start Trip**, Raahi may show only a coarse reverse-direction signal: **Low / Medium / High**.

Example: **Return demand after arrival · Dhanbad → Gomoh: Medium**

This is current guidance, not a promise, and may change before arrival. Exact reverse passenger counts are not required in the driver-facing signal. Backend/Admin may retain richer reverse-demand data for planning.

Hard invariant: return demand is advisory only. It must never alter FIFO, queue position, driver activation, seat allocation, fare, booking, or trip lifecycle.

---

## 8. No Driver Available: Demand Activation

No-driver state must not be a dead end.

Passenger view should show a friendly message such as:
**No driver is available right now. We're checking with Raahi drivers. Stay here — we'll update you if someone comes online.**

Provide a simple action:
**I need a ride**

This creates lightweight demand intent, not a seat booking.

### 8.1 Demand aggregation
Aggregate by route and urgency, for example:
- 1 passenger waiting
- 3 passengers waiting
- 4+ passengers waiting; likely immediate fill

Passenger may optionally indicate:
**I can wait up to 30 minutes**

### 8.2 Driver notification
Notify relevant eligible drivers, not every driver indiscriminately.

Example:
**3 passengers are looking for Gomoh → Dhanbad. Go available?**

One action:
**Go Available**

### 8.3 Admin notification
Admin should see unserved demand and route gaps.

### 8.4 Anti-spam rules
- batch alerts;
- rate-limit repeated notifications;
- stop alerts once supply appears;
- escalate only when demand grows or urgency changes.

Flow:
**Passenger demand → driver alert → driver available → car opens → passenger notified → booking begins**

---

## 9. Scheduled Travel Intent

Allow lightweight advance intent without forcing full advance reservation.

Example:
**I may travel tomorrow between 8–9 AM.**

Use this for:
- driver planning
- route demand forecasting
- later reminder to confirm when a suitable car becomes available

Do not auto-book without explicit confirmation.

---

## 10. Live GPS Tracking

At V2 scale, live GPS should be added for active trips only.

### 10.1 Driver rule
A driver cannot start a trip unless:
- location permission is enabled;
- Raahi can obtain a usable location fix.

Message:
**Turn on location to start this trip. Raahi uses your location only while the trip is active.**

Location is not mandatory merely to log in, choose a route or wait in queue.

### 10.2 Tracking behavior
- track only active-trip vehicles;
- roughly 10–20 second updates while moving;
- slower updates when stationary if practical;
- stop automatically on trip completion;
- retain only necessary latest location plus limited breadcrumb history for support/safety if needed;
- gracefully fall back to route/stop progress if GPS or network temporarily fails.

### 10.3 Privacy principle
**Raahi does not track drivers all day. Location is used only during an active trip.**

---

## 11. Share My Raahi / Loved-One Tracking

Passenger can share a secure trip link with a family member or loved one.

Recipient should not need a Raahi account merely to follow the trip.

Shared view can show:
- passenger display name
- driver display name
- vehicle model
- number plate
- route
- pickup point
- live GPS position when available
- route/stop progress
- estimated arrival
- trip start time
- destination reached state

### 11.1 Privacy/security
- link is scoped to one trip;
- expires automatically after trip completion;
- passenger can revoke it;
- no phone numbers exposed;
- no booking history exposed;
- recipient has read-only access.

### 11.2 Loved-one notifications
Optional:
- Notify me when trip starts
- Notify me when they reach destination

---

## 12. Family / Multi-Seat Travel

Allow one passenger to book multiple seats under one booking.

Optional labels such as:
- Me
- Wife
- Child
- Parent

Do not force a separate Raahi account for every accompanying family member.

---

## 13. Trust and Fare Transparency

Raahi should make the zero-platform-fee model explicit.

Recommended passenger message:
**Raahi is free to use. We do not charge passengers or drivers any platform fee. Pay only the fare shown in the app.**

Recommended driver message:
**Raahi does not charge you commission or an app fee. Please collect only the fare shown in Raahi.**

Trust promise:
**No commission. No booking fee. No hidden app charge. One clear fare.**

Show this appropriately on:
- home screen
- booking confirmation/live trip card
- driver fare view

Add a simple support reason:
**Driver asked for extra money / Fare issue**

---

## 14. Driver and Passenger Trust Cards

### Driver card for passengers
Show compact trusted details:
- display name
- optional photo
- vehicle model
- plate number
- Raahi driver since… if useful

Do not rush into a complex ratings economy unless operational need is proven.

### Passenger list for drivers
Show:
- display name / nickname
- seats booked
- pickup point
- confirmation state

No unnecessary personal information.

---

## 15. Quick Actions and Support

Critical actions should never be hidden in deep menus.

Passenger live card:
- Call Driver
- Cancel Seat
- Share My Raahi
- Need Help?

Driver live card:
- Call Passenger
- Mark No-show
- Start Trip
- Next Stop
- Complete Trip

Support should include structured categories such as:
- Fare issue
- Wrong driver / wrong vehicle
- Driver asked for extra money
- Passenger no-show
- Unsafe behaviour
- Booking problem
- Other

---

## 16. Notifications

Use notifications to reduce uncertainty, not create noise.

Examples:
- Your driver is almost ready
- Only 1 seat left
- Your seat is confirmed
- Trip has started
- A driver is now available
- Your loved one's trip has begun
- Your loved one has reached Dhanbad

Rate-limit and batch where possible.

---

## 17. Local Promotions / Sustainable Funding

Create a dedicated **Local Offers** area.

Examples:
- Seema Dresses — 50% off today
- Local clinic — free health camp Sunday
- Local restaurant — evening offer

Explain transparently:
**Local promotions help Raahi cover its operating costs and keep the service free for passengers and drivers.**

### 17.1 Promotion rules
- clearly label Sponsored / Local Promotion;
- few cards at a time;
- no pop-ups during booking or live trip;
- location/route targeting where appropriate;
- scheduled start and end dates;
- auto-expire offers;
- admin control;
- no interference with safety or core ride actions.

Possible simple commercial model later:
- daily promotion
- weekly promotion
- featured placement

Avoid complex ad auctions in V2.

---

## 18. Help Shape Raahi / Idea Validation

Create a lightweight user-voting area for future ideas.

Examples:
- Would you use a ladies-only car option?
- Would you book an outstation Raahi?
- Would you like scheduled rides?
- Would you pay slightly more for guaranteed departure time?
- Would you use school/college commute groups?

Response pattern:
**Yes / Maybe / No**

Optional short comment:
**Tell us why**

### 18.1 Contextual questions
Raahi may occasionally ask one relevant question after a trip or in an appropriate context rather than displaying long surveys.

### 18.2 Admin analytics
Show:
- vote counts
- Yes/Maybe/No split
- route/location split
- passenger vs driver split
- comments/themes

Do not overstate popularity when the response sample is tiny.

---

## 19. Admin Operations Experience

Admin home should answer:
**Is Raahi operating normally right now?**

Prefer route/operations cards over table-first UI.

For each route show:
- active car
- next driver
- seats filled
- waiting demand
- average/current fill time
- trip state
- exceptions

### 19.1 Exception inbox
Surface only things requiring attention:
- driver cancelled
- car stuck filling too long
- no driver with passenger demand
- passenger dispute
- no-show issue
- location unavailable for active trip
- route paused

Tables remain available under detailed/admin views, not as the primary operational interface.

---

## 20. Raahi Insights

V2 should collect enough product analytics to guide V3.

Useful metrics:
- searches with no booking
- no-driver events
- passenger demand without supply
- average car fill time
- cancellation rate
- no-show rate
- average seats/trip
- return-trip fill rate
- empty-return rate
- driver utilization
- time-of-day demand peaks
- route direction imbalance
- notification conversion to driver availability
- idea-voting results
- local promotion performance if introduced

Use analytics to improve operations, not to create unnecessary tracking of individuals.

---

## 21. Demand Heat / Time-of-Day Intelligence

Admin and drivers should eventually see simple demand patterns, for example:
- Gomoh → Dhanbad peak: 7:30–9:30 AM
- Dhanbad → Gomoh peak: 5:00–7:00 PM

Keep it understandable; a simple time-band view is preferable to an overcomplicated analytics dashboard.

---

## 22. Architecture and Release Improvements

V2 must be easier and safer to change than V1.

Preferred principles:
- PostgreSQL remains authoritative operational state;
- frontend remains thin;
- one canonical backend command per business transition;
- UI never directly mutates core operational tables;
- Realtime is used as invalidation/refetch rather than becoming a second source of truth;
- database invariant tests run automatically;
- full passenger/driver/admin journey tests are automated;
- staging and production environments are explicitly separated;
- preferably separate Supabase projects when practical;
- GitHub remains canonical source code;
- one deployment path only;
- no manual hosting-side source edits;
- every known-good release is tagged;
- rollback must be deterministic.

Suggested permanent docs:
- PRODUCT_RULES.md
- ARCHITECTURE.md
- DATABASE_INVARIANTS.md
- RPC_CONTRACTS.md
- AUTH_AND_ROLES.md
- TEST_MATRIX.md
- RELEASE_CHECKLIST.md

---

## 23. Features Not to Rush

Do not add complexity merely because it is technically possible.

Avoid rushing into:
- wallet systems
- mandatory online payments
- surge pricing
- complex ratings/reputation scoring
- large marketplace behavior
- heavy ad systems
- AI-controlled opaque dispatch
- excessive animations
- unnecessary APIs

Add only when demand and business value are proven.

---

## 24. V2 Priority Order

Recommended implementation sequence:

1. UI/identity cleanup: one login, display name, profile, consistent green design
2. Passenger/driver unified live trip cards and clearer status language
3. No-driver demand activation and driver/admin notifications
4. Directional pipelined dispatch and post-start return-demand intelligence
5. Live GPS for active trips only
6. Share My Raahi / loved-one tracking
7. Admin operations board and exception inbox
8. Driver daily economics/summary
9. Scheduled travel intent and demand forecasting
10. Local promotions with transparent funding message
11. Help Shape Raahi / idea voting
12. Raahi Insights analytics
13. deeper convenience features and refinements

---

## 25. V2 Success Standard

Raahi V2 should succeed if:
- passengers always understand the next step;
- drivers understand current-trip economics and receive return-demand guidance only after departure;
- families can confidently follow active trips;
- no-driver demand is captured and activated;
- fare/platform-fee expectations are transparent;
- admin spends less time interpreting system state;
- the app remains fast, lightweight and inexpensive;
- releases become safer, repeatable and reversible;
- real user behavior tells us what V3 should be.

## Final Product Principle

**Raahi V2 should not feel bigger. It should feel smarter, warmer, safer and more certain.**

---

## 26. Operating Model and Handover Continuity

Raahi V2 is being driven without Codex credits. The working assistant is expected to wear two hats:
- **Project Owner / Manager:** protect the product vision, prioritize work, maintain release gates, identify risks, keep the Bible current, and decide the next best action within approved boundaries.
- **Implementer / Builder:** inspect code, write migrations and UI changes, add tests/contracts, run validation, diagnose defects, and maintain documentation.

Do not assume a separate coding agent will complete implementation work. The assistant should take work end-to-end whenever it can do so securely. Escalate to the user only for decisions or actions that truly require explicit approval, credentials, billing, production impact, or a business/product choice that cannot be inferred safely.

Continuity rule: before ending a long chat or at any major checkpoint, update this Bible and release-readiness/handover material with the current branch/head, what is green, what is pending, known risks, and the single next action.

Real-world standard: optimize for a Raahi V2 that is understandable to passengers, economically sensible for drivers, low-touch for Admin, operationally safe, privacy-conscious, resilient to real connectivity/device conditions, and straightforward to support and roll back.


---

## 27. Canonical Release-State Snapshot — 2026-08-23

Raahi 2.0 is now in **pre-RC1 hardening**. The major launch experience is built; the primary remaining work is acceptance, clean-room replay, staging and rollback proof.

Validated implementation checkpoint: `636ce21` on branch `v2.0-beta1`.
PR #68 remains **draft, open and unmerged**.
Validate Raahi Mini #299 is **SUCCESS**.

### 27.1 Launch capabilities now materially built/proven

- unified login, role routing, display identity and progressive profile;
- action-first Passenger / Driver / Admin V2 experience;
- exact numbered seat selection backed by PostgreSQL seat ownership;
- no-driver demand intent, aggregation and recovery without auto-booking;
- driver current-trip economics;
- directional pipelined FIFO dispatch with Start Trip as handoff;
- post-start-only reverse-demand Low/Medium/High signal;
- Admin route health, exceptions and structured support;
- active-trip-only GPS, Start Trip location gate, fallback and terminal cleanup;
- Share My Raahi secure loved-one visibility;
- My Raahi recent-route reuse and Driver Daily Summary;
- current cancellation/no-show/Admin queue invariant hardening;
- isolated V2 Dev, staging-safety/auth/role contracts and RLS/RPC audits.
### 27.2 What remains before production consideration

- headed passenger demand-recovery E2E;
- headed wait-tolerance persistence E2E;
- final responsive authenticated Passenger / Driver / Admin sweep, including post-start return-demand display;
- clean-room migration replay on an isolated disposable RC database;
- guaranteed non-production staging E2E;
- rollback rehearsal on staging;
- explicit user approval for merge and every production action.

These are real gates. Do not convert them to PASS from code review, memory or unit/contract tests alone.

### 27.3 Current product posture

Do not start another broad V2 redesign. The correct strategy is **close the remaining proof/release gaps while preserving the working engine**.

Stretch work such as loved-one push notifications, family labels, extended Insights, Local Offers and idea voting must not delay the launch gates above.

### 27.4 Companion control documents

Future chats must use these together:
- `docs/RAAHI_V2_HANDOVER.md` — exact restart point and single next action;
- `docs/RAAHI_V2_DECISIONS.md` — locked product/engineering decisions;
- `docs/RAAHI_V2_BUILD_MATRIX.md` — status by capability and remaining gates;
- `docs/RAAHI_V2_RELEASE_READINESS.md` — production GO checklist and evidence;
- this Bible — enduring product intent and operating doctrine.

If any of these disagree with code or live V2 Dev state, verify the repository/database and correct the documentation rather than guessing.

---

## 28. Manual-Acceptance Simplification Charter — 2026-08-25

Manual real-user acceptance reopened parts of the UX by exposing friction that automated acceptance did not catch. This section supersedes the earlier instruction in §27.3 not to begin another redesign: a focused simplification pass is now explicitly user-approved, provided the proven booking, seat, FIFO, GPS, role and audit invariants remain intact.

### Passenger doctrine
Passenger screens should answer only: **Do I have a ride? Which car? Where is it? What happens next?** Home should emphasize From → To → Find a Ride. Once a ride exists, the journey becomes the primary experience. Internal states such as HELD, ACTIVE_COLLECTING and FIFO should not be user-facing language. During an active journey, live Driver GPS should render as a real map/vehicle position with freshness or truthful stale-state messaging. Route/stop progress remains the fallback when GPS is unavailable.

### Driver doctrine
Driver screens should answer only: **What do I do next?** The primary Driver surface should expose one dominant next action. Route stops that have no pickup/drop-off action should not require manual progression. Passenger pickup/drop-off stops should drive the visible workflow.

The target workflow is: Join queue → become active → collect assigned passengers → close remaining empty seats/manifest → complete required pickups → automatic transition into travel when GPS is usable → perform drop-offs → automatic completion after the last required drop-off where safely possible. Manual Start Trip/Complete Trip controls remain current behavior only until the backend state machine is deliberately refactored and revalidated.

### Admin doctrine
Admin is where complexity belongs. The target primary navigation is **Dashboard · Users · Routes · Operations**. Admin should be able to understand live system health, inspect registered users, manage roles/driver onboarding, manage route definitions and stop order, and intervene in exceptional operations through audited guarded controls. Route editing must preserve active-trip and historical integrity. Prefer route versioning, archive/deactivate and future-effective publication over destructive rewrites.

### Vehicle configuration and release rule
Driver Onboarding uses controlled vehicle type selection and supports seat capacities 4, 5, 6, 7 and 8. UI and canonical backend validation must remain aligned. Every simplification that changes visible workflow or trip transitions reopens the corresponding acceptance gate; rerun focused regression, neighboring role flows, TypeScript/build/contracts and final manual acceptance before production consideration.
