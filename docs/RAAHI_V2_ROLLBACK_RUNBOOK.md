# Raahi V2 Rollback Runbook

Status: RC1 safety procedure. This document does not authorize production deployment or PR merge.

## Objective

Restore a known-good Raahi application state without corrupting authoritative booking, seat, queue, fare or trip history.

## Governing rule

**Application rollback may move code back. Database state does not move backward by default.**

Operational data represents real passenger/driver events. Never restore an old database snapshot over a live service merely to undo an application release.

## Stop-the-line triggers

Stop rollout and enter rollback mode if any of these appear after release:

- seat ledger and trip counts disagree;
- more seats are allocated than vehicle capacity;
- two drivers become operationally active for the same sequential route;
- a passenger booking is created without an explicit booking command;
- verified-phone, role or RLS boundaries are bypassed;
- active-trip GPS is exposed outside its permitted trip scope;
- support/share/demand features mutate FIFO or seat allocation unexpectedly;
- repeated 5xx/auth failures prevent normal passenger, driver or Admin operation.

## Immediate containment

1. Stop any further deployment or migration action.
2. Do not manually edit `trips`, `trip_seats`, `seat_requests`, `driver_queue` or `demand_intents` to make the UI look correct.
3. Capture the release commit, deployment identifier, migration version and first failing request/evidence.
4. Preserve current database state for investigation.
5. If the fault is frontend/server code only, roll the application back to the last CI-green, acceptance-approved commit.

## Application rollback

Use the hosting platform's immutable previous deployment or redeploy the exact last-known-good Git commit.

Before directing users back to it, verify:

- its environment points to the same intended Supabase project for that environment;
- no production test-auth setting is enabled;
- its client RPC signatures remain compatible with the migrations already applied;
- passenger Home, driver Home and Admin Home load without runtime errors.

Do **not** revert Git history or force-push the protected release branch as an incident response shortcut.

## Database rollback policy

Raahi migrations are treated as forward-only once they have touched operational data.

Preferred recovery order:

1. Keep the schema in place and roll application code back if the old code remains compatible.
2. If a database function/view is defective, ship a narrowly scoped forward-fix migration that restores the previous invariant.
3. If a new table/column is unused by the rolled-back app, leave it in place until a later reviewed cleanup.
4. Only run destructive SQL when a separate down migration has been rehearsed on an isolated copy and explicit production approval is given.

Never drop or rewrite operational rows as part of a routine rollback.

## Migration failure during rollout

If a migration fails before completion:

- stop the migration sequence;
- inspect Supabase migration history and the exact failed statement;
- determine whether the failed migration was transactional and whether any DDL committed;
- do not rerun the whole migration directory blindly;
- repair with a new idempotent/forward migration or resume only the unapplied canonical step.

If a migration succeeds but application validation fails, treat the schema as applied and follow the forward-only database policy above.

## Operational invariant verification after rollback

Run the release invariant sweep and require zero violations for:

- trip aggregate counts vs `trip_seats` states;
- over-capacity trips;
- duplicate active driver/route queue entries;
- queue/trip lifecycle contradictions;
- HELD/CONFIRMED request counts vs their seat ledger;
- passengers with a real HELD/CONFIRMED booking still counted as active NOW demand on that route.

Also re-run RLS/RPC privilege checks for any function changed during the incident.

## GPS / Share emergency handling

If a privacy defect is suspected:

- disable the affected application surface before attempting feature repair;
- do not broaden anonymous RPC permissions;
- completed/cancelled trips must have no live GPS row;
- cancelled shared links must be invalid immediately;
- if necessary, expire active share links with an explicit reviewed forward operation rather than exposing uncertain data.

## Return-to-service gate

Do not resume rollout until:

- the failure mechanism is understood;
- the chosen known-good application build passes CI;
- database invariant and privilege sweeps are green;
- passenger, driver and Admin smoke paths pass in the affected environment;
- the incident and corrective migration/commit are recorded.

## What this runbook deliberately does not allow

- restoring production from an older database snapshot over newer journey history;
- deleting synthetic or real operational rows merely to make tests pass;
- force-moving production Git refs to hide a bad release;
- weakening auth/RLS during recovery;
- using demand, support, GPS or sharing code to repair booking/FIFO state.

## RC verification status

The procedure is documented and its invariant checks are already executable against Raahi V2 Dev. Full rollback verification remains pending until a guaranteed-nonproduction staging deployment exists, where an application rollback can be rehearsed without touching production.
