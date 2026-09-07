# Raahi Next — Slice 11 Acceptance

**Date:** 2026-09-07
**Slice:** Wave 6 / Slice 11 — Raahi Trips / Explore
**Environment:** Raahi Next Dev (`dfgxtooftvtecfcogeiv`), local app port `4029`
**Repository:** `raahi-next`, branch target `raahi-next-clean`

## Frozen product contract

Raahi Trips are Driver-created shared day journeys. They sell mobility only: transport, destination wait and return. Hotels, guides, meals, tickets and other package-tour services are not part of this V1 promise.

Driver creates a deliberate draft and publishes it. Publication alone creates no Ride or Mobility Commitment. Passenger demand below the minimum confirmation threshold is tentative and must remain visibly `FILLING`. The first Passenger booking permanently locks Trip terms and price. Threshold confirmation is atomic and creates one shared `RAAHI_TRIP` commitment and Ride. Once confirmed, later Passenger cancellation must not push the Trip back into Filling.

Passenger identity is private from the Driver before confirmation; Driver sees aggregate Filling demand only. Consumer projections expose verification status only, never raw DL/RC evidence. The common Ride/Booking/Commitment, payment and support kernels remain authoritative.

## Cloud migrations

All 13 Slice 11 migration files were reconciled from live Raahi Next Dev and verified byte-for-byte locally:

1. `20260906230102_slice11_raahi_trip_schema.sql` — MD5 `24c30c768d633aee370c9e88d317d36d`
2. `20260906230819_slice11_raahi_trip_helpers.sql` — MD5 `0132bd81b7abf8cff07e07a4c8021d6d`
3. `20260906231049_slice11_raahi_trip_driver_commands.sql` — MD5 `86ce32d5e9d33e6e2585b070ddb2fb49`
4. `20260907013902_slice11_raahi_trip_threshold_booking.sql` — MD5 `8ac4e783d28699bf88640a9f8737f6af`
5. `20260907013928_slice11_raahi_trip_cancel_expiry.sql` — MD5 `46e28fc5074e1ad83f62d9b5cf84d7e6`
6. `20260907014242_slice11_raahi_trip_pilot_market_lifecycle.sql` — MD5 `68ccf59f7ec8c99cf39c7a0c6315f663`
7. `20260907014437_slice11_raahi_trip_projections.sql` — MD5 `41625748066d3f2092394a5f269e3a3e`
8. `20260907014718_slice11_raahi_trip_outbound_fulfilment.sql` — MD5 `07d1eb7abc7166e30e19c3f968ead2d0`
9. `20260907014810_slice11_raahi_trip_return_fulfilment.sql` — MD5 `cb439c460228278d518e3796734b2231`
10. `20260907015048_slice11_raahi_trip_driver_projection_privacy.sql` — MD5 `8d213d94cb5c6a1602a7a889c54bc529`
11. `20260907020016_slice11_raahi_trip_driver_manifest_projection.sql` — MD5 `5b9203c72de2d6ec12da9801f8bceb16`
12. `20260907032149_slice11_dev_test_driver_operating_market_fixture.sql` — MD5 `b194668cf785dbca6756940e6435d7b8`
13. `20260907033240_slice11_trip_confirmed_booking_bridge_order.sql` — MD5 `88791ac6e9768c21bea2c703ec6e25a8`

No already-live migration was replayed during takeover. Two additional live acceptance fixes were retained and regression-tested: Test Mode Driver provisioning now establishes Current Operating Market = Home Market, and confirmed post-threshold bookings create the circular Trip/Ride Booking bridge in FK-safe insert order.

## Main authenticated acceptance

Synthetic personas:
- Driver: `slice11-driver@raahi.test`
- Passenger A: `slice11-passenger-a@raahi.test`
- Passenger B: `slice11-passenger-b@raahi.test`
- Passenger C: `slice11-passenger-c@raahi.test`
- Passenger D: `slice11-passenger-d@raahi.test`

Main offering: `fcd7a103-03cc-43d0-8d49-10cca5129813`
Shared Ride: `5a49a35c-9a71-4425-997b-d105de4de1dc`
Shared Commitment: `e3ba7d5c-cae2-4598-9911-6873c92ddf4c`
Price: ₹275/seat; offered seats: 4; confirmation threshold: 2.

Driver draft creation returned `DRAFT`. Publish returned `FILLING`. Immediate database truth after publish: 0 booked seats, `ride_id=null`, `commitment_id=null`, 0 Ride rows and 0 RAAHI_TRIP Commitment rows.

Passenger A booked one seat through `/api/trips/book`: `FILLING`, `trip_confirmed=false`, no Ride. A Driver attempt to change price/terms after that first booking returned `409 TRIP_ALREADY_BOOKED`, proving permanent term lock.

Passenger B booked the second seat and crossed the threshold through `/api/trips/book`: `CONFIRMED`, Ride `5a49a35c-9a71-4425-997b-d105de4de1dc`, one shared Commitment `e3ba7d5c-cae2-4598-9911-6873c92ddf4c`, and exactly one SYSTEM `RAAHI_TRIP_CONFIRMED` event. Passenger A's earlier tentative booking was promoted to a confirmed Ride Booking with return status `PENDING`.

