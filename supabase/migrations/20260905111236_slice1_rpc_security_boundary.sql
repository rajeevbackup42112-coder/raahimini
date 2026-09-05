-- Slice 1C: keep privileged implementations outside the exposed public API schema.

alter function public.get_my_drive_context() set schema private;
revoke all on function private.get_my_drive_context() from public, anon, authenticated;
grant execute on function private.get_my_drive_context() to authenticated;

create function public.get_my_drive_context()
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$
  select private.get_my_drive_context();
$$;
revoke all on function public.get_my_drive_context() from public, anon, authenticated;
grant execute on function public.get_my_drive_context() to authenticated;

alter function public.driver_set_operating_market(
  uuid, double precision, double precision, double precision, timestamptz, text
) set schema private;
revoke all on function private.driver_set_operating_market(
  uuid, double precision, double precision, double precision, timestamptz, text
) from public, anon, authenticated;
grant execute on function private.driver_set_operating_market(
  uuid, double precision, double precision, double precision, timestamptz, text
) to authenticated;
create function public.driver_set_operating_market(
  p_market_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_captured_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.driver_set_operating_market(
    p_market_id,
    p_latitude,
    p_longitude,
    p_accuracy_meters,
    p_captured_at,
    p_idempotency_key
  );
$$;
revoke all on function public.driver_set_operating_market(
  uuid, double precision, double precision, double precision, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.driver_set_operating_market(
  uuid, double precision, double precision, double precision, timestamptz, text
) to authenticated;