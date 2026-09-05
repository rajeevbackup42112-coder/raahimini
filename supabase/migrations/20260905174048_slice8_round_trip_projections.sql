-- Slice 8D: Round Trip state in Passenger and Driver scoped projections.

create or replace function private.get_my_fixed_request(p_request_id uuid)
returns jsonb language sql security definer stable set search_path='' as $$
  select jsonb_build_object(
    'request_id',r.id,'product_id',r.product_id,'service_type',p.service_type,
    'status',r.status,'seat_count',r.seat_count,'fare_per_seat_inr',r.fare_per_seat_inr,
    'total_fare_inr',r.total_fare_inr,'queued_at',r.queued_at,'cancelled_at',r.cancelled_at,
    'origin_name',o.name,'destination_name',dest.name,'product_name',p.display_name,
    'rules_version',r.product_rules_version,
    'return_wait_minutes',nullif(rv.rules->>'return_wait_minutes','')::integer,
    'ride_id',ride.id,'ride_status',ride.status,'matched_at',ride.matched_at,
    'return_not_before',ride.return_not_before,'return_boarding_deadline',ride.return_boarding_deadline,
    'return_status',b.return_status,
    'driver_name',dp.display_name,'vehicle_model',v.vehicle_model,'vehicle_registration',v.registration_number,
    'trust',case when ride.id is null then null else jsonb_build_object(
      'driver_verified',exists(select 1 from public.verification_records vr where vr.driver_id=ride.driver_id and vr.verification_type='DRIVING_LICENCE' and vr.status='VERIFIED' and (vr.expires_at is null or vr.expires_at>now())),
      'vehicle_rc_verified',exists(select 1 from public.verification_records vr where vr.vehicle_id=ride.vehicle_id and vr.verification_type='VEHICLE_RC' and vr.status='VERIFIED' and (vr.expires_at is null or vr.expires_at>now())),
      'vehicle_photos_verified',exists(select 1 from public.verification_records vr where vr.vehicle_id=ride.vehicle_id and vr.verification_type='VEHICLE_PHOTOS' and vr.status='VERIFIED' and (vr.expires_at is null or vr.expires_at>now()))
    ) end
  )
  from public.fixed_passenger_requests r
  join public.service_products p on p.id=r.product_id
  join public.service_product_rule_versions rv on rv.product_id=r.product_id and rv.version_no=r.product_rules_version
  join public.corridors c on c.id=p.corridor_id
  join public.locations o on o.id=c.origin_location_id
  join public.locations dest on dest.id=c.destination_location_id
  left join public.ride_bookings b on b.passenger_request_id=r.id
  left join public.rides ride on ride.id=b.ride_id
  left join public.drivers d on d.id=ride.driver_id
  left join public.profiles dp on dp.id=d.profile_id
  left join public.vehicles v on v.id=ride.vehicle_id
  where r.id=p_request_id and r.passenger_profile_id=auth.uid();
$$;
revoke all on function private.get_my_fixed_request(uuid) from public,anon,authenticated;
grant execute on function private.get_my_fixed_request(uuid) to authenticated;

create or replace function private.get_my_fixed_assignments()
returns jsonb language sql security definer stable set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'ride_id',ride.id,'service_type',prod.service_type,'status',ride.status,
    'matched_at',ride.matched_at,'driver_ack_deadline',ride.driver_ack_deadline,
    'boarding_deadline',ride.boarding_deadline,'refill_deadline',ride.refill_deadline,
    'return_not_before',ride.return_not_before,'return_boarding_deadline',ride.return_boarding_deadline,
    'origin_name',o.name,'destination_name',dest.name,
    'vehicle_model',v.vehicle_model,'vehicle_registration',v.registration_number,
    'booked_seat_count',ride.booked_seat_count,'capacity',ride.capacity,
    'passenger_groups',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'booking_id',b.id,'display_name',p.display_name,'seat_count',b.seat_count,
        'status',b.status,'return_status',b.return_status
      ) order by b.assigned_at,b.id),'[]'::jsonb)
      from public.ride_bookings b join public.profiles p on p.id=b.passenger_profile_id
      where b.ride_id=ride.id
    )
  ) order by ride.matched_at desc),'[]'::jsonb)
  from public.rides ride
  join public.service_products prod on prod.id=ride.product_id
  join public.drivers d on d.id=ride.driver_id and d.profile_id=auth.uid()
  join public.locations o on o.id=ride.origin_location_id
  join public.locations dest on dest.id=ride.destination_location_id
  join public.vehicles v on v.id=ride.vehicle_id
  where ride.status not in ('COMPLETED','DRIVER_FAILED','CANCELLED');
$$;
revoke all on function private.get_my_fixed_assignments() from public,anon,authenticated;
grant execute on function private.get_my_fixed_assignments() to authenticated;
create or replace function private.get_my_fixed_history()
returns jsonb language sql security definer stable set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'ride_id',r.id,'service_type',prod.service_type,'status',r.status,
    'origin_name',o.name,'destination_name',d.name,
    'vehicle_model',v.vehicle_model,'vehicle_registration',v.registration_number,
    'completed_at',r.completed_at,'departed_at',r.departed_at,
    'booked_seat_count',r.booked_seat_count,'capacity',r.capacity,
    'completion_zone',coalesce(rz.label,z.label),
    'outbound_completion_zone',oz.label
  ) order by r.completed_at desc),'[]'::jsonb)
  from public.rides r
  join public.service_products prod on prod.id=r.product_id
  join public.drivers dr on dr.id=r.driver_id and dr.profile_id=auth.uid()
  join public.locations o on o.id=r.origin_location_id
  join public.locations d on d.id=r.destination_location_id
  join public.vehicles v on v.id=r.vehicle_id
  left join public.market_presence_zones z on z.id=r.completion_zone_id
  left join public.market_presence_zones oz on oz.id=r.outbound_completion_zone_id
  left join public.market_presence_zones rz on rz.id=r.return_completion_zone_id
  where r.status='COMPLETED';
$$;
revoke all on function private.get_my_fixed_history() from public,anon,authenticated;
grant execute on function private.get_my_fixed_history() to authenticated;