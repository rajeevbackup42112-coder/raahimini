# Raahi V2 Dev — Database Replay Plan

Purpose: rebuild an isolated V2 backend from the canonical GitHub migrations without copying production data.

Target: `Raahi V2 Dev`

## Canonical replay order

Apply repository migrations in filename order:

1. `20260816000001_raahi_core_schema.sql` — applied
2. `20260816000002_raahi_operational_tables.sql` — applied
3. `20260816000003_raahi_rpc_functions.sql` — pending replay
4. `20260816000004_raahi_read_projections.sql` — pending replay
5. `20260816000005_raahi_seed_data.sql` — applied (route/reference seed only; no privileged auth identities)
6. `20260816000006_security_concurrency_hardening.sql` — pending replay
7. `20260816000007_final_function_hardening.sql` — pending replay
8. `20260816000008_driver_dynamic_routes.sql` — pending replay
9. `20260816000009_driver_queue_state_context.sql` — pending replay
10. `20260816000010_driver_cancelled_status.sql` — pending replay
11. `20260816000011_driver_cancellation_flow.sql` — pending replay
12. `20260816000012_public_active_car_only.sql` — pending replay
13. `20260816000013_held_seat_ledger.sql` — pending replay
14. `20260816000014_pickup_progression_guards.sql` — pending replay
15. `20260816000015_admin_driver_onboarding.sql` — pending replay
16. `20260816000016_live_queue_ranks.sql` — pending replay
17. `20260817000006_verified_phone_booking_gate.sql` — pending replay
18. `20260817073000_in_progress_stop_completion_guard.sql` — pending replay
19. `20260817080000_passenger_completed_journey_projection.sql` — pending replay
20. `20260818050000_route_fares_and_admin_controls.sql` — pending replay
21. `20260818053000_realtime_invalidation_channel.sql` — pending replay
22. `20260818054000_role_transition_active_request_guard.sql` — pending replay
23. `20260818055000_role_transition_active_trip_scope_fix.sql` — pending replay
24. `20260818100000_enforce_single_operational_role.sql` — pending replay
25. `20260818101000_admin_role_delegation.sql` — pending replay
26. `20260818110500_drop_obsolete_driver_queue_history_uniqueness.sql` — pending replay
27. `20260818111000_harden_admin_permissions.sql` — pending replay
28. `20260818111500_harden_admin_restrictions.sql` — pending replay
29. `20260818112000_harden_driver_onboarding.sql` — pending replay
30. `20260818112500_harden_admin_queue_overrides.sql` — pending replay
31. `20260818113000_revoke_internal_helper_execute.sql` — pending replay
32. `20260818113500_lock_route_locations_writes.sql` — pending replay
33. `20260818114000_harden_queue_exit_paths.sql` — pending replay
34. `20260821022839_v2_alpha1_identity_profile.sql` — pending replay
35. `20260821162000_v2_beta1_demand_intents.sql` — applied and SQL-contract tested

## Replay rules

- Never replay these into the historical production-linked Supabase project for development testing.
- Apply in filename order so later migrations supersede early implementations exactly as the V10 engine expects.
- Do not create privileged users by SQL seed. Test identities must be created through Auth or a controlled test-only workflow.
- After the final replay, run security and performance advisors again.
- Verify exposed function EXECUTE grants against intended anon/authenticated/admin boundaries.
- Run invariant tests before browser E2E.

## Current interruption note

The Supabase connector became unavailable while the replay was beginning at migration 3. No assumption is made that migration 3 was applied. Resume by checking the remote migration/schema state first, then continue from the first missing migration.
