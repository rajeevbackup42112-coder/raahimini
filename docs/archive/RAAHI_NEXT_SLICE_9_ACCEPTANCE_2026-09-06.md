# Raahi Next — Slice 9 Outstation Acceptance Archive

**Date:** 2026-09-06
**Baseline:** `43e50db` (`slice8: fixed round trip lifecycle`)
**Environment:** Raahi Next Dev / local port 4029

## Migration reconciliation
- Read cloud migration history before changing local filenames.
- Retained Slice 9 migration bodies were reconciled to the exact cloud-applied versions.
- No already-live migration was replayed.
- One superseded local Driver-cancellation draft was removed only after proving it was not part of cloud history.
- Forward-only hardening migrations added: projection hardening `20260906011236` and FK-index hardening `20260906011628`.

## One Way acceptance
- Fresh Passenger request used real Supabase Auth/RLS through Dev Test Mode.
- Same idempotency key + same payload returned the same Request; changed payload returned `IDEMPOTENCY_CONFLICT`.
- Driver A revisions: ₹5,000 then ₹4,800; Driver B quote: ₹4,600.
- Passenger saw current ₹4,800 and ₹4,600, but not superseded ₹5,000.
- Driver A did not see Driver B's price; Driver B did not see Driver A's price.
- Stale Driver A revision acceptance returned `OUTSTATION_QUOTE_REVISION_STALE`.
- Driver B's exact ₹4,600 revision won; retry returned the same binding objects; attempted second winner was rejected.
- Fulfilment completed through canonical APIs. Cancellation after approach was rejected as already in fulfilment.
## Payment/support acceptance
- One Way completion produced exactly one DUE payment for ₹4,600.
- Passenger marked paid; Driver confirmed receipt.
- A separate OPEN Ride support Case was created afterward; Ride, Booking, Agreement and Request remained COMPLETED.

## Round Trip acceptance
- Fresh synthetic Round Trip accepted at ₹6,200 with one shared Agreement/Commitment/Ride/Booking.
- Outbound reached WAITING_FOR_RETURN; early return boarding was rejected with `RETURN_WAIT_NOT_FINISHED`.
- At the wait boundary the Commitment was ACTIVE, Booking return status PENDING and no Payment existed.
- After proving the timing guard, only the synthetic Dev Ride's derived `return_not_before` was advanced to avoid waiting in wall-clock time.
- Return boarding, return boarded, return departure and verified Gomoh completion then used canonical authenticated commands.
- Final Ride/Booking/Agreement/Request/Commitment state was COMPLETED and Payment became DUE ₹6,200 only after final return.

## Final gates
- Slice 9 contracts: 16/16 PASS; complete contract suite: 124/124 PASS.
- TypeScript PASS; ESLint PASS; production build PASS.
- Supabase advisor recheck: no Slice 9 unindexed-FK findings; security shows only the existing project-level leaked-password-protection warning.
- Real headed Chrome Passenger and Driver screenshots passed final visual review.
- A headed hydration mismatch from locale-dependent `toLocaleString()` was discovered, fixed with explicit `en-IN` / `Asia/Kolkata` formatting, and verified absent on the final headed run.

## Scope integrity
- Raahi School / SchoolTransportOS was not touched.
- Port 4030 was not used.
- No reset/clean was performed on the preserved Slice 9 tree.
