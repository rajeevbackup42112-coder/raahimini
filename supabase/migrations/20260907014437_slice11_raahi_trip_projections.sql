create or replace function private.get_trip_catalog()
returns jsonb language sql security definer stable set search_path=''
as $$
select jsonb_build_object(
 'products',coalesce((select jsonb_agg(jsonb_build_object('product_id',p.id,'product_name',p.display_name,'market_id',p.market_id,'market_name',m.name,'rules_version',p.current_rules_version,'max_seats_per_booking',coalesce((rv.rules->>'max_seats_per_booking')::int,4)) order by m.name,p.display_name) from public.service_products p join public.markets m on m.id=p.market_id join public.service_product_rule_versions rv on rv.product_id=p.id and rv.version_no=p.current_rules_version where p.service_type='RAAHI_TRIP' and p.status in ('PILOT','ACTIVE') and m.status in ('PILOT','ACTIVE','SCALING')),'[]'::jsonb),
 'locations',coalesce((select jsonb_agg(jsonb_build_object('location_id',l.id,'name',l.name,'market_id',l.market_id,'market_name',m.name) order by l.name) from public.locations l join public.markets m on m.id=l.market_id where l.is_active),'[]'::jsonb)
);
$$;
revoke all on function private.get_trip_catalog() from public,anon,authenticated; grant execute on function private.get_trip_catalog() to authenticated;
create or replace function public.get_trip_catalog() returns jsonb language sql security invoker set search_path='' as $$ select private.get_trip_catalog(); $$;
revoke all on function public.get_trip_catalog() from public,anon,authenticated; grant execute on function public.get_trip_catalog() to authenticated;

