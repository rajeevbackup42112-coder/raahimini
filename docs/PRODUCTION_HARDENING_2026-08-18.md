# Raahi Mini — Production Hardening Checkpoint

Date: 2026-08-18

This checkpoint reconciles the live database with the canonical Raahi invariants before automated end-to-end testing.

## Applied production safeguards

- Configuration tables are client read-only; direct INSERT/UPDATE/DELETE/TRUNCATE privileges are removed.
- Public clients consume projections rather than authoritative `trips`, `trip_seats`, or `driver_queue` rows.
- Admin authority requires `profiles.role='admin'` and `is_restricted=false`.
- Full live driver-queue visibility is limited to active drivers and unrestricted admins.
- Admin restriction cannot target admins or interrupt a queued/on-trip driver.
- Driver/vehicle onboarding cannot reassign a driver while queued/on-trip or share an active vehicle.
- Admin queue remove/reorder operations serialize with normal route operations and preserve dense live FIFO ordering.
- Historical terminal queue states may repeat across journeys; uniqueness applies only to live queue state.

## Role boundary

The strict single-role rules in `RAAHI_ROLE_BOUNDARY_2026-08-18.md` remain canonical: passenger, driver, and admin are mutually exclusive operational experiences. Drivers/admins cannot book seats, and admins correct operational failures only through audited invariant-preserving commands.

## Security-advisor interpretation

Supabase may warn that intentional public/authenticated `SECURITY DEFINER` RPCs are executable. These warnings are reviewed by contract: public discovery RPCs are intentionally anonymous; passenger/driver/admin commands remain exposed only where their bodies enforce the required server-side identity/ownership/role checks. Authoritative operational tables are not used as a substitute for those command/projection boundaries.

Master Sheet impact: these rules must be consolidated into the next canonical Master Architecture Sheet revision; this document records the live hardening checkpoint until that consolidation is merged.
