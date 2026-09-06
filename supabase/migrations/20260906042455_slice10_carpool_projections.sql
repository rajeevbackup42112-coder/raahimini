create or replace function private.carpool_trust_json(p_driver_id uuid,p_vehicle_id uuid)
returns jsonb language sql security definer stable set search_path=''
as $$
select jsonb_build_object(
  'driver_verified', exists(select 1 from public.verification_records vr where vr.driver_id=p_driver_id and vr.verification_type='DRIVING_LICENCE' and vr.status='VERIFIED' and (vr.expires_at is null or vr.expires_at>now())),
  'driver_photo_verified', exists(select 1 from public.verification_records vr where vr.driver_id=p_driver_id and vr.verification_type='DRIVER_PHOTO' and vr.status='VERIFIED' and (vr.expires_at is null or vr.expires_at>now())),
  'vehicle_rc_verified', exists(select 1 from public.verification_records vr where vr.vehicle_id=p_vehicle_id and vr.verification_type='VEHICLE_RC' and vr.status='VERIFIED' and (vr.expires_at is null or vr.expires_at>now())),
  'vehicle_photos_verified', exists(select 1 from public.verification_records vr where vr.vehicle_id=p_vehicle_id and vr.verification_type='VEHICLE_PHOTOS' and vr.status='VERIFIED' and (vr.expires_at is null or vr.expires_at>now()))
);
$$;
revoke all on function private.carpool_trust_json(uuid,uuid) from public,anon,authenticated;

create or replace function private.get_carpool_catalog()
returns jsonb language sql security definer stable set search_path=''
as $$
select jsonb_build_object(
  'products', coalesce((select jsonb_agg(jsonb_build_object(
      'product_id',p.id,'product_name',p.display_name,'market_id',p.market_id,'market_name',m.name,
      'rules_version',p.current_rules_version,'max_seats_per_booking',coalesce((rv.rules->>'max_seats_per_booking')::int,4)
    ) order by m.name,p.display_name)
    from public.service_products p join public.markets m on m.id=p.market_id
    join public.service_product_rule_versions rv on rv.product_id=p.id and rv.version_no=p.current_rules_version
    where p.service_type='CARPOOL' and p.status in ('PILOT','ACTIVE') and m.status in ('PILOT','ACTIVE','SCALING')), '[]'::jsonb),
  'locations', coalesce((select jsonb_agg(jsonb_build_object('location_id',l.id,'name',l.name,'market_id',l.market_id,'market_name',m.name) order by l.name)
    from public.locations l join public.markets m on m.id=l.market_id
    where l.is_active and exists(select 1 from public.market_presence_zones z where z.market_id=l.market_id and z.is_active)), '[]'::jsonb)
);
$$;
revoke all on function private.get_carpool_catalog() from public,anon,authenticated;
create or replace function public.get_carpool_catalog() returns jsonb language sql security invoker set search_path='' as $$ select private.get_carpool_catalog(); $$;
revoke all on function public.get_carpool_catalog() from public,anon,authenticated;
grant execute on function public.get_carpool_catalog() to authenticated;

create or replace function private.get_carpool_discovery(p_origin_location_id uuid default null,p_destination_location_id uuid default null)
returns jsonb language sql security definer stable set search_path=''
as $$
select coalesce(jsonb_agg(jsonb_build_object(
  'journey_id',j.id,'product_id',j.product_id,'status',j.status,
  'origin_location_id',j.origin_location_id,'origin_name',o.name,
  'destination_location_id',j.destination_location_id,'destination_name',dest.name,
  'departure_at',j.departure_at,'offered_seats',j.offered_seats,'booked_seats',j.active_booked_seats,
  'seats_left',j.offered_seats-j.active_booked_seats,'contribution_per_seat_inr',j.contribution_per_seat_inr,
  'driver_name',coalesce(dp.display_name,'Driver'),'vehicle_model',v.vehicle_model,'vehicle_registration',v.registration_number,
  'trust',private.carpool_trust_json(j.driver_id,j.vehicle_id)
) order by j.departure_at,j.created_at), '[]'::jsonb)
from public.carpool_journeys j
join public.drivers d on d.id=j.driver_id
join public.profiles dp on dp.id=d.profile_id
join public.vehicles v on v.id=j.vehicle_id
join public.locations o on o.id=j.origin_location_id
join public.locations dest on dest.id=j.destination_location_id
where j.status in ('PUBLISHED','FULL') and j.departure_at>now()
  and (p_origin_location_id is null or j.origin_location_id=p_origin_location_id)
  and (p_destination_location_id is null or j.destination_location_id=p_destination_location_id);
