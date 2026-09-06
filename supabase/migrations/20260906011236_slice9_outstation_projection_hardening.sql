-- Slice 9K: restore committed trust/contact projection and keep Outstation payment scoped to Outstation trips.

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
        'vehicle_capacity',v.bookable_passenger_capacity,
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
    ),'[]'::jsonb),
    'accepted_agreement',case when r.accepted_agreement_id is null then null else (
      select jsonb_build_object(
        'agreement_id',a.id,'agreement_status',a.status,'total_price_inr',a.total_price_inr,
        'accepted_at',a.accepted_at,'driver_name',dp.display_name,
        'vehicle_model',veh.vehicle_model,'vehicle_registration',veh.registration_number,
        'ride_id',rd.id,'ride_status',rd.status,
        'driver_phone',case when a.status='ACTIVE' and coalesce(rd.status,'')<>'COMPLETED' then dp.phone else null end,
        'driver_verified',not exists(select 1 from (values ('PHONE'),('DRIVING_LICENCE'),('DRIVER_PHOTO')) req(t)
          where not exists(select 1 from public.verification_records vr where vr.driver_id=a.driver_id and vr.verification_type=req.t and vr.status='VERIFIED' and (vr.expires_at is null or vr.expires_at>now()))),
        'vehicle_rc_verified',exists(select 1 from public.verification_records vr where vr.vehicle_id=a.vehicle_id and vr.verification_type='VEHICLE_RC' and vr.status='VERIFIED' and (vr.expires_at is null or vr.expires_at>now())),
        'vehicle_photos_verified',exists(select 1 from public.verification_records vr where vr.vehicle_id=a.vehicle_id and vr.verification_type='VEHICLE_PHOTOS' and vr.status='VERIFIED' and (vr.expires_at is null or vr.expires_at>now()))
      )
      from public.outstation_agreements a
      join public.drivers d on d.id=a.driver_id join public.profiles dp on dp.id=d.profile_id
      join public.vehicles veh on veh.id=a.vehicle_id
      left join public.rides rd on rd.outstation_agreement_id=a.id
      where a.id=r.accepted_agreement_id
    ) end
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
    'vehicle_model',v.vehicle_model,'vehicle_registration',v.registration_number,
    'passenger_name',pp.display_name,
    'passenger_phone',case when a.status='ACTIVE' and coalesce(rd.status,'')<>'COMPLETED' then pp.phone else null end,
    'payment',case when pay.id is null then null else jsonb_build_object(
      'payment_id',pay.id,'status',pay.status,'amount_inr',pay.amount_inr,
      'passenger_marked_paid_at',pay.passenger_marked_paid_at,
      'driver_confirmed_received_at',pay.driver_confirmed_received_at,
      'disputed_at',pay.disputed_at,'dispute_case_id',pay.dispute_case_id
    ) end
  ) order by r.departure_at)
    from public.outstation_agreements a
    join public.outstation_requests r on r.id=a.request_id
    join public.profiles pp on pp.id=r.passenger_profile_id
    join public.markets m on m.id=r.origin_market_id
    left join public.locations ol on ol.id=r.origin_location_id
    left join public.locations dl on dl.id=r.destination_location_id
    join public.vehicles v on v.id=a.vehicle_id
    left join public.rides rd on rd.outstation_agreement_id=a.id
    left join public.ride_bookings b on b.ride_id=rd.id and b.outstation_request_id=r.id
    left join public.payment_acknowledgements pay on pay.ride_booking_id=b.id
    where a.driver_id=v_driver and a.status in ('ACTIVE','COMPLETED') and rd.status is not null
  ),'[]'::jsonb);
end; $$;
revoke all on function private.get_my_outstation_driver_trips() from public,anon,authenticated;
grant execute on function private.get_my_outstation_driver_trips() to authenticated;

create or replace function public.get_my_outstation_driver_trips()
returns jsonb language sql security invoker stable set search_path=''
as $$ select private.get_my_outstation_driver_trips(); $$;
revoke all on function public.get_my_outstation_driver_trips() from public,anon,authenticated;
grant execute on function public.get_my_outstation_driver_trips() to authenticated;
