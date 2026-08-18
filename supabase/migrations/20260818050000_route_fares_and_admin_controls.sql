-- RAAHI MINI — ROUTE FARES + SAFE ROUTE ADMIN CONTROLS
-- Fare is a route setting but is snapshotted onto each trip so an admin fare
-- change never alters the amount shown for a car that is already collecting.

alter table public.routes
  add column if not exists fare_per_seat integer not null default 150;

alter table public.trips
  add column if not exists fare_per_seat integer not null default 150;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='routes_fare_per_seat_check' and conrelid='public.routes'::regclass
  ) then
    alter table public.routes add constraint routes_fare_per_seat_check check (fare_per_seat between 20 and 5000);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='trips_fare_per_seat_check' and conrelid='public.trips'::regclass
  ) then
    alter table public.trips add constraint trips_fare_per_seat_check check (fare_per_seat between 20 and 5000);
  end if;
end $$;

update public.trips t
set fare_per_seat=r.fare_per_seat
from public.routes r
where r.id=t.route_id;

create or replace function public.set_trip_fare_snapshot()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  select r.fare_per_seat into new.fare_per_seat
  from public.routes r
  where r.id=new.route_id;
  if new.fare_per_seat is null then
    raise exception 'Route fare is not configured';
  end if;
  return new;
end;
$$;

revoke all on function public.set_trip_fare_snapshot() from public, anon, authenticated;

drop trigger if exists trg_trip_fare_snapshot on public.trips;
create trigger trg_trip_fare_snapshot
before insert on public.trips
for each row execute function public.set_trip_fare_snapshot();

-- Public route discovery includes the stable route fare.
drop function if exists public.get_routes_for_location(uuid);
create function public.get_routes_for_location(p_location_id uuid)
returns table(
  route_id uuid,
  route_code text,
  from_location_name text,
  to_location_name text,
  direction_label text,
  fare_per_seat integer,
  has_active_car boolean,
  active_car_status text,
  available_seats integer
)
language plpgsql
stable security definer
set search_path=public
as $$
begin
  return query
  select
    r.id,
    r.code,
    fl.name,
    tl.name,
    r.direction_label,
    r.fare_per_seat,
    (t.id is not null),
    t.status::text,
    coalesce(t.capacity-t.confirmed_count-t.held_count-t.driver_closed_count,0)
  from public.routes r
  join public.route_locations rl on rl.route_id=r.id and rl.location_id=p_location_id
  join public.locations fl on fl.id=r.from_location_id
  join public.locations tl on tl.id=r.to_location_id
  left join public.trips t on t.route_id=r.id and t.status='ACTIVE_COLLECTING'
  where r.is_active=true
  order by r.code asc;
end;
$$;
revoke all on function public.get_routes_for_location(uuid) from public;
grant execute on function public.get_routes_for_location(uuid) to anon, authenticated;

