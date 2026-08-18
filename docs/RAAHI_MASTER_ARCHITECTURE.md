# Raahi Mini — Master Architecture Sheet

**Status:** Canonical living architecture reference  
**Authority:** This document defines intended system behaviour. Code, migrations, UI and operational procedures must conform to it.  
**Governance:** Every architecture-affecting change must update this sheet in the same PR. If implementation and this sheet disagree, stop and reconcile before proceeding.

## 1. Product definition

Raahi Mini is a shared-seat micro-transit coordination system. Public users may choose a location, discover connected routes, inspect the current collecting car, seat availability, fare, pickup points, route progress and ETA without signing in. Authentication is required only when a passenger actually requests seats.

Each route has a configured fare per seat. When a car becomes active, that fare is snapshotted onto the trip and remains fixed for that car even if Admin later changes the route fare. Passengers see the trip fare before requesting seats. Payment is made directly to the driver after meeting physically; Raahi does not collect money in V1.

Reliability comes from trusted identity, verified phone for passenger booking, behaviour events, no-show/cancellation history, admin restrictions and auditable operational controls.

Drivers belong to Raahi and a vehicle, not permanently to a route. For every journey the driver selects a current location, sees only routes departing that location, selects a route and joins FIFO. After completion the destination is suggested as the next current location.

## 2. Non-negotiable architecture principles

1. PostgreSQL is the authoritative business state.
2. UI never directly mutates core operational tables.
3. Every business transition occurs through one canonical RPC/command.
4. Supabase Realtime only invalidates/refetches canonical projections; realtime payloads are not state authority.
5. `driver_queue` owns FIFO and journey-specific driver route choice.
6. `trips` owns journey lifecycle and snapshots operational facts that must not change mid-journey, including fare.
7. `seat_requests` owns passenger demand lifecycle.
8. `trip_seats` is the authoritative physical seat ledger.
9. Admin exceptions use explicit audited commands and preserve the same invariants as normal flows.
10. Public clients consume purpose-built projections, not authoritative operational rows.
11. Historical terminal queue records may repeat; uniqueness applies to live state only.
12. Configuration tables are client read-only. Writes require canonical audited admin commands or reviewed migrations.
13. A route-fare change applies to future trips only; an existing trip's snapshotted fare is immutable through normal operations.

## 3. Domain ownership

- `profiles`: trusted identity, one operational role, restriction state.
- `drivers`: driver operational record; no permanent route ownership.
- `vehicles`: actual vehicle and capacity (4/6/8).
- `locations`: service locations/cities.
- `routes`: directed journey, active/inactive availability and configured `fare_per_seat` for future cars.
- `route_locations`: discovery tags connecting a route to relevant locations.
- `route_stops`: fixed ordered pickup path.
- `driver_queue`: journey-specific route choice, FIFO state and rank.
- `trips`: collecting/in-progress/completed/cancelled journey instance, including snapshotted `fare_per_seat`.
- `seat_requests`: passenger HELD/CONFIRMED/terminal request state.
- `trip_seats`: concrete AVAILABLE/HELD/CONFIRMED/DRIVER_CLOSED seat rows.
- `trip_progress`: ordered stop arrivals.
- `behaviour_events`: reliability evidence.
- `audit_log`: immutable operational audit trail.

## 4. Location and route discovery

Browsing is public. The first discovery layer is location/city selection. Selecting a location shows all active routes associated with that location, including both routes leaving it and routes arriving there, grouped in UI as appropriate (for example “Going from Gomoh” and “Coming to Gomoh”).

Driver discovery is stricter: after choosing current location, the driver sees only active routes whose `from_location_id` equals that location. The server validates this again when `join_driver_queue` runs.

Public discovery only exposes an `ACTIVE_COLLECTING` car as the currently bookable car. An `IN_PROGRESS` car is never presented as bookable. Public passenger surfaces expose the configured/snapshotted per-seat fare before the request action.

