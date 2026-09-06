# Raahi Next — Slice 10 Carpool Acceptance Archive

**Acceptance window:** 2026-09-06 through 2026-09-07
**Baseline:** `addbf0c` (`slice9: outstation lifecycle`)
**Environment:** Raahi Next Dev / local port 4029

## Frozen ownership model proven
- Carpool is a Driver-owned personal journey, not Passenger demand.
- Publishing spare seats creates a `carpool_journey` only; no Ride or Mobility Commitment exists before the first Passenger booking.
- Passenger booking is instant in V1; there is no Driver approval/cherry-picking step.
- The first Passenger booking creates one shared CARPOOL Mobility Commitment and Ride; later bookings reuse them.
- Capacity is serialized by locking the Journey; Driver/Vehicle commitment exclusion remains cross-service.
- Price and uncommitted terms lock after the first Passenger booking.
- Material time/destination changes require per-booking Passenger re-consent; rejection is a penalty-free exit.
- Driver cancellation remains Carpool and never converts the booking to another service.

## Cloud migration reconciliation
1. `20260906032209_slice10_carpool_schema` — MD5 `9445276b7e19c85d6eede35c79a70460`
2. `20260906032443_slice10_carpool_commands` — MD5 `d43fab8528477e0ed8cc22f6ebb933b2`
3. `20260906032612_slice10_carpool_change_fulfilment` — MD5 `5bccb587fcbe4b13e0bdebdb6854fb7a`
4. `20260906042313_slice10_fk_index_hardening` — MD5 `604cddbe5a25be52c997d606add0efda`
5. `20260906042455_slice10_carpool_projections` — MD5 `c35625831869d0ab5968372bd7546bb6`
6. `20260906052926_slice10_carpool_booking_generated_fare_fix` — MD5 `8564caa59cec8a31f861be12109eb107`
7. `20260906165328_slice10_carpool_in_fulfilment_cancel_code` — MD5 `f76a1eeb38de32cdeb2d45197e3f42ca`
8. `20260906170747_slice10_carpool_projection_wrapper_permissions` — MD5 `1f22fc83ead118daa4b86f7606d81f1b`

No already-live migration was replayed. All eight local migration files were reconciled to the exact cloud-applied bytes.
## Real authenticated capacity + commitment acceptance
- Main Journey: `d80017dd-d357-4d36-8993-99da7ea3a93e`.
- Shared Ride: `26d41170-defb-402e-aa39-741236de26f5`.
- Shared CARPOOL Commitment: `6f6ad076-ca29-42f6-94b6-b2f4519390c0`.
- Passenger A first booked one seat successfully, creating the shared Ride/Commitment.
- Passengers B and C then submitted simultaneous authenticated requests for the final seat from separate sessions.
- Passenger C won the final seat; Passenger B received `CARPOOL_CAPACITY_UNAVAILABLE`.
- Final concurrent truth was one Ride, one Commitment, two active bookings and exactly 2/2 booked seats.
- Direct post-booking edit returned `CARPOOL_ALREADY_COMMITTED`.
- Overlapping Driver/Vehicle publication returned `CARPOOL_COMMITMENT_CONFLICT`.

## Material-change acceptance
- Proposal: `6bcd35b8-e85d-4fb3-ae80-3e409758d608`.
- Exactly two PENDING consent rows were created for the two active Passenger bookings.
- Passenger A accepted the revised departure.
- Passenger C rejected; C exited penalty-free and the Carpool/ride booking became CANCELLED.
- Only after both responses resolved did the proposal become APPLIED and the revised departure update Journey/Ride/Commitment state.
- Passenger A remained ACTIVE; active/booked seat counts fell from 2 to 1.

