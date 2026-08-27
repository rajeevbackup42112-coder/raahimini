-- Raahi V2 Prod Version 9: Admin Dashboard + Registered Users read projections.
-- Additive/read-only only: no ride, seat, FIFO, GPS or phone-verification mutation.

create or replace function public.admin_get_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_active_trips integer;
  v_collecting_cars integer;
  v_held_requests integer;
  v_held_seats integer;
  v_waiting_drivers integer;
  v_open_support integer;
  v_warnings integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  select count(*) into v_active_trips from public.trips where status='IN_PROGRESS';
  select count(*) into v_collecting_cars from public.trips where status='ACTIVE_COLLECTING';
  select count(*), coalesce(sum(seat_count),0) into v_held_requests, v_held_seats
    from public.seat_requests where status='HELD';
  select count(*) into v_waiting_drivers from public.driver_queue where status='WAITING';
  select count(*) into v_open_support from public.support_cases where status='OPEN';
  select count(*) into v_warnings from public.admin_get_route_health() where exception_code is not null;

  return jsonb_build_object(
    'active_trips',v_active_trips,
    'collecting_cars',v_collecting_cars,
    'held_requests',v_held_requests,
    'held_seats',v_held_seats,
    'waiting_drivers',v_waiting_drivers,
    'open_support_cases',v_open_support,
    'operational_warnings',v_warnings
  );
end;
$function$;

create or replace function public.admin_list_registered_users()
returns table(
  profile_id uuid,
  display_name text,
  email text,
  phone text,
  phone_verified boolean,
  role text,
  is_restricted boolean,
  restriction_reason text,
  joined_at timestamptz,
  driver_id uuid,
  driver_active boolean,
  driver_phone text,
  trips_completed integer,
  registration_number text,
  vehicle_model text,
  vehicle_type text,
  capacity integer,
  operational_state text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  return query
  select
    p.id,
    p.display_name,
    u.email::text,
    coalesce(nullif(p.phone,''),u.phone)::text,
    (u.phone_confirmed_at is not null),
    p.role::text,
    p.is_restricted,
    p.restriction_reason,
    p.created_at,
    d.id,
    d.is_active,
    d.phone,
    coalesce(d.trips_completed,0),
    v.registration_number,
    v.vehicle_model,
    v.vehicle_type,
    v.capacity,
    case
      when d.id is not null and exists(select 1 from public.trips t where t.driver_id=d.id and t.status='IN_PROGRESS') then 'DRIVING'
      when d.id is not null and exists(select 1 from public.trips t where t.driver_id=d.id and t.status='ACTIVE_COLLECTING') then 'COLLECTING'
      when d.id is not null and exists(select 1 from public.driver_queue q where q.driver_id=d.id and q.status='WAITING') then 'WAITING_QUEUE'
      when exists(select 1 from public.seat_requests sr join public.trips t on t.id=sr.trip_id where sr.passenger_id=p.id and sr.status='CONFIRMED' and t.status='IN_PROGRESS') then 'ON_TRIP'
      when exists(select 1 from public.seat_requests sr join public.trips t on t.id=sr.trip_id where sr.passenger_id=p.id and sr.status='CONFIRMED' and t.status='ACTIVE_COLLECTING') then 'ABOARD_WAITING'
      when exists(select 1 from public.seat_requests sr where sr.passenger_id=p.id and sr.status='HELD') then 'WAITING_PICKUP'
      else 'IDLE'
    end::text
  from public.profiles p
  join auth.users u on u.id=p.id
  left join public.drivers d on d.profile_id=p.id
  left join public.vehicles v on v.id=d.vehicle_id
  order by p.created_at desc, p.display_name nulls last, u.email;
end;
$function$;

create or replace function public.admin_get_recent_activity(p_limit integer default 12)
returns table(
  activity_id uuid,
  action text,
  actor_name text,
  record_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  return query
  select a.id, a.action, coalesce(p.display_name,'System')::text, a.record_id, a.created_at
  from public.audit_log a
  left join public.profiles p on p.id=a.actor_id
  where a.action in (
    'admin_onboard_driver','admin_restrict_user','admin_unrestrict_user',
    'admin_grant_admin','admin_revoke_admin','admin_resolve_support_case',
    'start_trip','complete_trip','driver_cancel_trip'
  )
  order by a.created_at desc
  limit greatest(1,least(coalesce(p_limit,12),50));
end;
$function$;

revoke all on function public.admin_get_dashboard_summary() from public, anon;
revoke all on function public.admin_list_registered_users() from public, anon;
revoke all on function public.admin_get_recent_activity(integer) from public, anon;
grant execute on function public.admin_get_dashboard_summary() to authenticated;
grant execute on function public.admin_list_registered_users() to authenticated;
grant execute on function public.admin_get_recent_activity(integer) to authenticated;