### Capacity race

After confirmation, two remaining seats were raced concurrently through the real booking API:
- Passenger D requested 2 seats and succeeded with Trip Booking `2deba848-4dbf-452e-8dc1-72b3b4302e6a`, Ride Booking `3421a34b-7c68-4866-9ff8-12b3a65941c7`, correlation `a911777f-3c42-4775-b2db-9d6fa01ac682`.
- Passenger C lost the same capacity race with `409 TRIP_CAPACITY_UNAVAILABLE`, correlation `db997259-71d2-4004-b560-6edc8c92e26b`.

Canonical truth after the race: one Ride, one Commitment, exactly 4/4 booked seats and exactly one confirmation event.

Passenger B then cancelled before fulfilment. The booking became `CANCELLED`, Trip remained `CONFIRMED`, and both Trip/Ride booked-seat counts reduced from 4 to 3. The confirmation was not reversed.

## Two-leg fulfilment

The same shared Ride was fulfilled entirely through authenticated Trip commands:
- Driver approach → `DRIVER_EN_ROUTE`.
- Fresh Gomoh GPS arrival → `DRIVER_ARRIVED`.
- Boarding started; Passenger A and Passenger D were marked `BOARDED`.
- Outbound departed → `OUTBOUND_IN_PROGRESS`.
- Fresh Dhanbad GPS completion → `WAITING_FOR_RETURN`.

The published return wait rule was first observed. For synthetic Dev acceptance only, `return_not_before` on this one Ride was advanced narrowly after proving the wait state; all return transitions still ran through canonical authenticated APIs.
Return acceptance:
- Return boarding started → `RETURN_BOARDING`.
- Passenger A and Passenger D return manifests → `BOARDED`.
- Return departed → `RETURN_IN_PROGRESS`.
- Fresh Gomoh GPS completion → `COMPLETED`.

Final canonical truth: Trip Offering, shared Ride and Mobility Commitment all `COMPLETED`; Passenger A and D Trip/Ride Bookings `COMPLETED`; Passenger B remains `CANCELLED`.

## Payment and support

Shared payment creation remained database-owned and occurred only after final return completion:
- Passenger A: Payment `300d36c2-2323-4027-ae87-eb20c813cbce`, ₹275 for one seat.
- Passenger D: Payment `3523c402-379e-41f5-ace4-0a2570e57317`, ₹550 for two seats.

Both payments moved through Passenger `MARK_PAID` and Driver `CONFIRM_RECEIVED`, ending `DRIVER_CONFIRMED_RECEIVED`. Support Case `421844b2-690f-471b-b2cb-85cfdd3459fe` was opened on the completed Ride and left Ride/Trip truth `COMPLETED`.

## Exception and privacy acceptance

Missed-threshold fixture `f1c43e96-ca3b-41da-91ba-68bfe7c8c04f` had one tentative seat and no Ride/Commitment. After a narrow synthetic deadline accelerator, the idempotent SYSTEM expiry command returned `NOT_CONFIRMED`, `penalty_free=true`; the booking became `NOT_CONFIRMED`, active seats returned to 0, and no Ride/Commitment was ever created.

Driver-cancel fixture `01402704-478b-4b90-9fa6-fdf4d437464a` was published with no Passenger demand and then cancelled through the Driver API, ending `DRIVER_CANCELLED` with no shared mobility artifact.

Privacy fixture `eb69fffe-97b3-4b4e-add6-2b6c01352d5d` remained `FILLING` with Passenger C's tentative seat. Driver `/drive/trips` rendered aggregate Filling demand while Passenger C's identity was absent. Passenger detail rendered confirmation-risk and verification-status copy with no raw DL/RC document or storage paths.
## Headed browser acceptance

A dedicated visible Chrome profile was exercised through CDP without adding browser automation dependencies to Raahi Next.
- Passenger `/explore`: expected discovery and Filling status rendered; no captured console errors; no Next hydration/runtime overlay.
- Passenger Trip detail: confirmation-risk copy, trust badges and mobility-only scope rendered; no captured console errors; no hydration/runtime overlay.
- Driver `/drive/trips`: creation form, aggregate-only Filling privacy copy, completed two-leg Trip, post-confirmation Passenger manifest, direct-payment acknowledgements and Support entry all rendered; no captured console errors; no hydration/runtime overlay.

## Final gate

- Slice 11 contracts: **28/28 PASS**.
- Full Vitest suite: **174/174 PASS** across 16 files.
- TypeScript: PASS.
- ESLint: PASS.
- Next.js production build: PASS, including `/explore`, `/explore/[offeringId]`, `/drive/trips` and all Trip APIs in the route manifest.
- Supabase security advisor: only the existing project-level `auth_leaked_password_protection` warning.
- Supabase performance advisor: INFO-level unused-index notices only; no blocking missing-RLS or unindexed-FK finding.

## Scope integrity

All marketplace writes are canonical RPC commands. Direct client access to Trip tables is denied. No service-role credential is committed. Raahi School / SchoolTransportOS and port 4030 were not touched. No reset/clean was used.

## Result

**Slice 11 / Wave 6 Raahi Trips / Explore: ACCEPTED.**

The frozen next stage is **Wave 7 — Local Offers + Market Intelligence**.