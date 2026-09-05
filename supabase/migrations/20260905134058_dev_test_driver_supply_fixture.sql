-- Development-only: give synthetic Driver personas repeatable eligible supply.

create or replace function private.dev_provision_test_driver_fixture(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver_id uuid;
  v_vehicle_id uuid;
  v_registration text;
begin
  if not exists (
    select 1 from auth.users u
    where u.id = p_profile_id
      and coalesce((u.raw_user_meta_data ->> 'raahi_test_identity')::boolean, false)
  ) then
    raise exception 'TEST_IDENTITY_REQUIRED';
  end if;

  select d.id into v_driver_id
  from public.drivers d
  where d.profile_id = p_profile_id;
  if v_driver_id is null then raise exception 'TEST_DRIVER_REQUIRED'; end if;

  v_registration := 'TEST-' || upper(substr(replace(p_profile_id::text, '-', ''), 1, 10));

  insert into public.vehicles(
    registration_number, vehicle_type, vehicle_model,
    bookable_passenger_capacity, status
  ) values (
    v_registration, 'CAR', 'Raahi Test Car', 4, 'ELIGIBLE'
  )
  on conflict (registration_number) do update set
    vehicle_type = 'CAR',
    vehicle_model = 'Raahi Test Car',
    bookable_passenger_capacity = 4,
    status = 'ELIGIBLE',
    updated_at = now()
  returning id into v_vehicle_id;

  insert into public.driver_vehicle_access(driver_id, vehicle_id, relationship, revoked_at)
  values (v_driver_id, v_vehicle_id, 'PRIMARY', null)
  on conflict (driver_id, vehicle_id) do update set
    relationship = 'PRIMARY',
    revoked_at = null;

  insert into public.driver_active_vehicles(driver_id, vehicle_id, selected_at)
  values (v_driver_id, v_vehicle_id, now())
  on conflict (driver_id) do update set
    vehicle_id = excluded.vehicle_id,
    selected_at = now();

  insert into public.verification_records(
    driver_id, verification_type, status, reviewed_at, notes
  )
  select v_driver_id, t.verification_type, 'VERIFIED', now(), 'Development test fixture'
  from (values ('PHONE'), ('DRIVING_LICENCE'), ('DRIVER_PHOTO')) as t(verification_type)
  on conflict (driver_id, verification_type) where driver_id is not null
  do update set
    status = 'VERIFIED', expires_at = null,
    reviewed_at = now(), notes = 'Development test fixture';

  insert into public.verification_records(
    vehicle_id, verification_type, status, reviewed_at, notes
  )
  select v_vehicle_id, t.verification_type, 'VERIFIED', now(), 'Development test fixture'
  from (values ('VEHICLE_RC'), ('VEHICLE_PHOTOS')) as t(verification_type)
  on conflict (vehicle_id, verification_type) where vehicle_id is not null
  do update set
    status = 'VERIFIED', expires_at = null,
    reviewed_at = now(), notes = 'Development test fixture';

  return jsonb_build_object(
    'driver_id', v_driver_id,
    'vehicle_id', v_vehicle_id,
    'registration_number', v_registration
  );
end;
$$;

revoke all on function private.dev_provision_test_driver_fixture(uuid)
from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.dev_provision_test_driver_fixture(uuid) to service_role;

create or replace function public.dev_provision_test_driver_fixture(p_profile_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.dev_provision_test_driver_fixture(p_profile_id);
$$;

revoke all on function public.dev_provision_test_driver_fixture(uuid)
from public, anon, authenticated;
grant execute on function public.dev_provision_test_driver_fixture(uuid) to service_role;
