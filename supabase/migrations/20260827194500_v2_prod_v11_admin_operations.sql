-- Raahi V2 Prod Version 11: consolidated Admin live-operations read projection.
-- Read-only: exposes existing trip/GPS/next-action truth without adding operational mutation paths.

create or replace function public.admin_get_live_trip_operations()
returns table(
  trip_id uuid,
  route_id uuid,
  route_code text,
  route_label text,
  trip_status text,
  driver_id uuid,
  driver_name text,
  vehicle_number text,
  confirmed integer,
  held integer,
  driver_closed integer,
  available integer,
  capacity integer,
  current_stop_name text,
  next_action text,
  next_stop_name text,
  started_at timestamptz,
  created_at timestamptz,
  gps_state text,
  gps_age_seconds integer,
  gps_accuracy_meters double precision,
  gps_captured_at timestamptz,
  open_support_cases integer
)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select
    t.id,
    t.route_id,
    r.code,
    r.direction_label,
    t.status::text,
    d.id,
    d.display_name,
    v.registration_number,
    t.confirmed_count,
    t.held_count,
    t.driver_closed_count,
    t.capacity-t.confirmed_count-t.held_count-t.driver_closed_count,
    t.capacity,
    current_stop.name,
    case
      when t.status='ACTIVE_COLLECTING' and next_pickup.stop_order=t.current_stop_order then 'PICKUP_NOW'
      when t.status='ACTIVE_COLLECTING' and next_pickup.stop_order is not null then 'DRIVE_TO_PICKUP'
      when t.status='ACTIVE_COLLECTING' and t.held_count=0 and t.confirmed_count+t.driver_closed_count=t.capacity then 'READY_TO_START'
      when t.status='ACTIVE_COLLECTING' and t.capacity-t.confirmed_count-t.held_count-t.driver_closed_count>0 then 'WAIT_OR_CLOSE_SEATS'
      when t.status='ACTIVE_COLLECTING' then 'GET_READY'
      when t.current_stop_order=final_stop.stop_order then 'COMPLETE_TRIP'
      else 'DRIVE_TO_DESTINATION'
    end,
    case
      when t.status='ACTIVE_COLLECTING' then next_pickup.name
      when t.current_stop_order=final_stop.stop_order then null
      else final_stop.name
    end,
    t.started_at,
    t.created_at,
    case
      when live_location.trip_id is null then 'MISSING'
      when live_location.accuracy_meters>200 then 'POOR_ACCURACY'
      when t.status='IN_PROGRESS' and live_location.captured_at<now()-interval '45 seconds' then 'STALE'
      when t.status='ACTIVE_COLLECTING' and live_location.captured_at<now()-interval '60 seconds' then 'STALE'
      else 'FRESH'
    end,
    case when live_location.captured_at is null then null
      else greatest(0,extract(epoch from (now()-live_location.captured_at))::integer) end,
    live_location.accuracy_meters,
    live_location.captured_at,
    (select count(*)::integer from public.support_cases sc where sc.trip_id=t.id and sc.status='OPEN')
  from public.trips t
  join public.routes r on r.id=t.route_id
  join public.drivers d on d.id=t.driver_id
  join public.vehicles v on v.id=t.vehicle_id
  left join public.trip_live_locations live_location on live_location.trip_id=t.id
  left join lateral (
    select rs.name,rs.stop_order
    from public.route_stops rs
    where rs.route_id=t.route_id and rs.stop_order=t.current_stop_order
    limit 1
  ) current_stop on true
  left join lateral (
    select rs.name,rs.stop_order
    from public.seat_requests sr
    join public.route_stops rs on rs.id=sr.pickup_stop_id
    where sr.trip_id=t.id
      and sr.status='HELD'
      and sr.pickup_stop_order>=t.current_stop_order
    group by rs.name,rs.stop_order
    order by rs.stop_order
    limit 1
  ) next_pickup on true
  left join lateral (
    select rs.name,rs.stop_order
    from public.route_stops rs
    where rs.route_id=t.route_id
    order by rs.stop_order desc
    limit 1
  ) final_stop on true
  where t.status in ('ACTIVE_COLLECTING','IN_PROGRESS')
  order by case when t.status='IN_PROGRESS' then 0 else 1 end,t.created_at desc;
end;
$function$;

revoke execute on function public.admin_get_live_trip_operations() from public,anon;
grant execute on function public.admin_get_live_trip_operations() to authenticated;
