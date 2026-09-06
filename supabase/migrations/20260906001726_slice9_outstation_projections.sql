-- Slice 9H: privacy-scoped Outstation projections.

create or replace function private.get_outstation_product_detail(p_product_id uuid)
returns jsonb language sql security definer stable set search_path=''
as $$
  select jsonb_build_object(
    'product_id',p.id,'product_code',p.code,'display_name',p.display_name,
    'public_summary',p.public_summary,'origin_market_id',m.id,'origin_market_name',m.name,
    'rules_version',rv.version_no,
    'max_passengers_per_request',(rv.rules->>'max_passengers_per_request')::int,
    'min_departure_lead_minutes',(rv.rules->>'min_departure_lead_minutes')::int,
    'max_request_horizon_days',(rv.rules->>'max_request_horizon_days')::int
  )
  from public.service_products p
  join public.markets m on m.id=p.market_id
  join public.service_product_rule_versions rv on rv.product_id=p.id and rv.version_no=p.current_rules_version
  where p.id=p_product_id and p.service_type='OUTSTATION'
    and p.status in ('PILOT','ACTIVE') and m.status in ('PILOT','ACTIVE','SCALING');
$$;
revoke all on function private.get_outstation_product_detail(uuid) from public,anon,authenticated;
grant execute on function private.get_outstation_product_detail(uuid) to anon,authenticated;

create or replace function public.get_outstation_product_detail(p_product_id uuid)
returns jsonb language sql security invoker stable set search_path=''
as $$ select private.get_outstation_product_detail(p_product_id); $$;
revoke all on function public.get_outstation_product_detail(uuid) from public,anon,authenticated;
grant execute on function public.get_outstation_product_detail(uuid) to anon,authenticated;
create or replace function private.get_my_outstation_request(p_request_id uuid)
returns jsonb language sql security definer stable set search_path=''
as $$
  select jsonb_build_object(
    'request_id',r.id,'product_id',r.product_id,'status',r.status,
    'origin_market_id',r.origin_market_id,'origin_name',coalesce(ol.name,m.name),
    'destination_location_id',r.destination_location_id,'destination_name',coalesce(dl.name,r.destination_text),
    'destination_text',r.destination_text,'travel_type',r.travel_type,
    'departure_at',r.departure_at,'return_at',r.return_at,'passenger_count',r.passenger_count,
    'passenger_note',r.passenger_note,'recovery_count',r.recovery_count,
    'accepted_agreement_id',r.accepted_agreement_id,
    'quotes',coalesce((
      select jsonb_agg(jsonb_build_object(
        'quote_id',q.id,'revision_id',qr.id,'revision_no',qr.revision_no,
        'driver_name',dp.display_name,'vehicle_model',v.vehicle_model,'vehicle_registration',v.registration_number,
        'total_price_inr',qr.total_price_inr,'includes_tolls',qr.includes_tolls,
        'includes_parking',qr.includes_parking,'commercial_note',qr.commercial_note,'valid_until',qr.valid_until,
        'quote_status',q.status,
        'driver_verified',exists(select 1 from public.verification_records x where x.driver_id=q.driver_id and x.verification_type='DRIVING_LICENCE' and x.status='VERIFIED' and (x.expires_at is null or x.expires_at>now())),
        'vehicle_rc_verified',exists(select 1 from public.verification_records x where x.vehicle_id=qr.vehicle_id and x.verification_type='VEHICLE_RC' and x.status='VERIFIED' and (x.expires_at is null or x.expires_at>now())),
        'vehicle_photos_verified',exists(select 1 from public.verification_records x where x.vehicle_id=qr.vehicle_id and x.verification_type='VEHICLE_PHOTOS' and x.status='VERIFIED' and (x.expires_at is null or x.expires_at>now()))
      ) order by qr.total_price_inr,qr.submitted_at)
      from public.outstation_quotes q
      join public.outstation_quote_revisions qr on qr.quote_id=q.id and qr.revision_no=q.current_revision_no
      join public.drivers d on d.id=q.driver_id join public.profiles dp on dp.id=d.profile_id
      join public.vehicles v on v.id=qr.vehicle_id
      where q.request_id=r.id and q.status in ('ACTIVE','ACCEPTED') and (q.status='ACCEPTED' or qr.valid_until>now())
    ),'[]'::jsonb)
  )
  from public.outstation_requests r
  join public.markets m on m.id=r.origin_market_id
  left join public.locations ol on ol.id=r.origin_location_id
  left join public.locations dl on dl.id=r.destination_location_id
  where r.id=p_request_id and r.passenger_profile_id=auth.uid();
$$;
revoke all on function private.get_my_outstation_request(uuid) from public,anon,authenticated;
grant execute on function private.get_my_outstation_request(uuid) to authenticated;

