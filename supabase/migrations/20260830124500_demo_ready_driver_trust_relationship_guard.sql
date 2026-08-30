-- Trust visibility requires Admin, Driver self, or a confirmed Raahi Passenger relationship.
-- Outstation may extend this helper with request/quote membership later.
create or replace function public.can_view_driver_trust(p_driver_id uuid)
returns boolean
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return false; end if;
  if public.is_admin() then return true; end if;
  if exists(select 1 from public.drivers d where d.id=p_driver_id and d.profile_id=auth.uid()) then return true; end if;
  return exists(
    select 1 from public.seat_requests sr
    join public.trips t on t.id=sr.trip_id
    where sr.passenger_id=auth.uid()
      and sr.status='CONFIRMED'
      and t.driver_id=p_driver_id
  );
end;
$function$;
revoke all on function public.can_view_driver_trust(uuid) from public,anon;
grant execute on function public.can_view_driver_trust(uuid) to authenticated;