create or replace function private.get_trip_discovery(p_origin_location_id uuid default null)
returns jsonb language sql security definer stable set search_path=''
as $$
select coalesce(jsonb_agg(jsonb_build_object(
 'offering_id',t.id,'product_id',t.product_id,'status',t.status,'display_status',case when t.active_booked_seats>=t.offered_seats then 'FULL' else t.status end,
 'origin_location_id',t.origin_location_id,'origin_name',o.name,'destination_location_id',t.destination_location_id,'destination_name',dest.name,
 'departure_at',t.departure_at,'return_departure_at',t.return_departure_at,'offered_seats',t.offered_seats,'booked_seats',t.active_booked_seats,'seats_left',t.offered_seats-t.active_booked_seats,
 'price_per_seat_inr',t.price_per_seat_inr,'min_confirmation_seats',t.min_confirmation_seats,'confirmation_deadline',t.confirmation_deadline,'seats_needed_to_confirm',greatest(t.min_confirmation_seats-t.active_booked_seats,0),
 'itinerary_context',t.itinerary_context,'driver_name',coalesce(dp.display_name,'Driver'),'vehicle_model',v.vehicle_model,'vehicle_registration',v.registration_number,'trust',private.carpool_trust_json(t.driver_id,t.vehicle_id)
) order by t.departure_at,t.created_at),'[]'::jsonb)
from public.trip_offerings t join public.drivers d on d.id=t.driver_id join public.profiles dp on dp.id=d.profile_id join public.vehicles v on v.id=t.vehicle_id join public.locations o on o.id=t.origin_location_id join public.locations dest on dest.id=t.destination_location_id
where t.status in ('FILLING','CONFIRMED') and t.departure_at>now() and (t.status='CONFIRMED' or t.confirmation_deadline>now()) and (p_origin_location_id is null or t.origin_location_id=p_origin_location_id);
$$;
revoke all on function private.get_trip_discovery(uuid) from public,anon,authenticated; grant execute on function private.get_trip_discovery(uuid) to authenticated;
create or replace function public.get_trip_discovery(p_origin_location_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.get_trip_discovery(p_origin_location_id); $$;
revoke all on function public.get_trip_discovery(uuid) from public,anon,authenticated; grant execute on function public.get_trip_discovery(uuid) to authenticated;

create or replace function private.get_trip_offering(p_offering_id uuid)
returns jsonb language plpgsql security definer stable set search_path=''
as $$
declare v_profile uuid:=auth.uid(); v_result jsonb;
begin
 if v_profile is null then raise exception 'UNAUTHENTICATED'; end if;
 select jsonb_build_object(
  'offering_id',t.id,'product_id',t.product_id,'status',t.status,'display_status',case when t.active_booked_seats>=t.offered_seats then 'FULL' else t.status end,
  'origin_location_id',t.origin_location_id,'origin_name',o.name,'destination_location_id',t.destination_location_id,'destination_name',dest.name,
  'departure_at',t.departure_at,'return_departure_at',t.return_departure_at,'offered_seats',t.offered_seats,'booked_seats',t.active_booked_seats,'seats_left',t.offered_seats-t.active_booked_seats,
  'price_per_seat_inr',t.price_per_seat_inr,'min_confirmation_seats',t.min_confirmation_seats,'confirmation_deadline',t.confirmation_deadline,'seats_needed_to_confirm',greatest(t.min_confirmation_seats-t.active_booked_seats,0),'itinerary_context',t.itinerary_context,
  'commitment_id',t.commitment_id,'ride_id',t.ride_id,'ride_status',r.status,'driver_name',coalesce(dp.display_name,'Driver'),'driver_phone',case when mb.status='CONFIRMED' and r.status not in ('COMPLETED','CANCELLED') then dp.phone else null end,
  'vehicle_model',v.vehicle_model,'vehicle_registration',v.registration_number,'trust',private.carpool_trust_json(t.driver_id,t.vehicle_id),
  'my_booking',case when mb.id is null then null else jsonb_build_object('trip_booking_id',mb.id,'ride_booking_id',mb.ride_booking_id,'status',mb.status,'seat_count',mb.seat_count,'price_per_seat_inr',mb.price_per_seat_inr,'total_inr',mb.seat_count*mb.price_per_seat_inr,'booked_at',mb.booked_at,'payment',case when pay.id is null then null else jsonb_build_object('payment_id',pay.id,'status',pay.status,'amount_inr',pay.amount_inr,'passenger_marked_paid_at',pay.passenger_marked_paid_at,'driver_confirmed_received_at',pay.driver_confirmed_received_at,'disputed_at',pay.disputed_at,'dispute_case_id',pay.dispute_case_id) end) end
 ) into v_result
 from public.trip_offerings t join public.drivers d on d.id=t.driver_id join public.profiles dp on dp.id=d.profile_id join public.vehicles v on v.id=t.vehicle_id join public.locations o on o.id=t.origin_location_id join public.locations dest on dest.id=t.destination_location_id
 left join public.rides r on r.id=t.ride_id
 left join lateral (select b.* from public.trip_bookings b where b.offering_id=t.id and b.passenger_profile_id=v_profile order by b.booked_at desc limit 1) mb on true
 left join public.payment_acknowledgements pay on pay.ride_booking_id=mb.ride_booking_id
 where t.id=p_offering_id;
 return v_result;
end; $$;
revoke all on function private.get_trip_offering(uuid) from public,anon,authenticated; grant execute on function private.get_trip_offering(uuid) to authenticated;
create or replace function public.get_trip_offering(p_offering_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.get_trip_offering(p_offering_id); $$;
revoke all on function public.get_trip_offering(uuid) from public,anon,authenticated; grant execute on function public.get_trip_offering(uuid) to authenticated;

create or replace function private.get_driver_trip_workspace()
returns jsonb language plpgsql security definer stable set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_vehicle uuid; v_market uuid; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
 select av.vehicle_id into v_vehicle from public.driver_active_vehicles av where av.driver_id=v_driver;
 select om.market_id into v_market from public.driver_operating_markets om where om.driver_id=v_driver;
 select jsonb_build_object(
  'catalog',private.get_trip_catalog(),'operating_market_id',v_market,'active_vehicle_id',v_vehicle,
  'active_vehicle',case when v.id is null then null else jsonb_build_object('vehicle_id',v.id,'model',v.vehicle_model,'registration',v.registration_number,'capacity',v.bookable_passenger_capacity) end,
  'offerings',coalesce((select jsonb_agg(jsonb_build_object(
   'offering_id',t.id,'product_id',t.product_id,'status',t.status,'display_status',case when t.active_booked_seats>=t.offered_seats then 'FULL' else t.status end,
   'origin_location_id',t.origin_location_id,'origin_name',o.name,'destination_location_id',t.destination_location_id,'destination_name',dest.name,'departure_at',t.departure_at,'return_departure_at',t.return_departure_at,
   'offered_seats',t.offered_seats,'booked_seats',t.active_booked_seats,'seats_left',t.offered_seats-t.active_booked_seats,'price_per_seat_inr',t.price_per_seat_inr,'min_confirmation_seats',t.min_confirmation_seats,'confirmation_deadline',t.confirmation_deadline,'seats_needed_to_confirm',greatest(t.min_confirmation_seats-t.active_booked_seats,0),'itinerary_context',t.itinerary_context,
   'commitment_id',t.commitment_id,'ride_id',t.ride_id,'ride_status',r.status,
   'bookings',coalesce((select jsonb_agg(jsonb_build_object('trip_booking_id',b.id,'ride_booking_id',b.ride_booking_id,'status',b.status,'seat_count',b.seat_count,'price_per_seat_inr',b.price_per_seat_inr,'passenger_name',coalesce(pp.display_name,'Passenger'),'passenger_phone',case when b.status='CONFIRMED' and r.status not in ('COMPLETED','CANCELLED') then pp.phone else null end,'payment',case when pay.id is null then null else jsonb_build_object('payment_id',pay.id,'status',pay.status,'amount_inr',pay.amount_inr,'passenger_marked_paid_at',pay.passenger_marked_paid_at,'driver_confirmed_received_at',pay.driver_confirmed_received_at,'disputed_at',pay.disputed_at,'dispute_case_id',pay.dispute_case_id) end) order by b.booked_at) from public.trip_bookings b join public.profiles pp on pp.id=b.passenger_profile_id left join public.payment_acknowledgements pay on pay.ride_booking_id=b.ride_booking_id where b.offering_id=t.id),'[]'::jsonb)
  ) order by t.departure_at desc,t.created_at desc) from public.trip_offerings t join public.locations o on o.id=t.origin_location_id join public.locations dest on dest.id=t.destination_location_id left join public.rides r on r.id=t.ride_id where t.driver_id=v_driver),'[]'::jsonb)
 ) into v_result from (select 1) x left join public.vehicles v on v.id=v_vehicle;
 return v_result;
end; $$;
revoke all on function private.get_driver_trip_workspace() from public,anon,authenticated; grant execute on function private.get_driver_trip_workspace() to authenticated;
create or replace function public.get_driver_trip_workspace() returns jsonb language sql security invoker set search_path='' as $$ select private.get_driver_trip_workspace(); $$;
revoke all on function public.get_driver_trip_workspace() from public,anon,authenticated; grant execute on function public.get_driver_trip_workspace() to authenticated;