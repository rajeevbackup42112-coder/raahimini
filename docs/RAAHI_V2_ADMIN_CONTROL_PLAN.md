# Raahi 2.0 Admin Control Plan

Status: **IN PROGRESS**. V9 Dashboard + Registered Users and V10 guarded Route Management are live. V10 draft isolation and busy-route publish blocking are production-accepted. V11 consolidated Operations is built, validated and its read-only projection is migrated; Rocket V11 deployment/live acceptance remains pending.

## Product principle

Passenger and Driver screens stay intentionally simple. Admin owns operational complexity, but Admin changes must still use audited, invariant-preserving commands rather than raw table edits.

Primary Admin navigation will become:

**Dashboard · Users · Routes · Operations**

Account/Profile remains in the header menu, not as a fifth operational section.

## 1. Dashboard

Purpose: answer **"What is happening in Raahi right now?"** without opening several tabs.

Top summary cards:
- Active trips
- Cars collecting passengers
- Passengers waiting / HELD requests
- Drivers waiting in queue
- Open support cases / operational warnings

Below the summary, show **Live Operations** grouped by route. Each row should show route, driver/vehicle, seats, current journey phase and the same backend-owned next meaningful event used by Driver/Passenger.
### Attention Needed

Only exceptions should demand attention. Planned warning types include stale Driver GPS, unusually old HELD requests, active routes with no collecting car, restricted users involved in live activity, unresolved support cases, and failed/blocked operational actions.

### Recent Activity

Show meaningful audited business events, not raw database logs: Driver onboarded/deactivated, route changed, queue override, trip started/completed/cancelled, user restricted/restored, and Admin-role changes.

## 2. Users

Create a searchable registered-user directory covering Passenger, Driver and Admin accounts. Current `admin_list_role_accounts()` excludes Drivers, so this needs a new guarded read projection rather than repurposing the existing Manage Admins RPC.

Filters: **All · Passengers · Drivers · Admins · Unverified · Restricted**.

Each user row/detail should show:
- display name and Google email
- verified phone state / phone number where permitted
- role and restriction state
- joined date
- current operational state, if any
- Driver/vehicle data when applicable
- recent relevant Admin/audit activity

Sensitive actions live on the user detail page, not directly in the list.
Planned guarded actions:
- onboard eligible Passenger as Driver using the canonical onboarding command
- edit Driver vehicle/profile details through dedicated audited RPCs
- deactivate/reactivate Driver when operationally safe
- restrict/unrestrict account with reason
- grant/revoke Admin under existing role-safety rules

Driver onboarding should therefore move naturally to **Users → person → Make Driver**, while a Dashboard shortcut may still deep-link there.

## 3. Routes

V10 Route Management adds create/duplicate/archive route, add/edit/remove/reorder stops, edit route metadata, fare/active controls, draft preview and explicit Publish.

Structural route changes must **not mutate historical/live route stops in place**. `seat_requests.pickup_stop_id` references `route_stops`, and trips reference the route, so destructive edits can corrupt active/history semantics.

Implementation rule: use an explicit route-version/future-effective model. Active trips keep the exact route/stops they started with; new trips use the newly published version.

Route editor UX:
- ordered stop list with drag handles plus touch-friendly up/down controls
- Add Stop / Edit / Remove actions
- fare and active state in the same route detail
- preview before Publish
- impact warning when a live queue/trip exists
- archive instead of destructive delete once a route/version has operational history
## 4. Operations

Keep emergency tools separate from everyday configuration. V11 Operations consolidates active trips, Driver queues, GPS health, support cases and carefully scoped manual intervention. It is observation-first and adds no new emergency mutation primitive.

Existing safe controls such as Driver deactivation, WAITING-queue reorder/remove, support resolution and route enable/disable remain canonical. Admin must not directly rewrite seat ownership, swap the Driver of an active trip, bypass FIFO, bypass phone verification, or fake GPS state.

Emergency controls should prefer reversible operational states such as temporarily disabling a route/stop for future requests or closing new demand, rather than deleting configuration.

## Delivery order

Admin work should follow the core ride-flow simplification so we do not redesign management around unstable journey semantics:

1. **V6** Passenger/Driver next-state alignment — current candidate.
2. **V7** automatic Start Trip after manifest resolution + usable GPS, preserving FIFO exactly once.
3. **V8** real Passenger Driver-location map and final Passenger simplification.
4. **V9** Admin Dashboard + Registered Users + integrated Driver onboarding.
5. **V10** guarded full Route Management with versioning/future-effective publishing.
6. **V11** consolidated Operations / emergency controls and Admin cleanup.

Every Admin version requires contracts, TypeScript/build, focused Admin acceptance, neighboring Passenger/Driver regression, audit verification and rollback/forward-repair notes before the next production version.