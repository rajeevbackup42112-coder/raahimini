-- Raahi Next Foundation 1E: advisor hardening.
-- Add covering FK indexes and explicit deny policies for server-only tables.

create index idx_admin_scope_assignments_granted_by
on public.admin_scope_assignments(granted_by) where granted_by is not null;
create index idx_admin_scope_assignments_market
on public.admin_scope_assignments(market_id) where market_id is not null;
create index idx_audit_events_actor
on public.audit_events(actor_profile_id, occurred_at desc) where actor_profile_id is not null;
create index idx_command_idempotency_actor
on public.command_idempotency(actor_profile_id, created_at desc) where actor_profile_id is not null;
create index idx_driver_active_vehicle_access
on public.driver_active_vehicles(driver_id, vehicle_id);
create index idx_driver_active_vehicles_vehicle
on public.driver_active_vehicles(vehicle_id);
create index idx_operating_market_events_new_market
on public.driver_operating_market_events(new_market_id, occurred_at desc);
create index idx_operating_market_events_previous_market
on public.driver_operating_market_events(previous_market_id, occurred_at desc)
where previous_market_id is not null;
create index idx_driver_vehicle_access_vehicle
on public.driver_vehicle_access(vehicle_id) where revoked_at is null;
create index idx_market_feature_flags_updated_by
on public.market_feature_flags(updated_by) where updated_by is not null;create index idx_mobility_commitments_product
on public.mobility_commitments(product_id, starts_at) where product_id is not null;
create index idx_rule_versions_created_by
on public.service_product_rule_versions(created_by) where created_by is not null;
create index idx_service_products_current_rules
on public.service_products(id, current_rules_version) where current_rules_version is not null;
create index idx_verification_records_reviewed_by
on public.verification_records(reviewed_by) where reviewed_by is not null;

create policy audit_events_internal_locked
on public.audit_events for all to anon, authenticated
using (false) with check (false);
create policy command_idempotency_internal_locked
on public.command_idempotency for all to anon, authenticated
using (false) with check (false);
create policy market_feature_flags_internal_locked
on public.market_feature_flags for all to anon, authenticated
using (false) with check (false);
create policy rule_versions_internal_locked
on public.service_product_rule_versions for all to anon, authenticated
using (false) with check (false);