create or replace function public.get_my_outstation_request(p_request_id uuid)
returns jsonb language sql security invoker stable set search_path=''
as $$ select private.get_my_outstation_request(p_request_id); $$;
revoke all on function public.get_my_outstation_request(uuid) from public,anon,authenticated;
grant execute on function public.get_my_outstation_request(uuid) to authenticated;
create or replace function private.get_outstation_driver_workspace()
returns jsonb language plpgsql security definer stable set search_path=''
as $$
declare
  v_profile uuid:=auth.uid(); v_driver public.drivers%rowtype; v_vehicle public.vehicles%rowtype;
  v_product public.service_products%rowtype; v_result jsonb;
begin
  select * into v_driver from public.drivers d where d.profile_id=v_profile;
  if v_driver.id is null then return null; end if;
  select v.* into v_vehicle from public.driver_active_vehicles av
    join public.vehicles v on v.id=av.vehicle_id where av.driver_id=v_driver.id;
  select p.* into v_product from public.service_products p
    where p.market_id=v_driver.home_market_id and p.service_type='OUTSTATION'
      and p.status in ('PILOT','ACTIVE') order by p.created_at limit 1;
  if v_product.id is null then
    select p.* into v_product from public.service_products p
      where p.service_type='OUTSTATION' and p.status in ('PILOT','ACTIVE') order by p.created_at limit 1;
  end if;

  v_result:=jsonb_build_object(
    'driver_id',v_driver.id,'standing',v_driver.standing,
    'product_id',v_product.id,'product_name',v_product.display_name,
    'preference_enabled',coalesce((select pref.is_enabled from public.driver_product_preferences pref where pref.driver_id=v_driver.id and pref.product_id=v_product.id),false),
    'active_vehicle_id',v_vehicle.id,'active_vehicle_name',case when v_vehicle.id is null then null else concat_ws(' · ',v_vehicle.vehicle_model,v_vehicle.registration_number) end,
    'planned_availability',coalesce((select jsonb_agg(jsonb_build_object(
      'availability_id',pa.id,'market_id',pa.market_id,'market_name',m.name,
      'starts_at',pa.starts_at,'ends_at',pa.ends_at,'status',pa.status
    ) order by pa.starts_at) from public.driver_planned_market_availability pa
      join public.markets m on m.id=pa.market_id
      where pa.driver_id=v_driver.id and pa.status='ACTIVE' and pa.ends_at>now()),'[]'::jsonb),
    'opportunities',coalesce((select jsonb_agg(jsonb_build_object(
      'request_id',r.id,'origin_name',coalesce(ol.name,m.name),'destination_name',coalesce(dl.name,r.destination_text),
      'destination_text',r.destination_text,'travel_type',r.travel_type,'departure_at',r.departure_at,
      'return_at',r.return_at,'passenger_count',r.passenger_count,'passenger_note',r.passenger_note,
      'my_quote_id',q.id,'my_quote_status',q.status,'my_revision_id',qr.id,
      'my_revision_no',qr.revision_no,'my_total_price_inr',qr.total_price_inr,'my_valid_until',qr.valid_until
    ) order by r.departure_at)
      from public.outstation_requests r
      join public.markets m on m.id=r.origin_market_id
      left join public.locations ol on ol.id=r.origin_location_id
      left join public.locations dl on dl.id=r.destination_location_id
      left join public.outstation_driver_ignores ig on ig.request_id=r.id and ig.driver_id=v_driver.id
      left join public.outstation_quotes q on q.request_id=r.id and q.driver_id=v_driver.id
      left join public.outstation_quote_revisions qr on qr.quote_id=q.id and qr.revision_no=q.current_revision_no
      where r.status in ('OPEN','REOPENED') and r.departure_at>now() and ig.request_id is null
        and v_vehicle.id is not null and private.outstation_driver_eligible(r.id,v_driver.id,v_vehicle.id)
    ),'[]'::jsonb),
    'accepted_trips',coalesce((select jsonb_agg(jsonb_build_object(
      'agreement_id',a.id,'request_id',r.id,'ride_id',rd.id,'ride_status',rd.status,
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
      where a.driver_id=v_driver.id and a.status='ACTIVE'
    ),'[]'::jsonb)
  );
  return v_result;
end; $$;
revoke all on function private.get_outstation_driver_workspace() from public,anon,authenticated;
grant execute on function private.get_outstation_driver_workspace() to authenticated;

create or replace function public.get_outstation_driver_workspace()
returns jsonb language sql security invoker stable set search_path=''
as $$ select private.get_outstation_driver_workspace(); $$;
revoke all on function public.get_outstation_driver_workspace() from public,anon,authenticated;
grant execute on function public.get_outstation_driver_workspace() to authenticated;
