create table if not exists public.trip_live_locations (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision not null check (accuracy_meters > 0 and accuracy_meters <= 5000),
  captured_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.trip_live_locations enable row level security;
revoke all on table public.trip_live_locations from public, anon, authenticated, service_role;

create or replace function public.update_driver_trip_location(
  p_trip_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_captured_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
  v_trip public.trips;
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Not authenticated'); end if;
  select d.id into v_driver_id from public.drivers d where d.profile_id=auth.uid() and d.is_active=true;
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Active driver account required'); end if;

  select * into v_trip from public.trips where id=p_trip_id for update;
  if v_trip.id is null or v_trip.driver_id<>v_driver_id then return jsonb_build_object('success',false,'error','Trip not found or not authorized'); end if;
  if v_trip.status not in ('ACTIVE_COLLECTING','IN_PROGRESS') then return jsonb_build_object('success',false,'error','Location is accepted only for a live collecting or in-progress trip'); end if;
  if p_latitude is null or p_latitude < -90 or p_latitude > 90 or p_longitude is null or p_longitude < -180 or p_longitude > 180 then return jsonb_build_object('success',false,'error','Invalid location coordinates'); end if;
  if p_accuracy_meters is null or p_accuracy_meters<=0 or p_accuracy_meters>5000 then return jsonb_build_object('success',false,'error','Invalid location accuracy'); end if;
  if p_captured_at < now()-interval '2 minutes' or p_captured_at > now()+interval '30 seconds' then return jsonb_build_object('success',false,'error','Location fix is stale or invalid'); end if;

  insert into public.trip_live_locations(trip_id,driver_id,latitude,longitude,accuracy_meters,captured_at,updated_at)
  values(p_trip_id,v_driver_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at,now())
  on conflict(trip_id) do update set driver_id=excluded.driver_id,latitude=excluded.latitude,longitude=excluded.longitude,accuracy_meters=excluded.accuracy_meters,captured_at=excluded.captured_at,updated_at=now();

  return jsonb_build_object('success',true,'usable_for_start',p_accuracy_meters<=200,'captured_at',p_captured_at);
end;
$function$;

create or replace function public.get_active_trip_location(p_trip_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_trip public.trips;
  v_location public.trip_live_locations;
  v_driver_id uuid;
  v_allowed boolean:=false;
begin
  if auth.uid() is null then return jsonb_build_object('has_location',false,'error','Not authenticated'); end if;
  select * into v_trip from public.trips where id=p_trip_id;
  if v_trip.id is null or v_trip.status<>'IN_PROGRESS' then return jsonb_build_object('has_location',false); end if;

  if public.is_admin() then v_allowed:=true;
  else
    select d.id into v_driver_id from public.drivers d where d.profile_id=auth.uid();
    if v_driver_id=v_trip.driver_id then v_allowed:=true; end if;
    if exists(select 1 from public.seat_requests sr where sr.trip_id=p_trip_id and sr.passenger_id=auth.uid() and sr.status in ('HELD','CONFIRMED')) then v_allowed:=true; end if;
  end if;
  if not v_allowed then return jsonb_build_object('has_location',false,'error','Not authorized for this trip'); end if;

  select * into v_location from public.trip_live_locations where trip_id=p_trip_id;
  if v_location.trip_id is null then return jsonb_build_object('has_location',false); end if;
  return jsonb_build_object('has_location',true,'latitude',v_location.latitude,'longitude',v_location.longitude,'accuracy_meters',v_location.accuracy_meters,'captured_at',v_location.captured_at,'is_fresh',v_location.captured_at>=now()-interval '45 seconds');
end;
$function$;

create or replace function public.start_trip(p_trip_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
  v_trip public.trips;
  v_location public.trip_live_locations;
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Not authenticated'); end if;
  select id into v_driver_id from public.drivers where profile_id=auth.uid();
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Not a driver'); end if;

  select * into v_trip from public.trips where id=p_trip_id for update;
  if v_trip.id is null or v_trip.driver_id<>v_driver_id then return jsonb_build_object('success',false,'error','Trip not found or not authorized'); end if;
  if v_trip.status='IN_PROGRESS' then return jsonb_build_object('success',true,'already_started',true); end if;
  if v_trip.status<>'ACTIVE_COLLECTING' then return jsonb_build_object('success',false,'error','Trip is not in ACTIVE_COLLECTING state'); end if;
  if v_trip.held_count>0 then return jsonb_build_object('success',false,'error',format('Cannot start: %s held request(s) must be resolved',v_trip.held_count)); end if;
  if v_trip.confirmed_count+v_trip.driver_closed_count<>v_trip.capacity then return jsonb_build_object('success',false,'error',format('Cannot start: confirmed(%s) + closed(%s) must equal capacity(%s)',v_trip.confirmed_count,v_trip.driver_closed_count,v_trip.capacity)); end if;

  select * into v_location from public.trip_live_locations where trip_id=p_trip_id and driver_id=v_driver_id;
  if v_location.trip_id is null or v_location.captured_at<now()-interval '60 seconds' or v_location.accuracy_meters>200 then
    return jsonb_build_object('success',false,'error','Turn on location and get a usable GPS fix before starting the trip','location_required',true);
  end if;

  update public.trips set status='IN_PROGRESS',started_at=now() where id=p_trip_id;
  update public.driver_queue set status='IN_PROGRESS' where id=v_trip.queue_entry_id;
  perform public.record_audit('start_trip','trips',p_trip_id,null,jsonb_build_object('sequential_dispatch',true,'next_driver_deferred_until_completion',true,'gps_fix_required',true,'gps_accuracy_meters',v_location.accuracy_meters));
  return jsonb_build_object('success',true,'next_driver_deferred_until_completion',true,'gps_active',true);
end;
$function$;

create or replace function public.cleanup_trip_live_location_on_terminal_state()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status in ('COMPLETED','CANCELLED') and old.status is distinct from new.status then delete from public.trip_live_locations where trip_id=new.id; end if;
  return new;
end;
$function$;

drop trigger if exists trg_cleanup_trip_live_location on public.trips;
create trigger trg_cleanup_trip_live_location after update of status on public.trips for each row execute function public.cleanup_trip_live_location_on_terminal_state();

revoke execute on function public.update_driver_trip_location(uuid,double precision,double precision,double precision,timestamptz) from public, anon, service_role;
revoke execute on function public.get_active_trip_location(uuid) from public, anon, service_role;
revoke execute on function public.cleanup_trip_live_location_on_terminal_state() from public, anon, authenticated, service_role;
grant execute on function public.update_driver_trip_location(uuid,double precision,double precision,double precision,timestamptz) to authenticated;
grant execute on function public.get_active_trip_location(uuid) to authenticated;