## Runtime defects found and fixed forward-only
- First real booking exposed an invalid explicit insert into generated `ride_bookings.total_fare_inr`; fixed by `20260906052926`, leaving fare generation to the shared Ride kernel.
- Cancellation after fulfilment started was safely rejected but surfaced the generic code; `20260906165328` restored frozen `CARPOOL_ALREADY_IN_FULFILMENT` semantics.
- Headed Chrome exposed projection wrapper permission failures; `20260906170747` grants authenticated execution on the private projection functions used by security-invoker public wrappers while direct table/RLS boundaries remain locked.

## Real fulfilment, payment and support acceptance
- Driver began approach; a subsequent Driver cancellation was rejected with `CARPOOL_ALREADY_IN_FULFILMENT`.
- Fresh Gomoh GPS (`23.873549, 86.151601`) verified arrival.
- Boarding started; Passenger A was marked BOARDED; the Ride departed.
- Fresh Dhanbad GPS (`23.795399, 86.42704`) verified completion.
- Final main truth: Journey, Ride, Passenger A booking and shared Commitment COMPLETED; Passenger C remained CANCELLED.
- Exactly one payment acknowledgement was generated: `1847750e-7a68-49a2-b50d-2761f16b9dfa`, ₹180, initially DUE.
- Passenger A marked paid; Driver confirmed receipt.
- Support Case `a903627f-c218-4335-87ed-006531266b3b` opened on the Ride afterward; Ride and Journey remained COMPLETED.

## Driver cancellation fixture
- Fresh Journey `cfab57dd-6c4d-4920-888d-71e0a3e4a0b6` published with no Ride/Commitment before demand.
- Passenger B's first booking created Ride `eabb0cb4-2b88-4d71-88d3-64819d938b46` and a CARPOOL commitment.
- Driver cancellation before fulfilment succeeded.
- Final fixture truth: Journey `DRIVER_CANCELLED`, Carpool booking `DRIVER_CANCELLED`, shared Ride `CANCELLED`, Commitment `RELEASED`, source type still `CARPOOL`, payment count 0.

## Privacy / projection proof
- Passenger discovery/detail exposes trust booleans, not raw DL/RC document paths.
- Driver phone is scoped to an active committed Passenger and non-terminal Ride.
- Driver workspace exposes Passenger phone only for active committed bookings while operationally necessary.
- Completed/cancelled projections remained readable only through authenticated scoped RPCs after the projection-permission hardening.

## Headed Chrome acceptance
- Passenger evidence: `docs/archive/evidence/slice10/passenger-completed.png`.
- Driver evidence: `docs/archive/evidence/slice10/driver-workspace.png`.
- Final deterministic CDP run: `HEADED_OK true`.
- Passenger checks all true: ownership cue, Gomoh → Dhanbad route, trust badges, private-document copy, completed booking, ₹180 payment, support, no hydration/runtime issue.
- Driver checks all true: “I’m already going somewhere”, shared commitment timeline, completed main Journey, Driver-cancelled fixture, confirmed payment, support, no hydration/runtime issue.
- Driver `datetime-local` rendering was made deterministic for Asia/Kolkata and render-time synthetic payment completion timestamps were removed before final acceptance.

## Final gates
- Slice 10 contracts: **22/22 PASS**.
- Full contract suite: **146/146 PASS** across 15 test files.
- TypeScript: PASS.
- ESLint: PASS.
- Production Next.js build: PASS; Carpool Passenger, Driver and API routes are present in the optimized build.
- Supabase security advisor: only existing project-level leaked-password-protection warning.
- Supabase performance advisor: no unindexed-FK finding; remaining notices are unused-index INFO on Dev.

## Scope integrity
- No reset or clean command was used on the preserved worktree.
- Raahi School / SchoolTransportOS was not touched.
- Port 4030 was not used.
- Slice 9 checkpoint `addbf0c` remained the baseline until this Slice 10 checkpoint.

## Next frozen stage
**Wave 6 — Raahi Trips / Explore:** published leisure journey, threshold confirmation, booking, two-leg fulfilment and discovery surfaces.
