-- Raahi V2 Prod Version 10: guarded versioned Route Management.
-- Structural route edits are draft-only until an idle-route publish; historical route/stops are never rewritten.

alter table public.routes add column if not exists route_family_id uuid;
alter table public.routes add column if not exists version_no integer;
alter table public.routes add column if not exists version_status text;
alter table public.routes add column if not exists is_current boolean;
alter table public.routes add column if not exists supersedes_route_id uuid references public.routes(id);
alter table public.routes add column if not exists updated_at timestamptz not null default now();
alter table public.routes add column if not exists published_at timestamptz;
alter table public.routes add column if not exists archived_at timestamptz;

update public.routes
set route_family_id=coalesce(route_family_id,id),
    version_no=coalesce(version_no,1),
    version_status=coalesce(version_status,'PUBLISHED'),
    is_current=coalesce(is_current,true),
    published_at=coalesce(published_at,created_at),
    updated_at=coalesce(updated_at,created_at);

alter table public.routes alter column route_family_id set default gen_random_uuid();
alter table public.routes alter column route_family_id set not null;
alter table public.routes alter column version_no set default 1;
alter table public.routes alter column version_no set not null;
alter table public.routes alter column version_status set default 'PUBLISHED';
alter table public.routes alter column version_status set not null;
alter table public.routes alter column is_current set default true;
alter table public.routes alter column is_current set not null;
do $$ begin
  if exists(select 1 from pg_constraint where conrelid='public.routes'::regclass and conname='routes_code_key') then
    alter table public.routes drop constraint routes_code_key;
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.routes'::regclass and conname='routes_version_status_check') then
    alter table public.routes add constraint routes_version_status_check
      check (version_status in ('DRAFT','PUBLISHED','ARCHIVED'));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.routes'::regclass and conname='routes_draft_inactive_check') then
    alter table public.routes add constraint routes_draft_inactive_check
      check (version_status<>'DRAFT' or (is_current=false and is_active=false));
  end if;
end $$;

create unique index if not exists idx_routes_family_version
  on public.routes(route_family_id,version_no);
create unique index if not exists idx_routes_one_draft_per_family
  on public.routes(route_family_id) where version_status='DRAFT';
create unique index if not exists idx_routes_one_current_per_family
  on public.routes(route_family_id) where is_current=true;
create unique index if not exists idx_routes_current_code
  on public.routes(lower(code)) where is_current=true and version_status='PUBLISHED';

create or replace function public.admin_list_route_versions()
returns table(
  route_id uuid, route_family_id uuid, version_no integer, version_status text, is_current boolean,
  code text, direction_label text, from_location_id uuid, from_location_name text,
  to_location_id uuid, to_location_name text, is_active boolean, fare_per_seat integer,
  supersedes_route_id uuid, published_at timestamptz, archived_at timestamptz,
  stop_count integer, stops jsonb, live_trip_count integer, live_queue_count integer, active_demand_count integer
)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select r.id,r.route_family_id,r.version_no,r.version_status,r.is_current,
    r.code,r.direction_label,r.from_location_id,fl.name,r.to_location_id,tl.name,
    r.is_active,r.fare_per_seat,r.supersedes_route_id,r.published_at,r.archived_at,
    (select count(*)::integer from public.route_stops rs where rs.route_id=r.id),
    coalesce((select jsonb_agg(jsonb_build_object('stop_id',rs.id,'stop_order',rs.stop_order,'name',rs.name,'minutes_from_prev',rs.minutes_from_prev) order by rs.stop_order)
      from public.route_stops rs where rs.route_id=r.id),'[]'::jsonb),
    (select count(*)::integer from public.trips t where t.route_id=r.id and t.status in ('ACTIVE_COLLECTING','IN_PROGRESS')),
    (select count(*)::integer from public.driver_queue q where q.route_id=r.id and q.status in ('WAITING','ACTIVE_COLLECTING')),
    (select count(*)::integer from public.demand_intents di where di.route_id=r.id and di.status='ACTIVE')
  from public.routes r
  join public.locations fl on fl.id=r.from_location_id
  join public.locations tl on tl.id=r.to_location_id
  order by r.code,r.route_family_id,r.version_no desc;