## 5. Strict operational role model

Every authenticated account has exactly one operational role: `passenger`, `driver`, or `admin`.

- **Passenger:** public discovery plus authenticated seat booking/status. Cannot perform driver/admin operations.
- **Driver:** route selection, FIFO queue, passenger handling and trip operations. Cannot request passenger seats.
- **Admin:** administration only. Cannot request passenger seats or operate a driver journey unless deliberately converted through a trusted administrative process.

There is no user-facing role switcher. Client metadata can never self-promote a user.

### Routing and identity clarity

- Signed-in identity displays trusted display name and role; email is available in the account menu.
- Passenger accounts remain in the passenger experience.
- Active driver accounts automatically route to the driver experience.
- Active admin accounts automatically route to `/admin-panel`.
- Passenger accounts cannot enter protected driver/admin operational routes.
- Driver accounts cannot enter passenger booking operations.
- Admin accounts cannot enter passenger/driver operational flows.

### Sign-in entry rules

- Anonymous passenger browsing has no global login requirement.
- Passenger Google authentication is initiated only when the user actually requests seats.
- Unauthenticated drivers have a dedicated **Driver sign in** entry and `/driver-login` flow.
- First-time driver candidates remain passenger-role until trusted admin onboarding.
- There is no public **Admin sign in** item in passenger navigation.
- The private `/admin-panel` URL may expose a sign-in action for an authorized admin. Successful Google authentication is still accepted only when the server-side profile already has role `admin` and is unrestricted.

## 6. Passenger lifecycle

```mermaid
stateDiagram-v2
    [*] --> AnonymousBrowse
    AnonymousBrowse --> AuthRequired : Request seats
    AuthRequired --> PhoneVerification : Google session exists, verified phone missing
    PhoneVerification --> HELD : phone verified + request_seats
    AuthRequired --> HELD : verified phone already present
    HELD --> CONFIRMED : driver confirms in-person payment
    HELD --> WITHDRAWN : passenger withdraws
    HELD --> EXPIRED : pickup passed / absent at pickup
    HELD --> DRIVER_CANCELLED : collecting car cancelled
    CONFIRMED --> DRIVER_CANCELLED : collecting car cancelled
    CONFIRMED --> COMPLETED : trip completes
```

Passenger rules:

- Supabase Auth `phone_confirmed_at`, not editable profile metadata, is the phone-verification authority.
- `request_seats` rejects non-passenger roles, restricted accounts and accounts without confirmed phone.
- A passenger cannot have more than one HELD/CONFIRMED request on the same trip.
- Multi-seat requests are all-or-nothing.
- Every HELD/CONFIRMED request owns exactly `seat_count` concrete `trip_seats` rows.
- Passenger sees the active trip's fixed fare before requesting.
- Payment is direct to driver after physical meeting.
- CONFIRMED means the driver acknowledged payment in person.
- The driver's amount due for a request is `seat_count × trip.fare_per_seat`.
- Passenger cannot be marked absent before the car reaches the selected pickup stop.
- Driver cancellation after confirmation preserves passenger visibility through `DRIVER_CANCELLED` and refund/rebook guidance.

## 7. Driver queue and journey lifecycle

```mermaid
flowchart TD
    A[Driver chooses current location] --> B[Choose departing route]
    B --> C[join_driver_queue]
    C --> D{Collecting car already exists?}
    D -- No --> E[Activate FIFO head]
    D -- Yes --> F[WAITING]
    E --> G[Create trip + seat ledger + fare snapshot atomically]
    G --> H[ACTIVE_COLLECTING]
    H --> I{Departure invariant satisfied?}
    I -- No --> H
    I -- Yes --> J[start_trip]
    J --> K[IN_PROGRESS]
    J --> L[Activate next WAITING driver]
    K --> M[ordered stops]
    M --> N[COMPLETED]
```

Queue invariants:

