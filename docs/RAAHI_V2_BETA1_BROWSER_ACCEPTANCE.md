# Raahi V2 Beta1 — Browser Acceptance Checklist

Run only against a non-production V2 environment with the demand backend installed.

## Passenger: no driver

1. Open route anonymously with no active car.
2. Confirm no-driver state is friendly and route remains browseable.
3. Confirm aggregate demand count is visible when non-zero and exposes no passenger identity.
4. Tap `I need a ride` while signed out.
5. Complete authentication and return to the same route context.
6. Create NOW intent.
7. Confirm waiting state clearly says this is interest, not a reserved seat.
8. Keep screen open and verify route supply is rechecked roughly every 15 seconds.
9. Cancel intent and confirm aggregate count updates.

## Passenger: scheduled interest

1. From no-driver state tap `Plan a ride for later`.
2. Confirm route context is preserved.
3. Confirm default future window is editable.
4. Reject past window.
5. Reject end-before-start window.
6. Save valid future window.
7. Confirm UI says no seat is reserved and no auto-booking occurs.

## Supply appears

1. Create passenger NOW intent.
2. Bring a driver online through the existing FIFO flow.
3. Confirm passenger screen transitions to live car when supply appears.
4. Confirm passenger must explicitly tap `Book Seat`.
5. Confirm demand intent did not allocate any seat before booking.

## Driver Home

1. Sign in as eligible driver.
2. Confirm each route can show aggregate outbound demand.
3. Confirm reverse-route/return demand is shown only as advisory context.
4. Confirm queue action remains `Go available` / `Join queue` according to existing state.
5. Verify demand does not change displayed FIFO position.
6. Verify joining a route with lower demand still follows queue rules.

## Admin Home

1. Sign in as admin.
2. Confirm `Unserved demand` shows routes with demand and no active car.
3. Confirm NOW and planned counts are separated.
4. Confirm passenger identity is absent.
5. Confirm admin demand card has no direct operational-table mutation action.

## Regression

- public browsing still works without login
- live car booking still uses existing seat flow
- held/confirmed lifecycle unchanged
- driver start/complete trip unchanged
- route fare display unchanged
- no new direct client writes to operational tables
- no production environment used for Beta1 acceptance
