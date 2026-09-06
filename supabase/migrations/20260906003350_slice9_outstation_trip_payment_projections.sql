-- Slice 9J: live Outstation catalog plus scoped trip/payment projections.

create or replace function private.get_live_outstation_products()
returns jsonb language sql security definer stable set search_path=''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'product_id',p.id,'product_code',p.code,'display_name',p.display_name,
    'public_summary',p.public_summary,'origin_market_id',m.id,'origin_market_name',m.name,
    'rules_version',p.current_rules_version
  ) order by m.name,p.display_name),'[]'::jsonb)
  from public.service_products p join public.markets m on m.id=p.market_id
  where p.service_type='OUTSTATION' and p.status in ('PILOT','ACTIVE')
    and m.status in ('PILOT','ACTIVE','SCALING');
$$;
revoke all on function private.get_live_outstation_products() from public,anon,authenticated;
grant execute on function private.get_live_outstation_products() to anon,authenticated;
create or replace function public.get_live_outstation_products()
returns jsonb language sql security invoker stable set search_path=''
as $$ select private.get_live_outstation_products(); $$;
revoke all on function public.get_live_outstation_products() from public,anon,authenticated;
grant execute on function public.get_live_outstation_products() to anon,authenticated;

create or replace function private.get_my_outstation_trip(p_request_id uuid)
returns jsonb language sql security definer stable set search_path=''
as $$
  select jsonb_build_object(
    'request_id',r.id,'request_status',r.status,'agreement_id',a.id,'agreement_status',a.status,
    'ride_id',rd.id,'ride_status',rd.status,'booking_id',b.id,'booking_status',b.status,
    'return_status',b.return_status,'return_not_before',rd.return_not_before,
    'return_boarding_deadline',rd.return_boarding_deadline,
    'total_price_inr',a.total_price_inr,'driver_name',dp.display_name,
    'vehicle_model',v.vehicle_model,'vehicle_registration',v.registration_number,
    'payment',case when pay.id is null then null else jsonb_build_object(
      'payment_id',pay.id,'status',pay.status,'amount_inr',pay.amount_inr,
      'passenger_marked_paid_at',pay.passenger_marked_paid_at,
      'driver_confirmed_received_at',pay.driver_confirmed_received_at,
      'disputed_at',pay.disputed_at,'dispute_case_id',pay.dispute_case_id
    ) end
  )
  from public.outstation_requests r
  join public.outstation_agreements a on a.id=r.accepted_agreement_id
  join public.drivers d on d.id=a.driver_id join public.profiles dp on dp.id=d.profile_id
  join public.vehicles v on v.id=a.vehicle_id
  left join public.rides rd on rd.outstation_agreement_id=a.id
  left join public.ride_bookings b on b.ride_id=rd.id and b.outstation_request_id=r.id
  left join public.payment_acknowledgements pay on pay.ride_booking_id=b.id
  where r.id=p_request_id and r.passenger_profile_id=auth.uid();
$$;
revoke all on function private.get_my_outstation_trip(uuid) from public,anon,authenticated;
grant execute on function private.get_my_outstation_trip(uuid) to authenticated;
create or replace function public.get_my_outstation_trip(p_request_id uuid)
returns jsonb language sql security invoker stable set search_path=''
as $$ select private.get_my_outstation_trip(p_request_id); $$;
revoke all on function public.get_my_outstation_trip(uuid) from public,anon,authenticated;
grant execute on function public.get_my_outstation_trip(uuid) to authenticated;

create or replace function private.get_my_outstation_driver_trips()
returns jsonb language plpgsql security definer stable set search_path='' as $$
declare v_driver uuid:=private.current_driver_id();
begin
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'agreement_id',a.id,'agreement_status',a.status,'request_id',r.id,
    'ride_id',rd.id,'ride_status',rd.status,'booking_id',b.id,'booking_status',b.status,
    'return_status',b.return_status,'return_not_before',rd.return_not_before,
    'return_boarding_deadline',rd.return_boarding_deadline,
    'origin_name',coalesce(ol.name,m.name),'destination_name',coalesce(dl.name,r.destination_text),
    'travel_type',r.travel_type,'departure_at',r.departure_at,'return_at',r.return_at,
    'passenger_count',r.passenger_count,'total_price_inr',a.total_price_inr,
    'vehicle_model',v.vehicle_model,'vehicle_registration',v.registration_number
  ) order by r.departure_at)
    from public.outstation_agreements a
    join public.outstation_requests r on r.id=a.request_id
    join public.markets m on m.id=r.origin_market_id
    left join public.locations ol on ol.id=r.origin_location_id
    left join public.locations dl on dl.id=r.destination_location_id
    join public.vehicles v on v.id=a.vehicle_id
    left join public.rides rd on rd.outstation_agreement_id=a.id
    left join public.ride_bookings b on b.ride_id=rd.id and b.outstation_request_id=r.id
    where a.driver_id=v_driver and a.status in ('ACTIVE','COMPLETED')
      and rd.status is not null
  ),'[]'::jsonb);
end; $$;
revoke all on function private.get_my_outstation_driver_trips() from public,anon,authenticated;
grant execute on function private.get_my_outstation_driver_trips() to authenticated;
create or replace function public.get_my_outstation_driver_trips()
returns jsonb language sql security invoker stable set search_path=''
as $$ select private.get_my_outstation_driver_trips(); $$;
revoke all on function public.get_my_outstation_driver_trips() from public,anon,authenticated;
grant execute on function public.get_my_outstation_driver_trips() to authenticated;