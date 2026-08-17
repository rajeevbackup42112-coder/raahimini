# Raahi Mini Admin Security & Architecture Audit

Date: 2026-08-17  
Repository baseline: `main@40b818ceef5fe9caa40ddf6ec2bfbfa17b4f7644`  
Live Supabase project: `gqjddvgvuaksxjyoxvfz`

## Scope and method

The audit used the current Master Architecture Sheet, current GitHub `main`, and the
live PostgreSQL catalog/function definitions as sources of truth. It covered Admin UI
gating, Admin RPC authorization and grants, RLS/table privileges, SECURITY DEFINER
functions, driver onboarding/deactivation, user restriction, queue overrides, route and
location management, audit recording, and direct client table mutations.

No production database change was made. The proposed migration was executed inside a
transaction against the live schema and rolled back successfully.

## Findings

### High — Configuration tables have unnecessary write and TRUNCATE grants

- Exact objects: table privileges on `public.locations`, `public.routes`,
  `public.route_stops`, and `public.vehicles`; related
  `*_admin_write` RLS policies.
- Why unsafe: `anon` and `authenticated` currently hold INSERT, UPDATE, DELETE,
  and TRUNCATE. RLS protects row mutations but does not protect TRUNCATE. The current
  Admin UI only reads these tables and explicitly directs additions to a migration, so
  the grants are unnecessary and contradict the canonical command rule.
- Smallest safe fix: revoke non-read privileges from client roles. Keep public reads
  only for genuine configuration projections; require canonical audited RPCs or reviewed
  migrations for future writes.
- Patch: `20260817000007_admin_safety_hardening.sql`.

### High — Admin queue overrides are not concurrency-safe and reorder can violate its own unique index

- Exact RPCs: `public.admin_reorder_queue(UUID,INTEGER)` and
  `public.admin_remove_from_queue(UUID)`.
- Why unsafe: neither RPC takes the route advisory locks used by normal queue admission
  and activation, neither initially locks the full live route queue, and reorder accepts
  zero, negative, or out-of-range positions. Its in-place shift can collide with
  `idx_driver_queue_live_position` before the target row is moved.
- Smallest safe fix: serialize with both route lock namespaces already present in the
  deployed queue code, revalidate the target under row locks, validate the requested
  dense live rank, move waiting rows through unique temporary positions, normalize the
  active row, then assign dense positive positions and audit old/new state.
- Patch: both RPCs are replaced in the hardening migration.

### High — Driver onboarding can change a live driver's vehicle or share a live vehicle

- Exact RPC: `public.admin_onboard_driver(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER)`.
- Why unsafe: the upsert can change an existing driver's vehicle while the driver is
  WAITING, ACTIVE_COLLECTING, or IN_PROGRESS. A registration can also be attached to
  another active driver because `drivers.vehicle_id` is not unique. This can make
  driver identity/vehicle displays disagree with the trip's snapshotted vehicle.
  The RPC also overwrites `profiles.phone` with unverified Admin input even though the
  architecture makes Supabase Auth phone confirmation authoritative.
- Smallest safe fix: lock the existing driver and vehicle, reject updates during live
  queue/trip state, reject a vehicle assigned to another active driver or live trip,
  and write Admin-verified contact only to `drivers.phone`.
- Patch: the onboarding RPC is replaced without changing the onboarding UX.

### High — Restriction can disrupt a live driver, while a restricted admin remains authorized

- Exact functions: `public.is_admin()`,
  `public.admin_restrict_user(UUID,TEXT)`, and
  `public.admin_unrestrict_user(UUID)`.
- Why unsafe: `is_admin()` checks role but not `is_restricted`. The restriction RPC
  can target an admin or a driver who is queued/on-trip. That produces contradictory
  authorization and can strand a live operation.
- Smallest safe fix: require `role='admin' AND is_restricted=false` for Admin authority;
  disallow restriction RPCs against admin profiles; reject restriction of drivers with a
  live queue entry or live trip; lock and validate target existence; audit old/new state.
- Patch: all three functions are replaced.

