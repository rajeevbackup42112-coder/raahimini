-- Slice 5D: authenticated wrappers may execute private implementations,
-- while private schema remains outside the exposed API surface.

grant usage on schema private to authenticated;

grant execute on function private.driver_acknowledge_fixed_ride(uuid,text) to authenticated;
grant execute on function private.driver_begin_fixed_approach(uuid,text) to authenticated;
grant execute on function private.driver_arrive_fixed_ride(uuid,double precision,double precision,double precision,timestamptz,text) to authenticated;
grant execute on function private.driver_start_fixed_boarding(uuid,text) to authenticated;
grant execute on function private.driver_mark_fixed_boarded(uuid,text) to authenticated;
grant execute on function private.driver_report_fixed_no_show(uuid,text) to authenticated;
grant execute on function private.evaluate_my_fixed_boarding(uuid) to authenticated;
