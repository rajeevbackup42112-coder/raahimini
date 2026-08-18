# Raahi Mini — Production Hardening Checkpoint

Date: 2026-08-18

**Status:** Historical production checkpoint. Its architecture rules are fully consolidated into `RAAHI_MASTER_ARCHITECTURE.md`, which is the sole canonical architecture authority.

Applied production safeguards at this checkpoint:

- Configuration and route-location tables are client read-only; direct INSERT/UPDATE/DELETE/TRUNCATE privileges are removed.
- Public clients consume projections rather than authoritative `trips`, `trip_seats`, or `driver_queue` rows.
- Admin authority requires trusted `profiles.role='admin'` and `is_restricted=false`.
- Full live driver-queue visibility is limited to active drivers and unrestricted admins.
- Admin restriction cannot target admins or interrupt a queued/on-trip driver.
- Driver/vehicle onboarding cannot reassign a driver while queued/on-trip or share an active vehicle.
- Admin queue remove/reorder operations serialize with normal route operations and preserve live FIFO ordering.
- Historical terminal queue states may repeat across journeys; uniqueness applies only to live queue state.
- Strict passenger/driver/admin role boundaries are enforced at both UI-routing and canonical RPC boundaries.

Supabase advisor warnings for intentional public/authenticated SECURITY DEFINER RPCs are reviewed by contract: public discovery RPCs intentionally support anonymous browsing, while passenger/driver/admin commands must enforce server-side identity, ownership and/or role authorization.

For current behaviour and all future changes, use `docs/RAAHI_MASTER_ARCHITECTURE.md`.
