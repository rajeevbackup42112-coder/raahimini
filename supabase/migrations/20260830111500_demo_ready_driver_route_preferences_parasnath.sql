-- Demo Ready: add Parasnath -> Madhuban and persistent Driver route-alert preferences.
-- This is additive. It does not change FIFO, queue activation, seat ownership or trip lifecycle.

create table if not exists public.driver_route_preferences (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  route_family_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(driver_id, route_family_id)
);

alter table public.driver_route_preferences enable row level security;
revoke all on table public.driver_route_preferences from public, anon, authenticated, service_role;

create index if not exists idx_driver_route_preferences_family
  on public.driver_route_preferences(route_family_id, driver_id);

drop trigger if exists set_driver_route_preferences_updated_at on public.driver_route_preferences;
create trigger set_driver_route_preferences_updated_at
  before update on public.driver_route_preferences
  for each row execute function public.set_updated_at();

insert into public.locations(name,state,country,is_active)
values ('Parasnath','Jharkhand','India',true),('Madhuban','Jharkhand','India',true)
on conflict(name) do update set is_active=true;
do $seed$
declare
  v_from uuid;
  v_to uuid;
  v_route uuid;
  v_family uuid:=gen_random_uuid();
begin
  select id into v_from from public.locations where name='Parasnath' limit 1;
  select id into v_to from public.locations where name='Madhuban' limit 1;

  select id into v_route
  from public.routes
  where upper(code)='PM-01' and is_current=true and version_status='PUBLISHED'
  limit 1;

  if v_route is null then
    insert into public.routes(
      code,from_location_id,to_location_id,direction_label,is_active,fare_per_seat,
      route_family_id,version_no,version_status,is_current,published_at,archived_at
    ) values (
      'PM-01',v_from,v_to,'Parasnath → Madhuban',true,150,
      v_family,1,'PUBLISHED',true,now(),null
    ) returning id into v_route;

    insert into public.route_locations(route_id,location_id)
      values(v_route,v_from),(v_route,v_to)
      on conflict(route_id,location_id) do nothing;
    insert into public.route_stops(route_id,stop_order,name,minutes_from_prev)
      values(v_route,1,'Parasnath',0),(v_route,2,'Madhuban',46);
  end if;
end;
$seed$;

-- Preserve each existing active Driver's most recently served route as the initial alert preference.
insert into public.driver_route_preferences(driver_id,route_family_id)
select d.id,last_route.route_family_id
from public.drivers d
join lateral (
  select r.route_family_id
  from public.driver_queue q
  join public.routes r on r.id=q.route_id
  where q.driver_id=d.id
  order by q.joined_at desc
  limit 1
) last_route on true
where d.is_active=true
on conflict(driver_id,route_family_id) do nothing;

create or replace function public.get_my_driver_route_preferences()
returns table(
  route_id uuid,
  route_family_id uuid,
  route_code text,
  direction_label text,
  from_location_id uuid,
  from_location_name text,
  to_location_id uuid,
  to_location_name text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v_driver_id uuid;
begin
  select d.id into v_driver_id
  from public.drivers d
  join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;

  if v_driver_id is null then return; end if;

  return query
  select r.id,r.route_family_id,r.code,r.direction_label,
         r.from_location_id,fl.name,r.to_location_id,tl.name
  from public.driver_route_preferences pref
  join public.routes r on r.route_family_id=pref.route_family_id
    and r.is_current=true and r.version_status='PUBLISHED' and r.is_active=true
  join public.locations fl on fl.id=r.from_location_id and fl.is_active=true
  join public.locations tl on tl.id=r.to_location_id and tl.is_active=true
  where pref.driver_id=v_driver_id
  order by r.code;
end;
$function$;

create or replace function public.set_my_driver_route_preference(
  p_route_id uuid,
  p_subscribed boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
  v_family uuid;
  v_preference_id uuid;
begin
  select d.id into v_driver_id
  from public.drivers d
  join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;

  if v_driver_id is null then
    return jsonb_build_object('success',false,'error','Active Driver access required');
  end if;

  select r.route_family_id into v_family
  from public.routes r
  where r.id=p_route_id and r.is_current=true and r.version_status='PUBLISHED' and r.is_active=true;

  if v_family is null then
    return jsonb_build_object('success',false,'error','Current active route not found');
  end if;

  if p_subscribed then
    insert into public.driver_route_preferences(driver_id,route_family_id)
    values(v_driver_id,v_family)
    on conflict(driver_id,route_family_id) do update set updated_at=now()
    returning id into v_preference_id;
  else
    select id into v_preference_id
    from public.driver_route_preferences
    where driver_id=v_driver_id and route_family_id=v_family;

    delete from public.driver_route_preferences
    where driver_id=v_driver_id and route_family_id=v_family;
  end if;

  perform public.record_audit(
    case when p_subscribed then 'driver_route_alert_subscribe' else 'driver_route_alert_unsubscribe' end,
    'driver_route_preferences',v_preference_id,null,
    jsonb_build_object('route_id',p_route_id,'route_family_id',v_family,'subscribed',p_subscribed),null
  );

  return jsonb_build_object('success',true,'subscribed',p_subscribed,'route_family_id',v_family);
end;
$function$;

revoke all on function public.get_my_driver_route_preferences() from public, anon, service_role;
revoke all on function public.set_my_driver_route_preference(uuid,boolean) from public, anon, service_role;
grant execute on function public.get_my_driver_route_preferences() to authenticated;
grant execute on function public.set_my_driver_route_preference(uuid,boolean) to authenticated;