end;
$function$;

create or replace function public.admin_create_route_draft(p_base_route_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_base public.routes; v_existing uuid; v_draft uuid; v_version integer;
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  select * into v_base from public.routes where id=p_base_route_id and is_current=true and version_status='PUBLISHED';
  if v_base.id is null then return jsonb_build_object('success',false,'error','Current published route not found'); end if;
  select id into v_existing from public.routes where route_family_id=v_base.route_family_id and version_status='DRAFT' limit 1;
  if v_existing is not null then return jsonb_build_object('success',true,'draft_id',v_existing,'existing',true); end if;
  select coalesce(max(version_no),0)+1 into v_version from public.routes where route_family_id=v_base.route_family_id;
  insert into public.routes(code,from_location_id,to_location_id,direction_label,is_active,fare_per_seat,
    route_family_id,version_no,version_status,is_current,supersedes_route_id,published_at,archived_at)
  values(v_base.code,v_base.from_location_id,v_base.to_location_id,v_base.direction_label,false,v_base.fare_per_seat,
    v_base.route_family_id,v_version,'DRAFT',false,v_base.id,null,null)
  returning id into v_draft;
  insert into public.route_stops(route_id,stop_order,name,minutes_from_prev)
    select v_draft,stop_order,name,minutes_from_prev from public.route_stops where route_id=v_base.id order by stop_order;
  insert into public.route_locations(route_id,location_id)
    select v_draft,location_id from public.route_locations where route_id=v_base.id;
  perform public.record_audit('admin_create_route_draft','routes',v_draft,null,
    jsonb_build_object('base_route_id',v_base.id,'family_id',v_base.route_family_id,'version_no',v_version),null);
  return jsonb_build_object('success',true,'draft_id',v_draft,'version_no',v_version);
end;
$function$;

create or replace function public.admin_create_new_route_draft(
  p_code text,p_from_location_id uuid,p_to_location_id uuid,p_direction_label text,p_fare_per_seat integer default 150
)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_family uuid:=gen_random_uuid(); v_draft uuid; v_from text; v_to text;
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  if length(trim(coalesce(p_code,'')))<2 then return jsonb_build_object('success',false,'error','Route code is required'); end if;
  if length(trim(coalesce(p_direction_label,'')))<3 then return jsonb_build_object('success',false,'error','Direction label is required'); end if;
  if p_fare_per_seat<20 or p_fare_per_seat>5000 then return jsonb_build_object('success',false,'error','Fare must be between ₹20 and ₹5000'); end if;
  if p_from_location_id=p_to_location_id then return jsonb_build_object('success',false,'error','Route endpoints must be different'); end if;
  select name into v_from from public.locations where id=p_from_location_id and is_active=true;
  select name into v_to from public.locations where id=p_to_location_id and is_active=true;
  if v_from is null or v_to is null then return jsonb_build_object('success',false,'error','Active endpoints are required'); end if;
  if exists(select 1 from public.routes where lower(code)=lower(trim(p_code)) and is_current=true and version_status='PUBLISHED') then
    return jsonb_build_object('success',false,'error','Route code is already in use');
  end if;
  insert into public.routes(code,from_location_id,to_location_id,direction_label,is_active,fare_per_seat,
    route_family_id,version_no,version_status,is_current,published_at,archived_at)
  values(upper(trim(p_code)),p_from_location_id,p_to_location_id,trim(p_direction_label),false,p_fare_per_seat,
    v_family,1,'DRAFT',false,null,null)
  returning id into v_draft;
  insert into public.route_locations(route_id,location_id) values(v_draft,p_from_location_id),(v_draft,p_to_location_id);
  insert into public.route_stops(route_id,stop_order,name,minutes_from_prev)
    values(v_draft,1,v_from,0),(v_draft,2,v_to,10);
  perform public.record_audit('admin_create_new_route_draft','routes',v_draft,null,
    jsonb_build_object('family_id',v_family,'code',upper(trim(p_code))),null);
  return jsonb_build_object('success',true,'draft_id',v_draft,'version_no',1);
end;
$function$;

create or replace function public.admin_duplicate_route_as_draft(p_base_route_id uuid,p_new_code text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_base public.routes; v_family uuid:=gen_random_uuid(); v_draft uuid;
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  select * into v_base from public.routes where id=p_base_route_id and is_current=true and version_status='PUBLISHED';
  if v_base.id is null then return jsonb_build_object('success',false,'error','Current published route not found'); end if;
  if length(trim(coalesce(p_new_code,'')))<2 then return jsonb_build_object('success',false,'error','New route code is required'); end if;
  if exists(select 1 from public.routes where lower(code)=lower(trim(p_new_code)) and is_current=true and version_status='PUBLISHED') then
    return jsonb_build_object('success',false,'error','Route code is already in use');
  end if;
  insert into public.routes(code,from_location_id,to_location_id,direction_label,is_active,fare_per_seat,
    route_family_id,version_no,version_status,is_current,supersedes_route_id,published_at,archived_at)
  values(upper(trim(p_new_code)),v_base.from_location_id,v_base.to_location_id,v_base.direction_label,false,v_base.fare_per_seat,
    v_family,1,'DRAFT',false,null,null,null)
  returning id into v_draft;
  insert into public.route_stops(route_id,stop_order,name,minutes_from_prev)
    select v_draft,stop_order,name,minutes_from_prev from public.route_stops where route_id=v_base.id order by stop_order;
  insert into public.route_locations(route_id,location_id)
    select v_draft,location_id from public.route_locations where route_id=v_base.id;
  perform public.record_audit('admin_duplicate_route_as_draft','routes',v_draft,null,
    jsonb_build_object('source_route_id',v_base.id,'family_id',v_family,'code',upper(trim(p_new_code))),null);
  return jsonb_build_object('success',true,'draft_id',v_draft,'version_no',1);
end;
$function$;

create or replace function public.admin_update_route_draft(
  p_route_id uuid,p_code text,p_from_location_id uuid,p_to_location_id uuid,p_direction_label text,p_fare_per_seat integer
)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_route public.routes; v_from text; v_to text;
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  select * into v_route from public.routes where id=p_route_id and version_status='DRAFT' for update;
  if v_route.id is null then return jsonb_build_object('success',false,'error','Editable route draft not found'); end if;
  if length(trim(coalesce(p_code,'')))<2 or length(trim(coalesce(p_direction_label,'')))<3 then
    return jsonb_build_object('success',false,'error','Route code and direction label are required');
  end if;
  if p_fare_per_seat<20 or p_fare_per_seat>5000 then return jsonb_build_object('success',false,'error','Fare must be between ₹20 and ₹5000'); end if;
  if p_from_location_id=p_to_location_id then return jsonb_build_object('success',false,'error','Route endpoints must be different'); end if;
  select name into v_from from public.locations where id=p_from_location_id and is_active=true;
  select name into v_to from public.locations where id=p_to_location_id and is_active=true;
  if v_from is null or v_to is null then return jsonb_build_object('success',false,'error','Active endpoints are required'); end if;
  update public.routes set code=upper(trim(p_code)),from_location_id=p_from_location_id,to_location_id=p_to_location_id,
    direction_label=trim(p_direction_label),fare_per_seat=p_fare_per_seat,updated_at=now() where id=p_route_id;
  delete from public.route_locations where route_id=p_route_id;
  insert into public.route_locations(route_id,location_id) values(p_route_id,p_from_location_id),(p_route_id,p_to_location_id)
    on conflict(route_id,location_id) do nothing;
  perform public.record_audit('admin_update_route_draft','routes',p_route_id,to_jsonb(v_route),
    jsonb_build_object('code',upper(trim(p_code)),'from_location_id',p_from_location_id,'to_location_id',p_to_location_id,
      'direction_label',trim(p_direction_label),'fare_per_seat',p_fare_per_seat),null);
  return jsonb_build_object('success',true);
end;
$function$;

create or replace function public.admin_replace_route_draft_stops(p_route_id uuid,p_stops jsonb)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_route public.routes; v_count integer;
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  select * into v_route from public.routes where id=p_route_id and version_status='DRAFT' for update;
  if v_route.id is null then return jsonb_build_object('success',false,'error','Editable route draft not found'); end if;
  if jsonb_typeof(p_stops)<>'array' then return jsonb_build_object('success',false,'error','Stops must be an ordered list'); end if;
  v_count:=jsonb_array_length(p_stops);
  if v_count<2 or v_count>30 then return jsonb_build_object('success',false,'error','A route must have between 2 and 30 stops'); end if;
  if exists(
    select 1 from jsonb_array_elements(p_stops) elem
    where length(trim(coalesce(elem->>'name','')))<2
       or coalesce(elem->>'minutes_from_prev','0') !~ '^[0-9]+$'
       or coalesce((elem->>'minutes_from_prev')::integer,0)>180
  ) then return jsonb_build_object('success',false,'error','Each stop needs a name and travel minutes between 0 and 180'); end if;
  delete from public.route_stops where route_id=p_route_id;
  insert into public.route_stops(route_id,stop_order,name,minutes_from_prev)
  select p_route_id,ord::integer,trim(elem->>'name'),
    case when ord=1 then 0 else coalesce((elem->>'minutes_from_prev')::integer,0) end
  from jsonb_array_elements(p_stops) with ordinality as x(elem,ord);
  update public.routes set updated_at=now() where id=p_route_id;
  perform public.record_audit('admin_replace_route_draft_stops','routes',p_route_id,null,
    jsonb_build_object('stop_count',v_count),null);
  return jsonb_build_object('success',true,'stop_count',v_count);
end;
$function$;

create or replace function public.admin_publish_route_draft(p_route_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_draft public.routes; v_current public.routes; v_stop_count integer; v_keep_active boolean:=true;
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  select * into v_draft from public.routes where id=p_route_id and version_status='DRAFT' for update;
  if v_draft.id is null then return jsonb_build_object('success',false,'error','Route draft not found'); end if;
  perform pg_advisory_xact_lock(hashtextextended('route-family:'||v_draft.route_family_id::text,0));
  select count(*) into v_stop_count from public.route_stops where route_id=v_draft.id;
  if v_stop_count<2 then return jsonb_build_object('success',false,'error','Add at least two stops before publishing'); end if;
  if exists(select 1 from public.routes r where r.is_current=true and r.version_status='PUBLISHED'
            and r.route_family_id<>v_draft.route_family_id and lower(r.code)=lower(v_draft.code)) then
    return jsonb_build_object('success',false,'error','Another published route already uses this code');
  end if;
  select * into v_current from public.routes
    where route_family_id=v_draft.route_family_id and is_current=true and version_status='PUBLISHED' for update;
  if v_current.id is not null then
    if exists(select 1 from public.trips where route_id=v_current.id and status in('ACTIVE_COLLECTING','IN_PROGRESS')) then
      return jsonb_build_object('success',false,'error','Publish is blocked while this route has a live trip');
    end if;
    if exists(select 1 from public.driver_queue where route_id=v_current.id and status in('WAITING','ACTIVE_COLLECTING')) then
      return jsonb_build_object('success',false,'error','Publish is blocked while drivers are queued on this route');
    end if;
    if exists(select 1 from public.demand_intents where route_id=v_current.id and status='ACTIVE') then
      return jsonb_build_object('success',false,'error','Publish is blocked while active passenger demand exists on this route');
    end if;
    v_keep_active:=v_current.is_active;
    update public.routes set is_active=false,is_current=false,version_status='ARCHIVED',archived_at=now(),updated_at=now()
      where id=v_current.id;
  end if;
  update public.routes set version_status='PUBLISHED',is_current=true,is_active=v_keep_active,
    published_at=now(),archived_at=null,updated_at=now() where id=v_draft.id;
  perform public.record_audit('admin_publish_route_draft','routes',v_draft.id,
    case when v_current.id is null then null else jsonb_build_object('previous_route_id',v_current.id,'previous_version',v_current.version_no) end,
    jsonb_build_object('family_id',v_draft.route_family_id,'version_no',v_draft.version_no,'code',v_draft.code,'active',v_keep_active),null);
  return jsonb_build_object('success',true,'route_id',v_draft.id,'version_no',v_draft.version_no,'is_active',v_keep_active);
end;
$function$;

create or replace function public.admin_discard_route_draft(p_route_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_route public.routes;
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  select * into v_route from public.routes where id=p_route_id and version_status='DRAFT' for update;
  if v_route.id is null then return jsonb_build_object('success',false,'error','Route draft not found'); end if;
  perform public.record_audit('admin_discard_route_draft','routes',p_route_id,to_jsonb(v_route),null,null);
  delete from public.routes where id=p_route_id;
  return jsonb_build_object('success',true);
end;
$function$;

create or replace function public.admin_archive_route(p_route_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_route public.routes;
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  select * into v_route from public.routes where id=p_route_id and is_current=true and version_status='PUBLISHED' for update;
  if v_route.id is null then return jsonb_build_object('success',false,'error','Current published route not found'); end if;
  if exists(select 1 from public.trips where route_id=p_route_id and status in('ACTIVE_COLLECTING','IN_PROGRESS')) then
    return jsonb_build_object('success',false,'error','Cannot archive a route while it has a live trip');
  end if;
  if exists(select 1 from public.driver_queue where route_id=p_route_id and status in('WAITING','ACTIVE_COLLECTING')) then
    return jsonb_build_object('success',false,'error','Cannot archive a route while drivers are queued');
  end if;
  if exists(select 1 from public.demand_intents where route_id=p_route_id and status='ACTIVE') then
    return jsonb_build_object('success',false,'error','Cannot archive a route while active passenger demand exists');
  end if;
  update public.routes set is_active=false,is_current=false,version_status='ARCHIVED',archived_at=now(),updated_at=now()
    where id=p_route_id;
  perform public.record_audit('admin_archive_route','routes',p_route_id,to_jsonb(v_route),
    jsonb_build_object('version_status','ARCHIVED','is_active',false,'is_current',false),null);
  return jsonb_build_object('success',true);
end;
$function$;

create or replace function public.admin_set_route_active(p_route_id uuid,p_is_active boolean)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_route public.routes;
begin
  if auth.uid() is null or not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  select * into v_route from public.routes where id=p_route_id and is_current=true and version_status='PUBLISHED' for update;
  if v_route.id is null then return jsonb_build_object('success',false,'error','Current published route not found'); end if;
  if p_is_active=false and (
    exists(select 1 from public.driver_queue where route_id=p_route_id and status in('WAITING','ACTIVE_COLLECTING')) or
    exists(select 1 from public.trips where route_id=p_route_id and status in('ACTIVE_COLLECTING','IN_PROGRESS'))
  ) then return jsonb_build_object('success',false,'error','Cannot disable a route while it has a live queue or trip'); end if;
  update public.routes set is_active=p_is_active,updated_at=now() where id=p_route_id;
  perform public.record_audit('admin_set_route_active','routes',p_route_id,
    jsonb_build_object('is_active',v_route.is_active),jsonb_build_object('is_active',p_is_active),null);
  return jsonb_build_object('success',true,'is_active',p_is_active);
end;
$function$;

create or replace function public.admin_set_route_fare(p_route_id uuid,p_fare_per_seat integer)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_route public.routes;
begin
  if auth.uid() is null or not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  if p_fare_per_seat is null or p_fare_per_seat<20 or p_fare_per_seat>5000 then
    return jsonb_build_object('success',false,'error','Fare must be between ₹20 and ₹5000 per seat');
  end if;
  select * into v_route from public.routes where id=p_route_id and is_current=true and version_status='PUBLISHED' for update;
  if v_route.id is null then return jsonb_build_object('success',false,'error','Current published route not found'); end if;
  update public.routes set fare_per_seat=p_fare_per_seat,updated_at=now() where id=p_route_id;
  perform public.record_audit('admin_set_route_fare','routes',p_route_id,
    jsonb_build_object('fare_per_seat',v_route.fare_per_seat),jsonb_build_object('fare_per_seat',p_fare_per_seat),
    jsonb_build_object('applies_to','future trips'));
  return jsonb_build_object('success',true,'fare_per_seat',p_fare_per_seat,'applies_to','future trips');
end;
$function$;
create or replace function public.admin_get_route_health()
returns table(
  route_id uuid, route_code text, from_location_name text, to_location_name text, route_active boolean,
  trip_id uuid, trip_status text, driver_name text, vehicle_number text, confirmed integer, held integer,
  available integer, capacity integer, current_stop_name text, waiting_drivers integer, next_driver_name text,
  now_demand integer, planned_demand integer, demand_label text, exception_code text
)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  with current_routes as (
    select * from public.routes where is_current=true and version_status='PUBLISHED'
  ), demand as (
    select r.id as route_id,
      count(di.id) filter(where di.intent_kind='NOW' and di.status='ACTIVE' and di.earliest_at<=now() and di.latest_at>=now())::integer as now_count,
      count(di.id) filter(where di.intent_kind='SCHEDULED' and di.status='ACTIVE' and di.latest_at>=now() and di.earliest_at<=now()+interval '7 days')::integer as planned_count
    from current_routes r left join public.demand_intents di on di.route_id=r.id group by r.id
  ), queue_summary as (
    select r.id as route_id,
      count(dq.id) filter(where dq.status='WAITING')::integer as waiting_count,
      (select d2.display_name from public.driver_queue dq2 join public.drivers d2 on d2.id=dq2.driver_id
       where dq2.route_id=r.id and dq2.status='WAITING' order by dq2.queue_position,dq2.joined_at limit 1) as next_driver_name
    from current_routes r left join public.driver_queue dq on dq.route_id=r.id group by r.id
  )
  select r.id,r.code,fl.name,tl.name,r.is_active,t.id,t.status::text,d.display_name,v.registration_number,
    coalesce(t.confirmed_count,0),coalesce(t.held_count,0),
    case when t.id is null then 0 else t.capacity-t.confirmed_count-t.held_count-t.driver_closed_count end,
    coalesce(t.capacity,0),rs.name,coalesce(qs.waiting_count,0),qs.next_driver_name,
    coalesce(dm.now_count,0),coalesce(dm.planned_count,0),
    case when coalesce(dm.now_count,0)>=4 then 'HIGH' when coalesce(dm.now_count,0)>=2 then 'MEDIUM'
         when coalesce(dm.now_count,0)=1 then 'LOW' else 'NONE' end,
    case when not r.is_active then 'ROUTE_PAUSED'
         when t.id is null and coalesce(dm.now_count,0)>0 and coalesce(qs.waiting_count,0)=0 then 'NO_DRIVER_WITH_DEMAND'
         when t.id is null and coalesce(qs.waiting_count,0)>0 then 'WAITING_DRIVER_NOT_ACTIVATED'
         when t.status='IN_PROGRESS' and coalesce(dm.now_count,0)>0 and coalesce(qs.waiting_count,0)=0 then 'NO_NEXT_DRIVER_WITH_DEMAND'
         else null end
  from current_routes r
  join public.locations fl on fl.id=r.from_location_id
  join public.locations tl on tl.id=r.to_location_id
  left join lateral (
    select t1.* from public.trips t1 where t1.route_id=r.id and t1.status in ('ACTIVE_COLLECTING','IN_PROGRESS')
    order by case when t1.status='ACTIVE_COLLECTING' then 0 else 1 end,t1.created_at desc limit 1
  ) t on true
  left join public.drivers d on d.id=t.driver_id
  left join public.vehicles v on v.id=t.vehicle_id
  left join public.route_stops rs on rs.route_id=t.route_id and rs.stop_order=t.current_stop_order
  left join demand dm on dm.route_id=r.id
  left join queue_summary qs on qs.route_id=r.id
  order by r.code;
end;
$function$;


-- Keep "Ride this route again" pointed at the current published version, while
-- completed-trip details continue to read the exact historical route/stops used.
create or replace function public.get_my_active_request()
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_request public.seat_requests; v_repeat_route_id uuid;
begin
  if auth.uid() is null then return jsonb_build_object('error','Not authenticated'); end if;
  select sr.* into v_request from public.seat_requests sr join public.trips t on t.id=sr.trip_id
  where sr.passenger_id=auth.uid() and sr.status in ('HELD','CONFIRMED')
    and t.status in ('ACTIVE_COLLECTING','IN_PROGRESS')
  order by sr.created_at desc limit 1;
  if v_request.id is not null then
    return public.get_passenger_ride_status(v_request.id)
      || jsonb_build_object('has_active_request',true,'has_completed_trip',false);
  end if;
  select sr.* into v_request from public.seat_requests sr join public.trips t on t.id=sr.trip_id
  where sr.passenger_id=auth.uid() and sr.status='CONFIRMED' and t.status='COMPLETED'
  order by t.completed_at desc nulls last,sr.created_at desc limit 1;
  if v_request.id is null then return jsonb_build_object('has_active_request',false,'has_completed_trip',false); end if;
  select current_route.id into v_repeat_route_id
  from public.trips t
  join public.routes historical_route on historical_route.id=t.route_id
  join public.routes current_route on current_route.route_family_id=historical_route.route_family_id
    and current_route.is_current=true and current_route.version_status='PUBLISHED' and current_route.is_active=true
  where t.id=v_request.trip_id limit 1;
  return public.get_passenger_ride_status(v_request.id)
    || jsonb_build_object('has_active_request',false,'has_completed_trip',true,'repeat_route_id',v_repeat_route_id);
end;
$function$;

revoke all on function public.admin_list_route_versions() from public,anon;
revoke all on function public.admin_create_route_draft(uuid) from public,anon;
revoke all on function public.admin_create_new_route_draft(text,uuid,uuid,text,integer) from public,anon;
revoke all on function public.admin_duplicate_route_as_draft(uuid,text) from public,anon;
revoke all on function public.admin_update_route_draft(uuid,text,uuid,uuid,text,integer) from public,anon;
revoke all on function public.admin_replace_route_draft_stops(uuid,jsonb) from public,anon;
revoke all on function public.admin_publish_route_draft(uuid) from public,anon;
revoke all on function public.admin_discard_route_draft(uuid) from public,anon;
revoke all on function public.admin_archive_route(uuid) from public,anon;

grant execute on function public.admin_list_route_versions() to authenticated;
grant execute on function public.admin_create_route_draft(uuid) to authenticated;
grant execute on function public.admin_create_new_route_draft(text,uuid,uuid,text,integer) to authenticated;
grant execute on function public.admin_duplicate_route_as_draft(uuid,text) to authenticated;
grant execute on function public.admin_update_route_draft(uuid,text,uuid,uuid,text,integer) to authenticated;
grant execute on function public.admin_replace_route_draft_stops(uuid,jsonb) to authenticated;
grant execute on function public.admin_publish_route_draft(uuid) to authenticated;
grant execute on function public.admin_discard_route_draft(uuid) to authenticated;
grant execute on function public.admin_archive_route(uuid) to authenticated;