$$;
revoke all on function private.get_carpool_discovery(uuid,uuid) from public,anon,authenticated;
create or replace function public.get_carpool_discovery(p_origin_location_id uuid default null,p_destination_location_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.get_carpool_discovery(p_origin_location_id,p_destination_location_id); $$;
revoke all on function public.get_carpool_discovery(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_carpool_discovery(uuid,uuid) to authenticated;

create or replace function private.get_carpool_journey(p_journey_id uuid)
returns jsonb language plpgsql security definer stable set search_path=''
as $$
declare v_profile uuid:=auth.uid(); v_result jsonb;
begin
 if v_profile is null then raise exception 'UNAUTHENTICATED'; end if;
 select jsonb_build_object(
   'journey_id',j.id,'product_id',j.product_id,'status',j.status,
   'origin_location_id',j.origin_location_id,'origin_name',o.name,'destination_location_id',j.destination_location_id,'destination_name',dest.name,
   'departure_at',j.departure_at,'offered_seats',j.offered_seats,'booked_seats',j.active_booked_seats,'seats_left',j.offered_seats-j.active_booked_seats,
   'contribution_per_seat_inr',j.contribution_per_seat_inr,'ride_id',j.ride_id,'ride_status',r.status,
   'driver_name',coalesce(dp.display_name,'Driver'),'driver_phone',case when mb.status='ACTIVE' and coalesce(r.status,'UPCOMING') not in ('COMPLETED','CANCELLED') then dp.phone else null end,
   'vehicle_model',v.vehicle_model,'vehicle_registration',v.registration_number,'trust',private.carpool_trust_json(j.driver_id,j.vehicle_id),
   'my_booking',case when mb.id is null then null else jsonb_build_object(
      'carpool_booking_id',mb.id,'ride_booking_id',mb.ride_booking_id,'status',mb.status,'seat_count',mb.seat_count,
      'contribution_per_seat_inr',mb.contribution_per_seat_inr,'total_inr',mb.seat_count*mb.contribution_per_seat_inr,'booked_at',mb.booked_at,
      'payment',case when pay.id is null then null else jsonb_build_object('payment_id',pay.id,'status',pay.status,'amount_inr',pay.amount_inr,'passenger_marked_paid_at',pay.passenger_marked_paid_at,'driver_confirmed_received_at',pay.driver_confirmed_received_at,'disputed_at',pay.disputed_at) end
    ) end,
   'pending_change',case when cp.id is null then null else jsonb_build_object(
      'proposal_id',cp.id,'version_no',cp.version_no,'proposed_destination_location_id',cp.proposed_destination_location_id,'proposed_destination_name',pd.name,
      'proposed_departure_at',cp.proposed_departure_at,'status',cp.status,'my_response',cc.status,'created_at',cp.created_at
    ) end
 ) into v_result
 from public.carpool_journeys j
 join public.drivers d on d.id=j.driver_id join public.profiles dp on dp.id=d.profile_id join public.vehicles v on v.id=j.vehicle_id
 join public.locations o on o.id=j.origin_location_id join public.locations dest on dest.id=j.destination_location_id
 left join public.rides r on r.id=j.ride_id
 left join lateral (select b.* from public.carpool_bookings b where b.journey_id=j.id and b.passenger_profile_id=v_profile order by b.booked_at desc limit 1) mb on true
 left join public.payment_acknowledgements pay on pay.ride_booking_id=mb.ride_booking_id
 left join lateral (select p.* from public.carpool_change_proposals p where p.journey_id=j.id and p.status='PENDING' order by p.version_no desc limit 1) cp on true
 left join public.locations pd on pd.id=cp.proposed_destination_location_id
 left join public.carpool_booking_change_consents cc on cc.proposal_id=cp.id and cc.carpool_booking_id=mb.id
 where j.id=p_journey_id;
 return v_result;
end; $$;
revoke all on function private.get_carpool_journey(uuid) from public,anon,authenticated;
create or replace function public.get_carpool_journey(p_journey_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.get_carpool_journey(p_journey_id); $$;
revoke all on function public.get_carpool_journey(uuid) from public,anon,authenticated;
grant execute on function public.get_carpool_journey(uuid) to authenticated;

create or replace function private.get_driver_carpool_workspace()
returns jsonb language plpgsql security definer stable set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_vehicle uuid; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
 select av.vehicle_id into v_vehicle from public.driver_active_vehicles av where av.driver_id=v_driver;
 select jsonb_build_object(
   'catalog',private.get_carpool_catalog(),
   'active_vehicle_id',v_vehicle,
   'active_vehicle',case when v.id is null then null else jsonb_build_object('vehicle_id',v.id,'model',v.vehicle_model,'registration',v.registration_number,'capacity',v.bookable_passenger_capacity) end,
   'journeys',coalesce((select jsonb_agg(jsonb_build_object(
      'journey_id',j.id,'product_id',j.product_id,'status',j.status,'origin_location_id',j.origin_location_id,'origin_name',o.name,
      'destination_location_id',j.destination_location_id,'destination_name',dest.name,'departure_at',j.departure_at,
      'offered_seats',j.offered_seats,'booked_seats',j.active_booked_seats,'seats_left',j.offered_seats-j.active_booked_seats,'contribution_per_seat_inr',j.contribution_per_seat_inr,
      'commitment_id',j.commitment_id,'ride_id',j.ride_id,'ride_status',r.status,'current_change_version',j.current_change_version,
      'pending_change',case when cp.id is null then null else jsonb_build_object('proposal_id',cp.id,'version_no',cp.version_no,'proposed_destination_location_id',cp.proposed_destination_location_id,'proposed_destination_name',pd.name,'proposed_departure_at',cp.proposed_departure_at,'created_at',cp.created_at,
          'pending_responses',(select count(*) from public.carpool_booking_change_consents c where c.proposal_id=cp.id and c.status='PENDING')) end,
      'bookings',coalesce((select jsonb_agg(jsonb_build_object(
         'carpool_booking_id',b.id,'ride_booking_id',b.ride_booking_id,'status',b.status,'seat_count',b.seat_count,'contribution_per_seat_inr',b.contribution_per_seat_inr,
         'passenger_name',coalesce(pp.display_name,'Passenger'),'passenger_phone',case when b.status='ACTIVE' and coalesce(r.status,'UPCOMING') not in ('COMPLETED','CANCELLED') then pp.phone else null end,
         'payment',case when pay.id is null then null else jsonb_build_object('payment_id',pay.id,'status',pay.status,'amount_inr',pay.amount_inr,'passenger_marked_paid_at',pay.passenger_marked_paid_at,'driver_confirmed_received_at',pay.driver_confirmed_received_at,'disputed_at',pay.disputed_at) end
       ) order by b.booked_at) from public.carpool_bookings b join public.profiles pp on pp.id=b.passenger_profile_id left join public.payment_acknowledgements pay on pay.ride_booking_id=b.ride_booking_id where b.journey_id=j.id), '[]'::jsonb)
    ) order by j.departure_at desc,j.created_at desc)
    from public.carpool_journeys j join public.locations o on o.id=j.origin_location_id join public.locations dest on dest.id=j.destination_location_id
    left join public.rides r on r.id=j.ride_id
    left join lateral (select p.* from public.carpool_change_proposals p where p.journey_id=j.id and p.status='PENDING' order by p.version_no desc limit 1) cp on true
    left join public.locations pd on pd.id=cp.proposed_destination_location_id
    where j.driver_id=v_driver), '[]'::jsonb)
 ) into v_result from (select 1) x left join public.vehicles v on v.id=v_vehicle;
 return v_result;
end; $$;
revoke all on function private.get_driver_carpool_workspace() from public,anon,authenticated;
create or replace function public.get_driver_carpool_workspace() returns jsonb language sql security invoker set search_path='' as $$ select private.get_driver_carpool_workspace(); $$;
revoke all on function public.get_driver_carpool_workspace() from public,anon,authenticated;
grant execute on function public.get_driver_carpool_workspace() to authenticated;