create or replace function public.admin_get_route_health()
returns table(
  route_id uuid,
  route_code text,
  from_location_name text,
  to_location_name text,
  route_active boolean,
  trip_id uuid,
  trip_status text,
  driver_name text,
  vehicle_number text,
  confirmed integer,
  held integer,
  available integer,
  capacity integer,
  current_stop_name text,
  waiting_drivers integer,
  next_driver_name text,
  now_demand integer,
  planned_demand integer,
  demand_label text,
  exception_code text
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  with demand as (
    select
      r.id as route_id,
      count(di.id) filter (
        where di.intent_kind='NOW' and di.status='ACTIVE'
          and di.earliest_at<=now() and di.latest_at>=now()
      )::integer as now_count,
      count(di.id) filter (
        where di.intent_kind='SCHEDULED' and di.status='ACTIVE'
          and di.latest_at>=now() and di.earliest_at<=now()+interval '7 days'
      )::integer as planned_count
    from public.routes r
    left join public.demand_intents di on di.route_id=r.id
    group by r.id
  ), queue_summary as (
    select
      r.id as route_id,
      count(dq.id) filter (where dq.status='WAITING')::integer as waiting_count,
      (
        select d2.display_name
        from public.driver_queue dq2
        join public.drivers d2 on d2.id=dq2.driver_id
        where dq2.route_id=r.id and dq2.status='WAITING'
        order by dq2.queue_position, dq2.joined_at
        limit 1
      ) as next_driver_name
    from public.routes r
    left join public.driver_queue dq on dq.route_id=r.id
    group by r.id
  )
  select
    r.id,
    r.code,
    fl.name,
    tl.name,
    r.is_active,
    t.id,
    t.status::text,
    d.display_name,
    v.registration_number,
    coalesce(t.confirmed_count,0),
    coalesce(t.held_count,0),
    case when t.id is null then 0 else t.capacity-t.confirmed_count-t.held_count-t.driver_closed_count end,
    coalesce(t.capacity,0),
    rs.name,
    coalesce(qs.waiting_count,0),
    qs.next_driver_name,
    coalesce(dm.now_count,0),
    coalesce(dm.planned_count,0),
    case
      when coalesce(dm.now_count,0)>=4 then 'HIGH'
      when coalesce(dm.now_count,0)>=2 then 'MEDIUM'
      when coalesce(dm.now_count,0)=1 then 'LOW'
      else 'NONE'
    end,
    case
      when not r.is_active then 'ROUTE_PAUSED'
      when t.id is null and coalesce(dm.now_count,0)>0 and coalesce(qs.waiting_count,0)=0 then 'NO_DRIVER_WITH_DEMAND'
      when t.id is null and coalesce(qs.waiting_count,0)>0 then 'WAITING_DRIVER_NOT_ACTIVATED'
      when t.status='IN_PROGRESS' and coalesce(dm.now_count,0)>0 and coalesce(qs.waiting_count,0)=0 then 'NO_NEXT_DRIVER_WITH_DEMAND'
      else null
    end
  from public.routes r
  join public.locations fl on fl.id=r.from_location_id
  join public.locations tl on tl.id=r.to_location_id
  left join lateral (
    select t1.*
    from public.trips t1
    where t1.route_id=r.id and t1.status in ('ACTIVE_COLLECTING','IN_PROGRESS')
    order by case when t1.status='ACTIVE_COLLECTING' then 0 else 1 end, t1.created_at desc
    limit 1
  ) t on true
  left join public.drivers d on d.id=t.driver_id
  left join public.vehicles v on v.id=t.vehicle_id
  left join public.route_stops rs on rs.route_id=t.route_id and rs.stop_order=t.current_stop_order
  left join demand dm on dm.route_id=r.id
  left join queue_summary qs on qs.route_id=r.id
  order by r.code;
end;
$function$;

revoke execute on function public.admin_get_route_health() from public, anon, service_role;
grant execute on function public.admin_get_route_health() to authenticated;