- At most one `ACTIVE_COLLECTING` queue entry per route.
- At most one live queue entry (`WAITING` or `ACTIVE_COLLECTING`) per driver.
- Queue activation is serialized per route.
- Live queue position is dense and positive; history does not participate in live uniqueness.
- Starting one trip frees the route to activate the next collecting car while the first car is `IN_PROGRESS`.
- Admin queue remove/reorder commands serialize with normal route operations and preserve FIFO invariants.

Driver/vehicle safeguards:

- Driver must have trusted `profiles.role='driver'`, be unrestricted, have active driver record and active vehicle.
- A driver cannot join another queue while already live elsewhere or while owning an in-progress trip.
- Admin cannot reassign a driver/vehicle while that driver is queued or owns a live trip.
- An active vehicle cannot be shared by another active driver/live trip.

## 8. Trip and seat invariants

Trip lifecycle:

```mermaid
stateDiagram-v2
    [*] --> ACTIVE_COLLECTING
    ACTIVE_COLLECTING --> IN_PROGRESS : start_trip
    ACTIVE_COLLECTING --> CANCELLED : driver_cancel_trip
    IN_PROGRESS --> COMPLETED : complete_trip at final stop
```

Seat lifecycle:

```mermaid
stateDiagram-v2
    AVAILABLE --> HELD : request_seats
    HELD --> CONFIRMED : driver_confirm_payment
    HELD --> AVAILABLE : withdraw / expiry / absent / collecting-car cancellation
    AVAILABLE --> DRIVER_CLOSED : driver_close_empty_seats
```

Hard invariants:

1. `AVAILABLE` and `DRIVER_CLOSED` seats have no `request_id`.
2. `HELD` and `CONFIRMED` seats have a `request_id`.
3. HELD/CONFIRMED request seat counts exactly match owned seat-ledger rows.
4. Trip `confirmed_count`, `held_count` and `driver_closed_count` mirror the ledger.
5. Cancellation/withdrawal/expiry releases exactly the seats owned by that request.
6. Departure requires `held_count = 0` and `confirmed_count + driver_closed_count = capacity`.
7. Driver may intentionally close remaining AVAILABLE seats only after HELD requests are resolved.
8. Trip completion is allowed only from `IN_PROGRESS` at the route final stop.
9. Every trip snapshots a valid route fare at creation; route fare changes cannot alter an existing trip fare.

## 9. Fixed stop progression and ETA model

Stops are deterministic and ordered. Driver progression cannot skip or move backward through canonical RPCs. Booking is permitted only for stops not already passed. Reaching a later stop expires HELD requests for earlier missed pickups. Passenger absence can be recorded only at/after the passenger pickup stop.

Pilot assumptions remain configurable but approximately: Gomoh pickup cluster ~5 minutes total and Dhanbad pickup cluster ~15 minutes total. The UI derives ETA/progress from canonical stop progression rather than requiring GPS in V1.

## 10. Fare and payment model

- `routes.fare_per_seat` is the Admin-controlled fare for future cars on that route.
- At trip creation, `trips.fare_per_seat` is populated from the route by a database trigger.
- The trip fare is the pricing authority for every request on that car.
- Admin fare changes do not alter ACTIVE_COLLECTING or IN_PROGRESS trip fares.
- Public active-car and route projections expose fare so a passenger sees price before requesting.
- Driver active-car projections expose fare and per-request amount due.
- Admin changes fare only through audited `admin_set_route_fare`.
- V1 has no online payment, escrow, platform fee or automated refund. Money moves directly passenger → driver after meeting.

## 11. Cancellation and reliability

A driver may cancel only an `ACTIVE_COLLECTING` trip. Cancellation:

- locks the trip,
- releases HELD seat rows exactly,
- moves CONFIRMED requests to `DRIVER_CANCELLED`,
- cancels the driver queue entry,
- records behaviour/audit events,
- attempts to activate the next waiting driver.

Raahi does not process money/refunds in V1 because payment is direct to the driver. Passenger receives next-car/refund guidance and may report a refund problem for admin review.

