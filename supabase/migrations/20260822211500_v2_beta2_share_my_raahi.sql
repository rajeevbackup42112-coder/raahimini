create table if not exists public.trip_share_links (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.seat_requests(id) on delete cascade,
  passenger_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists idx_trip_share_links_request on public.trip_share_links(request_id);
create index if not exists idx_trip_share_links_trip on public.trip_share_links(trip_id);
alter table public.trip_share_links enable row level security;
revoke all on table public.trip_share_links from public, anon, authenticated, service_role;

create or replace function public.create_trip_share_link(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','extensions'
as $function$
declare
  v_request public.seat_requests;
  v_trip public.trips;
  v_token text;
  v_hash text;
  v_link_id uuid;
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Authentication required'); end if;
  select * into v_request from public.seat_requests where id=p_request_id and passenger_id=auth.uid();
  if v_request.id is null then return jsonb_build_object('success',false,'error','Ride request not found'); end if;
  if v_request.status<>'CONFIRMED' then return jsonb_build_object('success',false,'error','Share My Raahi is available after your seat is confirmed'); end if;
  select * into v_trip from public.trips where id=v_request.trip_id;
  if v_trip.id is null or v_trip.status not in ('ACTIVE_COLLECTING','IN_PROGRESS') then return jsonb_build_object('success',false,'error','This trip is no longer shareable'); end if;

  update public.trip_share_links set revoked_at=now() where request_id=p_request_id and revoked_at is null;
  v_token:=encode(extensions.gen_random_bytes(32),'hex');
  v_hash:=encode(extensions.digest(convert_to(v_token,'UTF8'),'sha256'),'hex');
  insert into public.trip_share_links(request_id,passenger_id,trip_id,token_hash,expires_at)
  values(p_request_id,auth.uid(),v_trip.id,v_hash,now()+interval '12 hours') returning id into v_link_id;
  perform public.record_audit('create_trip_share_link','trip_share_links',v_link_id,null,jsonb_build_object('trip_id',v_trip.id,'request_id',p_request_id),null);
  return jsonb_build_object('success',true,'token',v_token,'link_id',v_link_id);
end;
$function$;

create or replace function public.revoke_trip_share_link(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_count integer;
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Authentication required'); end if;
  if not exists(select 1 from public.seat_requests sr where sr.id=p_request_id and sr.passenger_id=auth.uid()) then return jsonb_build_object('success',false,'error','Ride request not found'); end if;
  update public.trip_share_links set revoked_at=now() where request_id=p_request_id and passenger_id=auth.uid() and revoked_at is null;
  get diagnostics v_count=row_count;
  return jsonb_build_object('success',true,'revoked_count',v_count);
end;
$function$;

create or replace function public.get_shared_trip(p_token text)
returns jsonb language plpgsql stable security definer set search_path to 'public','extensions'
as $function$
declare
  v_hash text;
  v_link public.trip_share_links;
  v_request public.seat_requests;
  v_trip public.trips;
  v_driver public.drivers;
  v_vehicle public.vehicles;
  v_passenger public.profiles;
  v_route public.routes;
  v_pickup public.route_stops;
  v_location public.trip_live_locations;
  v_stops jsonb;
begin
  if p_token is null or length(p_token)<32 or length(p_token)>256 then return jsonb_build_object('valid',false); end if;
  v_hash:=encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
  select * into v_link from public.trip_share_links where token_hash=v_hash and revoked_at is null and expires_at>now();
  if v_link.id is null then return jsonb_build_object('valid',false); end if;

  select * into v_request from public.seat_requests where id=v_link.request_id;
  select * into v_trip from public.trips where id=v_link.trip_id;
  if v_request.id is null or v_trip.id is null then return jsonb_build_object('valid',false); end if;
  select * into v_driver from public.drivers where id=v_trip.driver_id;
  select * into v_vehicle from public.vehicles where id=v_trip.vehicle_id;
  select * into v_passenger from public.profiles where id=v_link.passenger_id;
  select * into v_route from public.routes where id=v_trip.route_id;
  select * into v_pickup from public.route_stops where id=v_request.pickup_stop_id;

  select jsonb_agg(jsonb_build_object('name',rs.name,'stop_order',rs.stop_order,'is_passed',rs.stop_order<v_trip.current_stop_order,'is_current',rs.stop_order=v_trip.current_stop_order) order by rs.stop_order)
  into v_stops from public.route_stops rs where rs.route_id=v_trip.route_id;
  if v_trip.status='IN_PROGRESS' then select * into v_location from public.trip_live_locations where trip_id=v_trip.id; end if;

  return jsonb_build_object(
    'valid',true,'passenger_name',v_passenger.display_name,'driver_name',v_driver.display_name,
    'vehicle_model',v_vehicle.vehicle_model,'vehicle_number',v_vehicle.registration_number,
    'route_code',v_route.code,'route_label',v_route.direction_label,'pickup_point',v_pickup.name,
    'trip_status',v_trip.status,'current_stop_order',v_trip.current_stop_order,'started_at',v_trip.started_at,
    'stops',coalesce(v_stops,'[]'::jsonb),
    'location',case when v_location.trip_id is not null then jsonb_build_object('latitude',v_location.latitude,'longitude',v_location.longitude,'accuracy_meters',v_location.accuracy_meters,'captured_at',v_location.captured_at,'is_fresh',v_location.captured_at>=now()-interval '45 seconds') else null end,
    'expires_at',v_link.expires_at
  );
end;
$function$;

create or replace function public.expire_trip_share_links_on_terminal_state()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if old.status is distinct from new.status then
    if new.status='COMPLETED' then update public.trip_share_links set expires_at=least(expires_at,now()+interval '30 minutes') where trip_id=new.id and revoked_at is null;
    elsif new.status='CANCELLED' then update public.trip_share_links set expires_at=now() where trip_id=new.id and revoked_at is null;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_expire_trip_share_links on public.trips;
create trigger trg_expire_trip_share_links after update of status on public.trips for each row execute function public.expire_trip_share_links_on_terminal_state();

revoke execute on function public.create_trip_share_link(uuid) from public, anon, service_role;
revoke execute on function public.revoke_trip_share_link(uuid) from public, anon, service_role;
revoke execute on function public.get_shared_trip(text) from public, service_role;
revoke execute on function public.expire_trip_share_links_on_terminal_state() from public, anon, authenticated, service_role;
grant execute on function public.create_trip_share_link(uuid) to authenticated;
grant execute on function public.revoke_trip_share_link(uuid) to authenticated;
grant execute on function public.get_shared_trip(text) to anon, authenticated;