### Medium — Any authenticated passenger can read the full live driver queue projection

- Exact RPC: `public.get_driver_queue_status(UUID)`.
- Why unsafe: EXECUTE is granted to `authenticated`, and the SECURITY DEFINER body has
  no role check. It returns driver names and vehicle registrations for any route. The
  Admin panel calls this same RPC, but it is not Admin-authorized.
- Smallest safe fix: permit only an unrestricted active driver or unrestricted admin.
- Patch: the projection is replaced with a server-side role check.

### Medium — Public policies expose authoritative operational tables instead of projections

- Exact policies: `trips_public_read`, `trip_seats_public_read`,
  `driver_queue_public_read`, and `vehicles_public_read`.
- Why unsafe: the architecture requires purpose-built projections. `trips` is
  currently readable by anonymous clients; the other permissive policies are either
  active or dangerous if a future grant is added. These expose internal identifiers and
  make future schema additions public by default.
- Smallest safe fix: remove permissive operational-table policies and grants; retain the
  existing SECURITY DEFINER public projections; allow vehicle rows only to the assigned
  driver or Admin.
- Patch: policies/grants are narrowed in the hardening migration.

### Low — SECURITY DEFINER hardening is inconsistent

- Exact functions: Admin and operational SECURITY DEFINER functions use
  `SET search_path=public`.
- Why unsafe: an immutable/empty search path with fully qualified objects is stronger.
  The current risk is reduced because neither `anon` nor `authenticated` has CREATE
  on `public`, and reviewed functions qualify operational objects.
- Smallest safe fix: convert functions incrementally to `search_path=''` with fully
  qualified references. Not included because it is broader than the clearly necessary
  Admin invariant patch.

### Low — Queue override RPCs are currently stale UI surface

- Exact UI/RPCs: `QueueTab` in
  `src/app/admin-panel/components/AdminPanelContent.tsx` only reads queue state;
  `admin_reorder_queue` and `admin_remove_from_queue` have no current UI controls.
- Why unsafe: unused mutation surfaces are easier to leave untested. They remain
  Admin-only and are required by the Master Sheet, so removal would be a product change.
- Smallest safe fix: retain and harden them now; add explicit UI/contract tests when the
  controls are introduced.

## Verified controls / no finding

- `handle_new_user()` always creates `passenger`; client metadata cannot create an
  admin or driver.
- All nine deployed `admin_*` RPCs enforce `public.is_admin()` server-side.
- `anon` cannot execute Admin RPCs. `authenticated` can reach them, but a non-admin
  is rejected server-side.
- Internal helpers `activate_next_driver`, `record_audit`,
  `record_behaviour`, and `release_held_request_seats` are not executable by
  `anon` or `authenticated`.
- No duplicate Admin function overloads were found in the live catalog.
- `profiles` has no client UPDATE grant, so the broad-looking own-update policy cannot
  currently be used for role self-promotion.
- `admin_deactivate_driver` locks the driver and rejects deactivation while a live trip
  exists. Waiting queue entries are cancelled and the action is audited.
- Current Admin UI role checks are presentation guards only; database RPC checks/RLS are
  the real security boundary.
- Current location/route Admin screens are read-only. No Admin UI direct mutation of
  `profiles`, `drivers`, `vehicles`, `driver_queue`, `trips`,
  `seat_requests`, or `trip_seats` was found.
- Live-state sanity check found zero shared active vehicles, zero invalid live queue
  positions, zero restricted admins, and no current live queue entries. One live trip
  existed during the read-only audit.

## Validation status

- Migration parse/DDL test against live schema: passed inside `BEGIN ... ROLLBACK`.
- Production data/schema mutation: none.
- Supabase security advisor baseline: run; it continues to report intentional
  authenticated SECURITY DEFINER RPC exposure plus platform warnings. A true post-fix
  advisor result requires deploying the migration to a database branch or production.
- Type-check: passed in GitHub Actions run 32003791787.
- Production build: passed in GitHub Actions run 32003791787.

Master Sheet impact: updated.