V1 reliability is evidence-first, not automatic financial punishment. Behaviour events cover request creation/withdrawal/expiry, confirmed no-show, booking confirmation, driver cancellation before/after confirmation, trip completion and refund complaints.

## 12. Canonical command and projection surface

### Public projections
- `get_active_locations()`
- `get_routes_for_location(location_id)` including configured fare
- `get_public_active_car(route_id)` including snapshotted trip fare
- active-car seat availability, pickup stops and route progress

### Passenger commands/projections
- `request_seats(trip_id, pickup_stop_id, seat_count)`
- `withdraw_seat_request(request_id)`
- `passenger_report_refund_problem(request_id)`
- my active/completed ride status
- driver-cancelled recovery status

### Driver commands/projections
- `get_driver_departing_routes(location_id)`
- `join_driver_queue(route_id, current_location_id)`
- `leave_driver_queue(route_id)`
- driver home/active-car context including trip fare and request amount due
- queue status/rank
- `driver_confirm_payment(request_id)`
- `driver_mark_passenger_absent(request_id)`
- ordered stop progression (`driver_arrive_at_stop` / helper)
- `driver_close_empty_seats(trip_id)`
- `start_trip(trip_id)`
- `complete_trip(trip_id)`
- `driver_cancel_trip(trip_id)`

### Admin commands/projections
- list trusted role accounts
- grant/revoke admin through audited RPCs
- onboard/update trusted driver + vehicle
- deactivate driver safely
- restrict/unrestrict users subject to live-state safeguards
- read active trips and behaviour events
- read/reorder/remove queue entries through invariant-preserving commands
- `admin_set_route_fare(route_id, fare_per_seat)` for future cars
- `admin_set_route_active(route_id, is_active)`; disabling is blocked while the route has a live queue/trip
- other configuration changes only through canonical audited RPCs or reviewed migrations

### Internal-only helpers
FIFO activation, audit recording, behaviour recording, seat-release helpers and fare-snapshot trigger functions are not executable by ordinary anonymous/authenticated clients.

## 13. Admin authority and manual-control boundary

Admin authority requires a trusted, unrestricted `profiles.role='admin'` row. Selecting a login path never grants admin authority.

Admin delegation safeguards:

1. Only an active unrestricted admin can grant/revoke admin role.
2. Only existing passenger accounts can be promoted to admin.
3. Driver accounts cannot simultaneously be admins.
4. Restricted users cannot be promoted.
5. An admin cannot remove their own admin access.
6. The final active admin cannot be removed.
7. Every grant/revoke is audited.

Admin should correct coordination failures through explicit commands, not by manually editing physical truth. Admin must not directly substitute one passenger into another request, rewrite `trip_seats`, replace a driver on an active trip by row editing, or mutate live queue/trip state outside canonical exception commands.

Route controls:

- Admin may set the per-seat fare for future trips.
- Admin may enable a route.
- Admin may disable a route only when it has no live queue or live trip.
- Route fare/availability changes are audited.

Restriction rules:

- Restricted admins have no admin authority.
- Admin restriction cannot target another admin.
- A queued/on-trip driver cannot be restricted until the live operation is safely resolved.

## 14. Database exposure and security boundary

- Core operational tables such as `trips`, `trip_seats` and `driver_queue` are not directly readable by anonymous/authenticated clients as a substitute for projections.
- Configuration tables used for public discovery are read-only to client roles.
- No public/authenticated client has direct INSERT/UPDATE/DELETE/TRUNCATE on public business tables.
- Public SECURITY DEFINER discovery RPCs are intentional and must expose only public projection data.
- Authenticated SECURITY DEFINER RPCs remain callable only where their bodies enforce trusted identity, ownership and/or role authorization.
- RLS and grants are defense in depth; RPC body authorization is required for privileged commands.

## 15. Realtime contract

