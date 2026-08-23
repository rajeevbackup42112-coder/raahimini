drop function if exists public.get_driver_departing_routes(uuid);

create function public.get_driver_departing_routes(p_location_id uuid)
returns table(
  route_id uuid,
  route_code text,
  from_location_id uuid,
  from_location_name text,
  to_location_id uuid,
  to_location_name text,
  direction_label text,
  has_active_car boolean,
  available_seats integer,
  waiting_drivers integer,
  fare_per_seat integer,
  vehicle_capacity integer
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null or not public.is_driver() then
    raise exception 'Driver access required';
  end if;

  return query
  select
    r.id,
    r.code,
    r.from_location_id,
    fl.name,
    r.to_location_id,
    tl.name,
    r.direction_label,
    (t.id is not null),
    coalesce(t.capacity - t.confirmed_count - t.held_count - t.driver_closed_count,0),
    coalesce((
      select count(*)::integer
      from public.driver_queue dq
      where dq.route_id=r.id and dq.status='WAITING'
    ),0),
    r.fare_per_seat,
    v.capacity
  from public.routes r
  join public.locations fl on fl.id=r.from_location_id
  join public.locations tl on tl.id=r.to_location_id
  join public.drivers d on d.profile_id=auth.uid() and d.is_active=true
  join public.vehicles v on v.id=d.vehicle_id and v.is_active=true
  left join public.trips t on t.route_id=r.id and t.status='ACTIVE_COLLECTING'
  where r.is_active=true
    and fl.is_active=true
    and tl.is_active=true
    and r.from_location_id=p_location_id
  order by r.code;
end;
$function$;

revoke execute on function public.get_driver_departing_routes(uuid) from public, anon, service_role;
grant execute on function public.get_driver_departing_routes(uuid) to authenticated;
