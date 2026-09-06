-- Slice 9G: scoped Outstation Passenger and Driver projections.

create or replace function private.get_my_outstation_request(p_request_id uuid)
returns jsonb language plpgsql security definer stable set search_path=''
as $$
declare v_profile uuid:=auth.uid(); v_req public.outstation_requests%rowtype; v_result jsonb;
begin
  if v_profile is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_req from public.outstation_requests
   where id=p_request_id and passenger_profile_id=v_profile;
  if v_req.id is null then return null; end if;

  select jsonb_build_object(
    'request_id',v_req.id,'status',v_req.status,'travel_type',v_req.travel_type,
    'departure_at',v_req.departure_at,'return_at',v_req.return_at,
    'passenger_count',v_req.passenger_count,'passenger_note',v_req.passenger_note,
    'destination_text',v_req.destination_text,'recovery_count',v_req.recovery_count,
    'origin_name',coalesce(ol.name,m.name),'destination_name',coalesce(dl.name,v_req.destination_text),
    'product_id',v_req.product_id,
    'quotes',coalesce((select jsonb_agg(jsonb_build_object(
      'quote_id',q.id,'revision_id',qr.id,'revision_no',qr.revision_no,
      'total_price_inr',qr.total_price_inr,'includes_tolls',qr.includes_tolls,
      'includes_parking',qr.includes_parking,'commercial_note',qr.commercial_note,
      'valid_until',qr.valid_until,'driver_name',dp.display_name,
      'vehicle_model',veh.vehicle_model,'vehicle_registration',veh.registration_number,
      'vehicle_capacity',veh.bookable_passenger_capacity,
      'driver_verified',private.outstation_driver_eligible(v_req.id,q.driver_id,qr.vehicle_id)
    ) order by qr.total_price_inr,q.updated_at)
      from public.outstation_quotes q
      join public.outstation_quote_revisions qr on qr.quote_id=q.id and qr.revision_no=q.current_revision_no
      join public.drivers d on d.id=q.driver_id join public.profiles dp on dp.id=d.profile_id
      join public.vehicles veh on veh.id=qr.vehicle_id
      where q.request_id=v_req.id and q.status='ACTIVE' and qr.valid_until>now()),'[]'::jsonb),    'accepted_agreement',(
      select jsonb_build_object(
        'agreement_id',a.id,'agreement_status',a.status,'total_price_inr',a.total_price_inr,
        'accepted_at',a.accepted_at,'driver_name',dp.display_name,
        'vehicle_model',veh.vehicle_model,'vehicle_registration',veh.registration_number,
        'ride_id',rd.id,'ride_status',rd.status,
        'driver_phone',case when a.status='ACTIVE' then dp.phone else null end,
        'driver_verified',not exists(select 1 from (values ('PHONE'),('DRIVING_LICENCE'),('DRIVER_PHOTO')) req(t)
          where not exists(select 1 from public.verification_records vr where vr.driver_id=a.driver_id and vr.verification_type=req.t and vr.status='VERIFIED' and (vr.expires_at is null or vr.expires_at>now()))),
        'vehicle_rc_verified',exists(select 1 from public.verification_records vr where vr.vehicle_id=a.vehicle_id and vr.verification_type='VEHICLE_RC' and vr.status='VERIFIED' and (vr.expires_at is null or vr.expires_at>now())),
        'vehicle_photos_verified',exists(select 1 from public.verification_records vr where vr.vehicle_id=a.vehicle_id and vr.verification_type='VEHICLE_PHOTOS' and vr.status='VERIFIED' and (vr.expires_at is null or vr.expires_at>now()))
      )
      from public.outstation_agreements a
      join public.drivers d on d.id=a.driver_id join public.profiles dp on dp.id=d.profile_id
      join public.vehicles veh on veh.id=a.vehicle_id
      left join public.rides rd on rd.outstation_agreement_id=a.id
      where a.id=v_req.accepted_agreement_id
    )
  ) into v_result
  from public.markets m
  left join public.locations ol on ol.id=v_req.origin_location_id
  left join public.locations dl on dl.id=v_req.destination_location_id
  where m.id=v_req.origin_market_id;
  return v_result;
