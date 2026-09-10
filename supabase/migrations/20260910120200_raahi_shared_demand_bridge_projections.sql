-- Role-safe Raahi Shared projections and Product-OFF discovery semantics.

create or replace function private.get_driver_shared_demand()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_driver uuid:=private.current_driver_id();
  v_market uuid;
  v_result jsonb;
begin
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  select om.market_id into v_market from public.driver_operating_markets om where om.driver_id=v_driver;
  if v_market is null then return '[]'::jsonb; end if;

  if not exists(
    select 1 from public.service_products p
     where p.market_id=v_market and p.service_type='RAAHI_TRIP'
       and p.status in ('PILOT','ACTIVE') and private.product_feature_enabled(p.id)
  ) then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'origin_location_id',q.origin_location_id,
    'origin_name',q.origin_name,
    'destination_location_id',q.destination_location_id,
    'destination_name',q.destination_name,
    'request_count',q.request_count,
    'seat_demand',q.seat_demand,
    'earliest_departure_at',q.earliest_departure_at,
    'latest_window_end_at',q.latest_window_end_at,
    'oldest_request_at',q.oldest_request_at
  ) order by q.oldest_request_at,q.origin_name,q.destination_name),'[]'::jsonb)
  into v_result
  from (
    select
      t.origin_location_id,o.name origin_name,
      t.destination_location_id,d.name destination_name,
      count(*)::integer request_count,
      sum(t.seat_count)::integer seat_demand,
      min(t.desired_departure_at) earliest_departure_at,
      max(t.desired_window_end_at) latest_window_end_at,
      min(t.created_at) oldest_request_at
    from public.travel_intents t
    join public.locations o on o.id=t.origin_location_id
    join public.locations d on d.id=t.destination_location_id
    where t.intent_kind='SHARED_REQUEST'
      and t.status='ACTIVE'
      and t.acceptable_service_type in ('ANY','RAAHI_TRIP')
      and t.origin_market_id=v_market
      and t.desired_window_end_at>now()
      and not exists(
        select 1 from public.shared_trip_matches sm
         where sm.travel_intent_id=t.id and sm.status='OFFERED' and sm.expires_at>now()
      )
    group by t.origin_location_id,o.name,t.destination_location_id,d.name
  ) q;
  return v_result;
end; $$;
revoke all on function private.get_driver_shared_demand() from public,anon,authenticated;
grant execute on function private.get_driver_shared_demand() to authenticated;

create or replace function public.get_driver_shared_demand()
returns jsonb language sql stable security invoker set search_path=''
as $$ select private.get_driver_shared_demand(); $$;
revoke all on function public.get_driver_shared_demand() from public,anon,authenticated;
grant execute on function public.get_driver_shared_demand() to authenticated;

create or replace function private.get_my_shared_requests()
returns jsonb language sql stable security definer set search_path=''
as $$
select coalesce(jsonb_agg(jsonb_build_object(
  'intent_id',t.id,
  'status',t.status,
  'origin_location_id',t.origin_location_id,
  'origin_name',o.name,
  'destination_location_id',t.destination_location_id,
  'destination_name',d.name,
  'desired_departure_at',t.desired_departure_at,
  'desired_window_end_at',t.desired_window_end_at,
  'seat_count',t.seat_count,
  'notification_interest',t.notification_interest,
  'created_at',t.created_at,
  'driver_offer_ready',exists(
    select 1 from public.shared_trip_matches x
     where x.travel_intent_id=t.id and x.status='OFFERED' and x.expires_at>now()
  ),
  'offers',coalesce((
    select jsonb_agg(jsonb_build_object(
      'match_id',sm.id,
      'match_status',case when sm.status='OFFERED' and sm.expires_at<=now() then 'EXPIRED' else sm.status end,
      'offering_id',sm.offering_id,
      'protected_seats',sm.seat_count,
      'price_per_seat_inr',sm.price_per_seat_inr,
      'total_price_inr',sm.seat_count*sm.price_per_seat_inr,
      'offered_at',sm.offered_at,
      'expires_at',sm.expires_at,
      'departure_at',tr.departure_at,
      'return_departure_at',tr.return_departure_at,
      'trip_status',tr.status,
      'driver_name',coalesce(dp.display_name,'Driver'),
      'vehicle_model',veh.vehicle_model,
      'vehicle_registration',veh.registration_number,
      'trust',private.carpool_trust_json(tr.driver_id,tr.vehicle_id),
      'trip_booking_id',sm.trip_booking_id,
      'trip_booking_status',tb.status,
      'ride_id',tr.ride_id,
      'ride_status',rd.status
    ) order by sm.offered_at desc)
    from public.shared_trip_matches sm
    join public.trip_offerings tr on tr.id=sm.offering_id
    join public.drivers dr on dr.id=tr.driver_id
    join public.profiles dp on dp.id=dr.profile_id
    join public.vehicles veh on veh.id=tr.vehicle_id
    left join public.trip_bookings tb on tb.id=sm.trip_booking_id
    left join public.rides rd on rd.id=tr.ride_id
    where sm.travel_intent_id=t.id
  ),'[]'::jsonb)
) order by t.created_at desc),'[]'::jsonb)
from public.travel_intents t
join public.locations o on o.id=t.origin_location_id
join public.locations d on d.id=t.destination_location_id
where t.passenger_profile_id=auth.uid() and t.intent_kind='SHARED_REQUEST';
$$;
revoke all on function private.get_my_shared_requests() from public,anon,authenticated;
grant execute on function private.get_my_shared_requests() to authenticated;

create or replace function public.get_my_shared_requests()
returns jsonb language sql stable security invoker set search_path=''
as $$ select private.get_my_shared_requests(); $$;
revoke all on function public.get_my_shared_requests() from public,anon,authenticated;
grant execute on function public.get_my_shared_requests() to authenticated;

-- Trip discovery is a new-commitment surface: disabled Products must disappear.
create or replace function private.filter_enabled_trip_discovery(p_items jsonb)
returns jsonb language sql stable security definer set search_path=''
as $$
select coalesce(jsonb_agg(x.item order by x.ord),'[]'::jsonb)
from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) with ordinality x(item,ord)
join public.service_products p on p.id=(x.item->>'product_id')::uuid
where private.product_feature_enabled(p.id);
$$;
revoke all on function private.filter_enabled_trip_discovery(jsonb) from public,anon,authenticated;

create or replace function public.get_trip_discovery(p_origin_location_id uuid default null)
returns jsonb language sql stable security invoker set search_path=''
as $$ select private.filter_enabled_trip_discovery(private.get_trip_discovery(p_origin_location_id)); $$;
revoke all on function public.get_trip_discovery(uuid) from public,anon,authenticated;
grant execute on function public.get_trip_discovery(uuid) to authenticated,service_role;
