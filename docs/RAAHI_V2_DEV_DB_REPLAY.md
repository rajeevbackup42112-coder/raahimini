# Raahi V2 Dev — Database Replay Plan

Purpose: rebuild an isolated V2 backend from the canonical GitHub migrations without copying production data.

Target: `Raahi V2 Dev` (`euqonxznewasaymdzach`)

## Canonical replay status

Repository migrations were replayed in filename order, with one intentional seed exception: migration 5 was not duplicated because its safe route/reference seed data was already present. No privileged auth identities were seeded.

1. `20260816000001_raahi_core_schema.sql` — applied
2. `20260816000002_raahi_operational_tables.sql` — applied
3. `20260816000003_raahi_rpc_functions.sql` — replayed successfully
4. `20260816000004_raahi_read_projections.sql` — replayed successfully
5. `20260816000005_raahi_seed_data.sql` — safe route/reference seed already present; not duplicated
6. `20260816000006_security_concurrency_hardening.sql` — replayed successfully
7. `20260816000007_final_function_hardening.sql` — replayed successfully
8. `20260816000008_driver_dynamic_routes.sql` — replayed successfully; approved obsolete `drivers.route_id` drop applied on V2 Dev only
9. `20260816000009_driver_queue_state_context.sql` — replayed successfully
10. `20260816000010_driver_cancelled_status.sql` — replayed successfully
11. `20260816000011_driver_cancellation_flow.sql` — replayed successfully
12. `20260816000012_public_active_car_only.sql` — replayed successfully
13. `20260816000013_held_seat_ledger.sql` — replayed successfully
14. `20260816000014_pickup_progression_guards.sql` — replayed successfully
15. `20260816000015_admin_driver_onboarding.sql` — replayed successfully
16. `20260816000016_live_queue_ranks.sql` — replayed successfully
17. `20260817000006_verified_phone_booking_gate.sql` — replayed successfully
18. `20260817073000_in_progress_stop_completion_guard.sql` — replayed successfully
19. `20260817080000_passenger_completed_journey_projection.sql` — replayed successfully
20. `20260818050000_route_fares_and_admin_controls.sql` — replayed successfully
21. `20260818053000_realtime_invalidation_channel.sql` — replayed successfully
22. `20260818054000_role_transition_active_request_guard.sql` — replayed successfully
23. `20260818055000_role_transition_active_trip_scope_fix.sql` — replayed successfully
24. `20260818100000_enforce_single_operational_role.sql` — replayed successfully
25. `20260818101000_admin_role_delegation.sql` — replayed successfully
26. `20260818110500_drop_obsolete_driver_queue_history_uniqueness.sql` — replayed successfully
27. `20260818111000_harden_admin_permissions.sql` — replayed successfully
28. `20260818111500_harden_admin_restrictions.sql` — replayed successfully
29. `20260818112000_harden_driver_onboarding.sql` — replayed successfully
30. `20260818112500_harden_admin_queue_overrides.sql` — replayed successfully
31. `20260818113000_revoke_internal_helper_execute.sql` — replayed successfully
32. `20260818113500_lock_route_locations_writes.sql` — replayed successfully
33. `20260818114000_harden_queue_exit_paths.sql` — replayed successfully
34. `20260821022839_v2_alpha1_identity_profile.sql` — replayed successfully
35. `20260821162000_v2_beta1_demand_intents.sql` — replayed after V10 hardening to restore its intended grants

## Ordering note

Beta1 had originally been installed before the V10 parity replay. Later V10 hardening migrations revoked function execution grants that Beta1 intentionally owns. Replaying the canonical Beta1 migration after V10/Alpha1 restored the intended Beta1 privilege contract. This was an ordering correction, not a semantic change to the migration.

## Validation completed after replay

- transactional Beta1 demand invariants pass with rollback and zero persistent fixture data
- V1 booking/FIFO/trip invariant regression passes
- demand functions do not mutate `trips`, `driver_queue`, `seat_requests`, or `trip_seats`
- direct RLS/table privilege checks match the projection model
- security advisor rerun and reviewed
- performance advisor rerun and reviewed
- established V1 semantics were not changed solely to silence advisor warnings

## Repository test-fixture correction

`tests/sql/v2_beta1_demand_invariants.sql` contained a stale expiry fixture using a 1-minute NOW tolerance, while the canonical contract permits 5–180 minutes. The database contract is correct. The repository fixture has been corrected to use 5 minutes before forcing `latest_at` stale inside the transaction.

## Remaining gate

Backend parity and SQL regression are complete. Remaining work is interactive browser/staging acceptance against the isolated V2 Dev project, followed by the Beta1 notification/rate-limit exit slice and final CI confirmation.

Clean validation worktree:
`C:\Users\Dipti\RaahiV2Beta1Validation`

## Replay rules retained

- Never replay these into the historical production-linked Supabase project for development testing.
- Keep repository migration filename order authoritative.
- Do not create privileged users by SQL seed.
- Re-run advisors after material DDL changes.
- Verify exposed function EXECUTE grants against intended anon/authenticated/admin boundaries.
- Keep PR #68 draft until browser/staging gates pass.