```mermaid
flowchart LR
    DB[(PostgreSQL)] --> RT[Realtime event]
    RT --> UI[Invalidate query]
    UI --> RPC[Refetch canonical projection]
    RPC --> DB
```

Realtime payloads never become business state by themselves.

## 16. Production acceptance invariants

Before release confidence is claimed, repeated end-to-end tests must show all of the following without manual database correction:

1. Public browse works while signed out.
2. Passenger/driver/admin role routing is mutually exclusive and correct.
3. Driver joins valid departing route and becomes WAITING or ACTIVE_COLLECTING according to FIFO.
4. Public active car becomes visible only when collecting.
5. Passenger sees the fixed trip fare before making a request.
6. Passenger request allocates exact HELD seats.
7. Driver confirmation converts exact seats to CONFIRMED idempotently and driver sees the correct amount due.
8. Withdrawal/expiry/absence release exact HELD seats.
9. Departure cannot happen with HELD seats or unaccounted capacity.
10. Closing stale seats permits departure without corrupting seat counts.
11. Starting a trip activates the next waiting car for the route when applicable.
12. Stop progression is ordered and trip completes only at final stop.
13. Driver cancellation preserves passenger recovery state and next-driver handoff.
14. Repeated journeys by the same driver/route create valid terminal history without uniqueness failures.
15. Admin queue overrides preserve queue/trip/seat invariants and remain auditable.
16. Admin fare changes affect future trips only; current trip fare remains unchanged.
17. Admin cannot disable a route with a live queue or trip.
18. All invariant audit queries return zero violations after each scenario.

## 17. Architecture change governance

Every PR must state one of:

- `Master Sheet impact: none` — implementation-only change with no architecture effect.
- `Master Sheet impact: updated` — lifecycle, ownership, role, command, projection, concurrency or policy changed and this document was updated in the same PR.

Do not redesign Raahi from memory. Read this Master Architecture Sheet first, inspect current migrations/code and live database state, then make the smallest architecture-consistent change.

## 18. Consolidated changelog

### 2026-08-16
- Dynamic journey-specific driver routes replaced permanent driver-route ownership.
- Driver cancellation recovery introduced `DRIVER_CANCELLED` passenger state.
- HELD requests began owning concrete seat-ledger rows.
- Ordered pickup progression and absent-at-pickup guards were enforced.
- Trusted driver onboarding and live FIFO ranks were added.
- Independent GitHub type-check/build validation was established.

### 2026-08-17
- Dedicated driver authentication entry was added without imposing passenger login.
- Admin authentication was introduced for trusted admin accounts.
- Completion became final-stop-only and passenger completed-journey projections were separated from active journeys.
- OAuth request resumption was hardened.
- Admin safety audit identified unsafe grants and queue/admin concurrency gaps.
- Repeated driver terminal history uniqueness defect was identified and fixed in production.

### 2026-08-18 — strict roles and production hardening
- Passenger, driver and admin became mutually exclusive operational roles.
- Drivers/admins are blocked from passenger seat requests at the server boundary.
- Signed-in display name and trusted role are surfaced in account UI.
- Public Admin sign-in navigation was removed; trusted admins auto-route to Admin after authentication, with private Admin Panel sign-in entry retained for operations.
- Audited admin delegation was added with last-admin/self-removal/mixed-role safeguards.
- Direct client mutation privileges were removed from configuration and route-location tables.
- Authoritative operational-table reads were narrowed to canonical projections.
- Restricted admin authority was removed.
- Driver/vehicle reassignment during live operations was blocked.
- Admin queue overrides were serialized with live route operations.
- Repository migrations were reconciled with live Supabase production state.
- Route fares became first-class configuration and are snapshotted onto each trip.
- Passenger and driver projections now expose fixed trip fare; driver requests include amount due.
- Admin gained audited fare and route enable/disable controls with live-state safeguards.

---

**Canonical rule:** Code implements this design; this document defines intended design. If they disagree, stop and reconcile before proceeding.
