-- Raahi V13 pre-go-live hardening
-- Expired demand must never block future route publishing or archiving.

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
    (select count(*)::integer from public.demand_intents di where di.route_id=r.id and di.status='ACTIVE' and di.latest_at>=now())
  from public.routes r
  join public.locations fl on fl.id=r.from_location_id
  join public.locations tl on tl.id=r.to_location_id
  order by r.code,r.route_family_id,r.version_no desc;
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
    if exists(select 1 from public.demand_intents where route_id=v_current.id and status='ACTIVE' and latest_at>=now()) then
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
  if exists(select 1 from public.demand_intents where route_id=p_route_id and status='ACTIVE' and latest_at>=now()) then
    return jsonb_build_object('success',false,'error','Cannot archive a route while active passenger demand exists');
  end if;
  update public.routes set is_active=false,is_current=false,version_status='ARCHIVED',archived_at=now(),updated_at=now()
    where id=p_route_id;
  perform public.record_audit('admin_archive_route','routes',p_route_id,to_jsonb(v_route),
    jsonb_build_object('version_status','ARCHIVED','is_active',false,'is_current',false),null);
  return jsonb_build_object('success',true);
end;
$function$;

revoke all on function public.admin_list_route_versions() from public, anon;
revoke all on function public.admin_publish_route_draft(uuid) from public, anon;
revoke all on function public.admin_archive_route(uuid) from public, anon;
grant execute on function public.admin_list_route_versions() to authenticated;
grant execute on function public.admin_publish_route_draft(uuid) to authenticated;
grant execute on function public.admin_archive_route(uuid) to authenticated;
