-- Extend Driver trust to Outstation quote participants and add Admin observation.
create or replace function public.can_view_driver_trust(p_driver_id uuid)
returns boolean language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return false; end if;
  if public.is_admin() then return true; end if;
  if exists(select 1 from public.drivers d where d.id=p_driver_id and d.profile_id=auth.uid()) then return true; end if;
  if exists(
    select 1 from public.seat_requests sr
    join public.trips t on t.id=sr.trip_id
    where sr.passenger_id=auth.uid() and t.driver_id=p_driver_id and sr.status='CONFIRMED'
  ) then return true; end if;
  if exists(
    select 1 from public.outstation_requests r
    join public.outstation_quotes q on q.request_id=r.id
    where r.passenger_id=auth.uid() and q.driver_id=p_driver_id
      and r.status in ('OPEN','ACCEPTED') and q.status in ('OFFERED','ACCEPTED')
      and (q.status='ACCEPTED' or q.expires_at>now())
  ) then return true; end if;
  return false;
end;
$function$;

create or replace function public.admin_get_outstation_marketplace()
returns table(
  request_id uuid,passenger_name text,passenger_phone text,origin_name text,destination_text text,travel_type text,
  departure_at timestamptz,return_at timestamptz,passenger_count integer,effective_status text,quote_count bigint,
  accepted_driver_name text,accepted_driver_phone text,accepted_price integer,accepted_vehicle_number text,created_at timestamptz
)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then return; end if;
  return query
  select r.id,p.display_name,p.phone,l.name,r.destination_text,r.travel_type,r.departure_at,r.return_at,r.passenger_count,
    case when r.status='OPEN' and r.departure_at<=now() then 'EXPIRED' else r.status end,
    (select count(*) from public.outstation_quotes qx where qx.request_id=r.id and qx.status in ('OFFERED','ACCEPTED') and (qx.status='ACCEPTED' or qx.expires_at>now())),
    d.display_name,d.phone,q.total_price,q.vehicle_number,r.created_at
  from public.outstation_requests r
  join public.profiles p on p.id=r.passenger_id
  join public.locations l on l.id=r.origin_location_id
  left join public.outstation_quotes q on q.id=r.accepted_quote_id
  left join public.drivers d on d.id=q.driver_id
  order by case when r.status='OPEN' and r.departure_at>now() then 0 when r.status='ACCEPTED' then 1 else 2 end,r.departure_at,r.created_at desc;
end;
$function$;

revoke all on function public.can_view_driver_trust(uuid) from public,anon,service_role;
revoke all on function public.admin_get_outstation_marketplace() from public,anon,service_role;
grant execute on function public.can_view_driver_trust(uuid) to authenticated;
grant execute on function public.admin_get_outstation_marketplace() to authenticated;