end; $$;
revoke all on function private.get_my_outstation_request(uuid) from public,anon,authenticated;
grant execute on function private.get_my_outstation_request(uuid) to authenticated;
create or replace function public.get_my_outstation_request(p_request_id uuid)
returns jsonb language sql security invoker stable set search_path=''
as $$ select private.get_my_outstation_request(p_request_id); $$;
revoke all on function public.get_my_outstation_request(uuid) from public,anon,authenticated;
grant execute on function public.get_my_outstation_request(uuid) to authenticated;
create or replace function private.get_driver_outstation_workspace()
returns jsonb language plpgsql security definer stable set search_path=''
as $$
declare v_profile uuid:=auth.uid(); v_driver uuid; v_vehicle uuid; v_result jsonb;
begin
  select d.id,av.vehicle_id into v_driver,v_vehicle
    from public.drivers d left join public.driver_active_vehicles av on av.driver_id=d.id
   where d.profile_id=v_profile;
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;

  select jsonb_build_object(
    'driver_id',v_driver,'active_vehicle_id',v_vehicle,
    'products',coalesce((select jsonb_agg(jsonb_build_object(
      'product_id',p.id,'product_name',p.display_name,'market_id',p.market_id,
      'market_name',m.name,'is_enabled',coalesce(pref.is_enabled,false)
    ) order by p.display_name)
      from public.service_products p join public.markets m on m.id=p.market_id
      left join public.driver_product_preferences pref on pref.product_id=p.id and pref.driver_id=v_driver
      where p.service_type='OUTSTATION' and p.status in ('PILOT','ACTIVE') and m.status in ('PILOT','ACTIVE','SCALING')),'[]'::jsonb),
    'planned_availability',coalesce((select jsonb_agg(jsonb_build_object(
      'availability_id',pa.id,'market_id',pa.market_id,'market_name',m.name,
      'starts_at',pa.starts_at,'ends_at',pa.ends_at,'status',pa.status
    ) order by pa.starts_at)
      from public.driver_planned_market_availability pa join public.markets m on m.id=pa.market_id
      where pa.driver_id=v_driver and pa.status='ACTIVE' and pa.ends_at>now()),'[]'::jsonb),    'opportunities',coalesce((select jsonb_agg(jsonb_build_object(
      'request_id',r.id,'product_id',r.product_id,'origin_market_id',r.origin_market_id,
      'origin_name',coalesce(ol.name,m.name),'destination_name',coalesce(dl.name,r.destination_text),
      'destination_text',r.destination_text,'travel_type',r.travel_type,
      'departure_at',r.departure_at,'return_at',r.return_at,'passenger_count',r.passenger_count,
      'passenger_note',r.passenger_note,'request_status',r.status,
      'own_quote',case when q.id is null then null else jsonb_build_object(
        'quote_id',q.id,'status',q.status,'current_revision_no',q.current_revision_no,
        'revision_id',qr.id,'total_price_inr',qr.total_price_inr,
        'includes_tolls',qr.includes_tolls,'includes_parking',qr.includes_parking,
        'commercial_note',qr.commercial_note,'valid_until',qr.valid_until) end
    ) order by r.departure_at,r.created_at)
      from public.outstation_requests r
      join public.markets m on m.id=r.origin_market_id
      left join public.locations ol on ol.id=r.origin_location_id
      left join public.locations dl on dl.id=r.destination_location_id
      left join public.outstation_quotes q on q.request_id=r.id and q.driver_id=v_driver
      left join public.outstation_quote_revisions qr on qr.quote_id=q.id and qr.revision_no=q.current_revision_no
      where r.status in ('OPEN','REOPENED') and r.departure_at>now()
        and v_vehicle is not null and private.outstation_driver_eligible(r.id,v_driver,v_vehicle)
        and not exists(select 1 from public.outstation_driver_ignores i where i.request_id=r.id and i.driver_id=v_driver)
    ),'[]'::jsonb),    'active_agreements',coalesce((select jsonb_agg(jsonb_build_object(
      'agreement_id',a.id,'request_id',r.id,'ride_id',rd.id,'ride_status',rd.status,
      'origin_name',coalesce(ol.name,m.name),'destination_name',coalesce(dl.name,r.destination_text),
      'travel_type',r.travel_type,'departure_at',r.departure_at,'return_at',r.return_at,
      'passenger_count',r.passenger_count,'total_price_inr',a.total_price_inr,
      'vehicle_id',a.vehicle_id,'vehicle_model',veh.vehicle_model,'vehicle_registration',veh.registration_number,
      'passenger_name',pp.display_name,'passenger_phone',pp.phone
    ) order by r.departure_at)
      from public.outstation_agreements a
      join public.outstation_requests r on r.id=a.request_id
      join public.markets m on m.id=r.origin_market_id
      left join public.locations ol on ol.id=r.origin_location_id
      left join public.locations dl on dl.id=r.destination_location_id
      join public.vehicles veh on veh.id=a.vehicle_id
      join public.profiles pp on pp.id=r.passenger_profile_id
      left join public.rides rd on rd.outstation_agreement_id=a.id
      where a.driver_id=v_driver and a.status='ACTIVE'
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;
revoke all on function private.get_driver_outstation_workspace() from public,anon,authenticated;
grant execute on function private.get_driver_outstation_workspace() to authenticated;
create or replace function public.get_driver_outstation_workspace()
returns jsonb language sql security invoker stable set search_path=''
as $$ select private.get_driver_outstation_workspace(); $$;
revoke all on function public.get_driver_outstation_workspace() from public,anon,authenticated;
grant execute on function public.get_driver_outstation_workspace() to authenticated;