create or replace function public.get_public_active_car(p_route_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path=public
as $$
declare
  v_trip public.trips;
  v_driver public.drivers;
  v_vehicle public.vehicles;
  v_stops jsonb;
  v_available integer;
begin
  select * into v_trip
  from public.trips
  where route_id=p_route_id and status='ACTIVE_COLLECTING'
  order by created_at desc
  limit 1;

  if v_trip.id is null then
    return jsonb_build_object('has_active_car',false);
  end if;

  select * into v_driver from public.drivers where id=v_trip.driver_id;
  select * into v_vehicle from public.vehicles where id=v_trip.vehicle_id;
  v_available:=v_trip.capacity-v_trip.confirmed_count-v_trip.held_count-v_trip.driver_closed_count;

  select jsonb_agg(
    jsonb_build_object(
      'stop_id',rs.id,
      'stop_order',rs.stop_order,
      'name',rs.name,
      'is_current',rs.stop_order=v_trip.current_stop_order,
      'is_passed',rs.stop_order<v_trip.current_stop_order,
      'eta_minutes',case
        when rs.stop_order<v_trip.current_stop_order then null
        when rs.stop_order=v_trip.current_stop_order then 0
        else (
          select coalesce(sum(rs2.minutes_from_prev),0)
          from public.route_stops rs2
          where rs2.route_id=v_trip.route_id
            and rs2.stop_order>v_trip.current_stop_order
            and rs2.stop_order<=rs.stop_order
        )
      end
    ) order by rs.stop_order
  ) into v_stops
  from public.route_stops rs
  where rs.route_id=v_trip.route_id;

  return jsonb_build_object(
    'has_active_car',true,
    'trip_id',v_trip.id,
    'route_id',v_trip.route_id,
    'status',v_trip.status,
    'fare_per_seat',v_trip.fare_per_seat,
    'driver_display_name',v_driver.display_name,
    'vehicle_type',v_vehicle.vehicle_type,
    'vehicle_model',v_vehicle.vehicle_model,
    'vehicle_number',v_vehicle.registration_number,
    'capacity',v_trip.capacity,
    'confirmed_count',v_trip.confirmed_count,
    'held_count',v_trip.held_count,
    'driver_closed_count',v_trip.driver_closed_count,
    'available_count',v_available,
    'current_stop_order',v_trip.current_stop_order,
    'current_stop_name',(select name from public.route_stops where route_id=v_trip.route_id and stop_order=v_trip.current_stop_order limit 1),
    'stops',coalesce(v_stops,'[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_public_active_car(uuid) from public;
grant execute on function public.get_public_active_car(uuid) to anon, authenticated;

create or replace function public.get_driver_active_car()
returns jsonb
language plpgsql
stable security definer
set search_path=public
as $$
declare
  v_driver_id uuid;
  v_trip public.trips;
  v_vehicle public.vehicles;
  v_route public.routes;
  v_from_loc public.locations;
  v_to_loc public.locations;
  v_requests jsonb;
  v_stops jsonb;
  v_available integer;
  v_departure_eligible boolean;
begin
  if auth.uid() is null then return jsonb_build_object('error','Not authenticated'); end if;
  select d.id into v_driver_id
  from public.drivers d
  join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and p.role='driver' and p.is_restricted=false;
  if v_driver_id is null then return jsonb_build_object('error','Active driver account required'); end if;

  select * into v_trip
  from public.trips
  where driver_id=v_driver_id and status in('ACTIVE_COLLECTING','IN_PROGRESS')
  order by created_at desc limit 1;
  if v_trip.id is null then return jsonb_build_object('has_active_trip',false); end if;

  select * into v_vehicle from public.vehicles where id=v_trip.vehicle_id;
  select * into v_route from public.routes where id=v_trip.route_id;
  select * into v_from_loc from public.locations where id=v_route.from_location_id;
  select * into v_to_loc from public.locations where id=v_route.to_location_id;
  v_available:=v_trip.capacity-v_trip.confirmed_count-v_trip.held_count-v_trip.driver_closed_count;
  v_departure_eligible:=(v_trip.held_count=0 and v_trip.confirmed_count+v_trip.driver_closed_count=v_trip.capacity);

  select jsonb_agg(jsonb_build_object(
    'request_id',sr.id,
    'passenger_display_name',p.display_name,
    'phone_masked',case when length(p.phone)>=10 then '+91 '||left(p.phone,2)||'xxx xx'||right(p.phone,4) else 'N/A' end,
    'pickup_stop_name',rs.name,
    'pickup_stop_order',sr.pickup_stop_order,
    'seat_count',sr.seat_count,
    'status',sr.status,
    'amount_due',sr.seat_count*v_trip.fare_per_seat
  ) order by sr.created_at asc) into v_requests
  from public.seat_requests sr
  join public.profiles p on p.id=sr.passenger_id
  join public.route_stops rs on rs.id=sr.pickup_stop_id
  where sr.trip_id=v_trip.id and sr.status in('HELD','CONFIRMED');

  select jsonb_agg(jsonb_build_object(
    'stop_id',rs.id,
    'stop_order',rs.stop_order,
    'name',rs.name,
    'is_current',rs.stop_order=v_trip.current_stop_order,
    'is_passed',rs.stop_order<v_trip.current_stop_order,
    'eta_minutes',case
      when rs.stop_order<v_trip.current_stop_order then null
      when rs.stop_order=v_trip.current_stop_order then 0
      else (select coalesce(sum(rs2.minutes_from_prev),0) from public.route_stops rs2 where rs2.route_id=v_trip.route_id and rs2.stop_order>v_trip.current_stop_order and rs2.stop_order<=rs.stop_order)
    end
  ) order by rs.stop_order) into v_stops
  from public.route_stops rs where rs.route_id=v_trip.route_id;

  return jsonb_build_object(
    'has_active_trip',true,
    'trip_id',v_trip.id,
    'route_id',v_trip.route_id,
    'route_code',v_route.code,
    'route_label',v_route.direction_label,
    'from_location',v_from_loc.name,
    'to_location',v_to_loc.name,
    'status',v_trip.status,
    'fare_per_seat',v_trip.fare_per_seat,
    'vehicle_type',v_vehicle.vehicle_type,
    'vehicle_model',v_vehicle.vehicle_model,
    'vehicle_number',v_vehicle.registration_number,
    'capacity',v_trip.capacity,
    'confirmed_count',v_trip.confirmed_count,
    'held_count',v_trip.held_count,
    'driver_closed_count',v_trip.driver_closed_count,
    'available_count',v_available,
    'current_stop_order',v_trip.current_stop_order,
    'current_stop_name',(select name from public.route_stops where route_id=v_trip.route_id and stop_order=v_trip.current_stop_order limit 1),
    'departure_eligible',v_departure_eligible,
    'passenger_requests',coalesce(v_requests,'[]'::jsonb),
    'stops',coalesce(v_stops,'[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_driver_active_car() from public, anon;
grant execute on function public.get_driver_active_car() to authenticated;

create or replace function public.admin_set_route_fare(p_route_id uuid,p_fare_per_seat integer)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_route public.routes;
begin
  if auth.uid() is null or not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  if p_fare_per_seat is null or p_fare_per_seat<20 or p_fare_per_seat>5000 then return jsonb_build_object('success',false,'error','Fare must be between ₹20 and ₹5000 per seat'); end if;
  select * into v_route from public.routes where id=p_route_id for update;
  if v_route.id is null then return jsonb_build_object('success',false,'error','Route not found'); end if;
  update public.routes set fare_per_seat=p_fare_per_seat where id=p_route_id;
  perform public.record_audit('admin_set_route_fare','routes',p_route_id,jsonb_build_object('fare_per_seat',v_route.fare_per_seat),jsonb_build_object('fare_per_seat',p_fare_per_seat),jsonb_build_object('applies_to','future trips'));
  return jsonb_build_object('success',true,'fare_per_seat',p_fare_per_seat,'applies_to','future trips');
end;
$$;

create or replace function public.admin_set_route_active(p_route_id uuid,p_is_active boolean)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_route public.routes;
begin
  if auth.uid() is null or not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  select * into v_route from public.routes where id=p_route_id for update;
  if v_route.id is null then return jsonb_build_object('success',false,'error','Route not found'); end if;
  if p_is_active=false and (
    exists(select 1 from public.driver_queue where route_id=p_route_id and status in('WAITING','ACTIVE_COLLECTING')) or
    exists(select 1 from public.trips where route_id=p_route_id and status in('ACTIVE_COLLECTING','IN_PROGRESS'))
  ) then
    return jsonb_build_object('success',false,'error','Cannot disable a route while it has a live queue or trip');
  end if;
  update public.routes set is_active=p_is_active where id=p_route_id;
  perform public.record_audit('admin_set_route_active','routes',p_route_id,jsonb_build_object('is_active',v_route.is_active),jsonb_build_object('is_active',p_is_active),null);
  return jsonb_build_object('success',true,'is_active',p_is_active);
end;
$$;

revoke all on function public.admin_set_route_fare(uuid,integer) from public, anon;
revoke all on function public.admin_set_route_active(uuid,boolean) from public, anon;
grant execute on function public.admin_set_route_fare(uuid,integer), public.admin_set_route_active(uuid,boolean) to authenticated;
