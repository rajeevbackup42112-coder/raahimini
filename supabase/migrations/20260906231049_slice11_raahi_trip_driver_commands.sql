create or replace function private.create_trip_draft(
 p_product_id uuid,p_vehicle_id uuid,p_origin_location_id uuid,p_destination_location_id uuid,
 p_departure_at timestamptz,p_return_departure_at timestamptz,p_offered_seats integer,p_price_per_seat_inr integer,
 p_min_confirmation_seats integer,p_confirmation_deadline timestamptz,p_itinerary_context text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_driver uuid:=private.current_driver_id(); v_product public.service_products%rowtype; v_vehicle public.vehicles%rowtype; v_rules jsonb;
 v_window tstzrange; v_hash text; v_idem public.command_idempotency; v_id uuid; v_result jsonb;
 v_min_lead int; v_horizon int; v_min_confirm int;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
 v_hash:=md5(concat_ws('|',p_product_id,p_vehicle_id,p_origin_location_id,p_destination_location_id,p_departure_at,p_return_departure_at,p_offered_seats,p_price_per_seat_inr,p_min_confirmation_seats,p_confirmation_deadline,coalesce(p_itinerary_context,'')));
 v_idem:=private.claim_user_command('create_trip_draft',p_idempotency_key,v_hash); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_product from public.service_products p where p.id=p_product_id and p.service_type='RAAHI_TRIP' and p.status in ('PILOT','ACTIVE');
 if not found or not exists(select 1 from public.markets m where m.id=v_product.market_id and m.status='ACTIVE') then raise exception 'TRIP_PRODUCT_NOT_AVAILABLE'; end if;
 select * into v_vehicle from public.vehicles where id=p_vehicle_id;
 if not private.raahi_trip_driver_vehicle_eligible(v_driver,p_vehicle_id,v_product.market_id) then raise exception 'TRIP_DRIVER_NOT_ELIGIBLE'; end if;
 if p_offered_seats<1 or p_offered_seats>v_vehicle.bookable_passenger_capacity then raise exception 'TRIP_CAPACITY_INVALID'; end if;
 if p_min_confirmation_seats<1 or p_min_confirmation_seats>p_offered_seats then raise exception 'TRIP_THRESHOLD_INVALID'; end if;
 if p_price_per_seat_inr<=0 then raise exception 'TRIP_PRICE_INVALID'; end if;
 if not exists(select 1 from public.locations l where l.id=p_origin_location_id and l.market_id=v_product.market_id and l.is_active) then raise exception 'TRIP_ORIGIN_INVALID'; end if;
 if p_destination_location_id=p_origin_location_id or not exists(select 1 from public.locations l where l.id=p_destination_location_id and l.is_active) then raise exception 'TRIP_DESTINATION_INVALID'; end if;
 select rv.rules into v_rules from public.service_product_rule_versions rv where rv.product_id=v_product.id and rv.version_no=v_product.current_rules_version;
 v_min_lead:=coalesce((v_rules->>'min_departure_lead_minutes')::int,180); v_horizon:=coalesce((v_rules->>'max_publish_horizon_days')::int,60); v_min_confirm:=coalesce((v_rules->>'min_confirmation_lead_minutes')::int,60);
 if p_departure_at<now()+make_interval(mins=>v_min_lead) or p_departure_at>now()+make_interval(days=>v_horizon) then raise exception 'TRIP_DEPARTURE_INVALID'; end if;
 if p_return_departure_at<=p_departure_at then raise exception 'TRIP_RETURN_INVALID'; end if;
 if p_confirmation_deadline<=now() or p_confirmation_deadline>p_departure_at-make_interval(mins=>v_min_confirm) then raise exception 'TRIP_CONFIRMATION_DEADLINE_INVALID'; end if;
 v_window:=private.raahi_trip_commitment_window(v_product.id,v_product.current_rules_version,p_departure_at,p_return_departure_at);
 if exists(select 1 from public.mobility_commitments c where (c.driver_id=v_driver or c.vehicle_id=p_vehicle_id) and c.status in ('RESERVED','ACTIVE') and tstzrange(c.starts_at,c.ends_at,'[)')&&v_window) then raise exception 'TRIP_COMMITMENT_CONFLICT'; end if;
 insert into public.trip_offerings(product_id,product_rules_version,driver_id,vehicle_id,origin_market_id,origin_location_id,destination_location_id,departure_at,return_departure_at,offered_seats,price_per_seat_inr,min_confirmation_seats,confirmation_deadline,itinerary_context,status)
 values(v_product.id,v_product.current_rules_version,v_driver,p_vehicle_id,v_product.market_id,p_origin_location_id,p_destination_location_id,p_departure_at,p_return_departure_at,p_offered_seats,p_price_per_seat_inr,p_min_confirmation_seats,p_confirmation_deadline,nullif(trim(p_itinerary_context),''),'DRAFT') returning id into v_id;
 v_result:=jsonb_build_object('offering_id',v_id,'status','DRAFT'); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.create_trip_draft(uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,timestamptz,text,text) from public,anon,authenticated;
grant execute on function private.create_trip_draft(uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,timestamptz,text,text) to authenticated;
create or replace function public.create_trip_draft(p_product_id uuid,p_vehicle_id uuid,p_origin_location_id uuid,p_destination_location_id uuid,p_departure_at timestamptz,p_return_departure_at timestamptz,p_offered_seats integer,p_price_per_seat_inr integer,p_min_confirmation_seats integer,p_confirmation_deadline timestamptz,p_itinerary_context text,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.create_trip_draft(p_product_id,p_vehicle_id,p_origin_location_id,p_destination_location_id,p_departure_at,p_return_departure_at,p_offered_seats,p_price_per_seat_inr,p_min_confirmation_seats,p_confirmation_deadline,p_itinerary_context,p_idempotency_key); $$;
revoke all on function public.create_trip_draft(uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.create_trip_draft(uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,timestamptz,text,text) to authenticated;

create or replace function private.update_unbooked_trip(
 p_offering_id uuid,p_vehicle_id uuid,p_origin_location_id uuid,p_destination_location_id uuid,
 p_departure_at timestamptz,p_return_departure_at timestamptz,p_offered_seats integer,p_price_per_seat_inr integer,
 p_min_confirmation_seats integer,p_confirmation_deadline timestamptz,p_itinerary_context text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_driver uuid:=private.current_driver_id(); v_o public.trip_offerings%rowtype; v_product public.service_products%rowtype; v_vehicle public.vehicles%rowtype; v_rules jsonb;
 v_window tstzrange; v_hash text; v_idem public.command_idempotency; v_result jsonb; v_min_lead int; v_horizon int; v_min_confirm int;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
 v_hash:=md5(concat_ws('|',p_offering_id,p_vehicle_id,p_origin_location_id,p_destination_location_id,p_departure_at,p_return_departure_at,p_offered_seats,p_price_per_seat_inr,p_min_confirmation_seats,p_confirmation_deadline,coalesce(p_itinerary_context,'')));
 v_idem:=private.claim_user_command('update_unbooked_trip',p_idempotency_key,v_hash); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_o from public.trip_offerings where id=p_offering_id and driver_id=v_driver for update; if not found then raise exception 'TRIP_OFFERING_NOT_FOUND'; end if;
 if v_o.status not in ('DRAFT','FILLING') or v_o.commitment_id is not null or v_o.ride_id is not null then raise exception 'TRIP_OFFERING_NOT_EDITABLE'; end if;
 if exists(select 1 from public.trip_bookings b where b.offering_id=v_o.id) then raise exception 'TRIP_ALREADY_BOOKED'; end if;
 select * into v_product from public.service_products p where p.id=v_o.product_id and p.service_type='RAAHI_TRIP' and p.status in ('PILOT','ACTIVE');
 if not found or not exists(select 1 from public.markets m where m.id=v_product.market_id and m.status='ACTIVE') then raise exception 'TRIP_PRODUCT_NOT_AVAILABLE'; end if;
 select * into v_vehicle from public.vehicles where id=p_vehicle_id;
 if not private.raahi_trip_driver_vehicle_eligible(v_driver,p_vehicle_id,v_product.market_id) then raise exception 'TRIP_DRIVER_NOT_ELIGIBLE'; end if;
 if p_offered_seats<1 or p_offered_seats>v_vehicle.bookable_passenger_capacity then raise exception 'TRIP_CAPACITY_INVALID'; end if;
 if p_min_confirmation_seats<1 or p_min_confirmation_seats>p_offered_seats then raise exception 'TRIP_THRESHOLD_INVALID'; end if;
 if p_price_per_seat_inr<=0 then raise exception 'TRIP_PRICE_INVALID'; end if;
 if not exists(select 1 from public.locations l where l.id=p_origin_location_id and l.market_id=v_product.market_id and l.is_active) then raise exception 'TRIP_ORIGIN_INVALID'; end if;
 if p_destination_location_id=p_origin_location_id or not exists(select 1 from public.locations l where l.id=p_destination_location_id and l.is_active) then raise exception 'TRIP_DESTINATION_INVALID'; end if;
 select rv.rules into v_rules from public.service_product_rule_versions rv where rv.product_id=v_o.product_id and rv.version_no=v_o.product_rules_version;
 v_min_lead:=coalesce((v_rules->>'min_departure_lead_minutes')::int,180); v_horizon:=coalesce((v_rules->>'max_publish_horizon_days')::int,60); v_min_confirm:=coalesce((v_rules->>'min_confirmation_lead_minutes')::int,60);
 if p_departure_at<now()+make_interval(mins=>v_min_lead) or p_departure_at>now()+make_interval(days=>v_horizon) then raise exception 'TRIP_DEPARTURE_INVALID'; end if;
 if p_return_departure_at<=p_departure_at then raise exception 'TRIP_RETURN_INVALID'; end if;
 if p_confirmation_deadline<=now() or p_confirmation_deadline>p_departure_at-make_interval(mins=>v_min_confirm) then raise exception 'TRIP_CONFIRMATION_DEADLINE_INVALID'; end if;
 v_window:=private.raahi_trip_commitment_window(v_o.product_id,v_o.product_rules_version,p_departure_at,p_return_departure_at);
 if exists(select 1 from public.mobility_commitments c where (c.driver_id=v_driver or c.vehicle_id=p_vehicle_id) and c.status in ('RESERVED','ACTIVE') and tstzrange(c.starts_at,c.ends_at,'[)')&&v_window) then raise exception 'TRIP_COMMITMENT_CONFLICT'; end if;
 update public.trip_offerings set vehicle_id=p_vehicle_id,origin_location_id=p_origin_location_id,destination_location_id=p_destination_location_id,departure_at=p_departure_at,return_departure_at=p_return_departure_at,offered_seats=p_offered_seats,price_per_seat_inr=p_price_per_seat_inr,min_confirmation_seats=p_min_confirmation_seats,confirmation_deadline=p_confirmation_deadline,itinerary_context=nullif(trim(p_itinerary_context),''),updated_at=now() where id=v_o.id;
 v_result:=jsonb_build_object('offering_id',v_o.id,'status',v_o.status,'offered_seats',p_offered_seats,'price_per_seat_inr',p_price_per_seat_inr); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.update_unbooked_trip(uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,timestamptz,text,text) from public,anon,authenticated;
grant execute on function private.update_unbooked_trip(uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,timestamptz,text,text) to authenticated;
create or replace function public.update_unbooked_trip(p_offering_id uuid,p_vehicle_id uuid,p_origin_location_id uuid,p_destination_location_id uuid,p_departure_at timestamptz,p_return_departure_at timestamptz,p_offered_seats integer,p_price_per_seat_inr integer,p_min_confirmation_seats integer,p_confirmation_deadline timestamptz,p_itinerary_context text,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.update_unbooked_trip(p_offering_id,p_vehicle_id,p_origin_location_id,p_destination_location_id,p_departure_at,p_return_departure_at,p_offered_seats,p_price_per_seat_inr,p_min_confirmation_seats,p_confirmation_deadline,p_itinerary_context,p_idempotency_key); $$;
revoke all on function public.update_unbooked_trip(uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.update_unbooked_trip(uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,timestamptz,text,text) to authenticated;

create or replace function private.publish_trip_offering(p_offering_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_o public.trip_offerings%rowtype; v_product public.service_products%rowtype; v_rules jsonb; v_window tstzrange; v_idem public.command_idempotency; v_result jsonb; v_min_lead int; v_min_confirm int;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
 v_idem:=private.claim_user_command('publish_trip_offering',p_idempotency_key,md5(p_offering_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_o from public.trip_offerings where id=p_offering_id and driver_id=v_driver for update; if not found then raise exception 'TRIP_OFFERING_NOT_FOUND'; end if;
 if v_o.status='FILLING' then v_result:=jsonb_build_object('offering_id',v_o.id,'status','FILLING','published_at',v_o.published_at); return private.complete_user_command(v_idem.id,v_result); end if;
 if v_o.status<>'DRAFT' or exists(select 1 from public.trip_bookings b where b.offering_id=v_o.id) then raise exception 'TRIP_OFFERING_NOT_PUBLISHABLE'; end if;
 select * into v_product from public.service_products p where p.id=v_o.product_id and p.service_type='RAAHI_TRIP' and p.status in ('PILOT','ACTIVE');
 if not found or not exists(select 1 from public.markets m where m.id=v_o.origin_market_id and m.status='ACTIVE') then raise exception 'TRIP_PRODUCT_NOT_AVAILABLE'; end if;
 if not private.raahi_trip_driver_vehicle_eligible(v_driver,v_o.vehicle_id,v_o.origin_market_id) then raise exception 'TRIP_DRIVER_NOT_ELIGIBLE'; end if;
 select rv.rules into v_rules from public.service_product_rule_versions rv where rv.product_id=v_o.product_id and rv.version_no=v_o.product_rules_version;
 v_min_lead:=coalesce((v_rules->>'min_departure_lead_minutes')::int,180); v_min_confirm:=coalesce((v_rules->>'min_confirmation_lead_minutes')::int,60);
 if v_o.departure_at<now()+make_interval(mins=>v_min_lead) then raise exception 'TRIP_DEPARTURE_INVALID'; end if;
 if v_o.confirmation_deadline<=now() or v_o.confirmation_deadline>v_o.departure_at-make_interval(mins=>v_min_confirm) then raise exception 'TRIP_CONFIRMATION_DEADLINE_INVALID'; end if;
 v_window:=private.raahi_trip_commitment_window(v_o.product_id,v_o.product_rules_version,v_o.departure_at,v_o.return_departure_at);
 if exists(select 1 from public.mobility_commitments c where (c.driver_id=v_driver or c.vehicle_id=v_o.vehicle_id) and c.status in ('RESERVED','ACTIVE') and tstzrange(c.starts_at,c.ends_at,'[)')&&v_window) then raise exception 'TRIP_COMMITMENT_CONFLICT'; end if;
 update public.trip_offerings set status='FILLING',published_at=coalesce(published_at,now()),updated_at=now() where id=v_o.id returning published_at into v_o.published_at;
 v_result:=jsonb_build_object('offering_id',v_o.id,'status','FILLING','published_at',v_o.published_at); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.publish_trip_offering(uuid,text) from public,anon,authenticated;
grant execute on function private.publish_trip_offering(uuid,text) to authenticated;
create or replace function public.publish_trip_offering(p_offering_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.publish_trip_offering(p_offering_id,p_idempotency_key); $$;
revoke all on function public.publish_trip_offering(uuid,text) from public,anon,authenticated;
grant execute on function public.publish_trip_offering(uuid,text) to authenticated;

create or replace function private.cancel_trip_offering(p_offering_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_o public.trip_offerings%rowtype; v_ride public.rides%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
 v_idem:=private.claim_user_command('cancel_trip_offering',p_idempotency_key,md5(p_offering_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_o from public.trip_offerings where id=p_offering_id and driver_id=v_driver for update; if not found then raise exception 'TRIP_OFFERING_NOT_FOUND'; end if;
 if v_o.status='DRIVER_CANCELLED' then v_result:=jsonb_build_object('offering_id',v_o.id,'status','DRIVER_CANCELLED'); return private.complete_user_command(v_idem.id,v_result); end if;
 if v_o.status='IN_FULFILMENT' then raise exception 'TRIP_ALREADY_IN_FULFILMENT'; end if;
 if v_o.status not in ('DRAFT','FILLING','CONFIRMED','UPCOMING') then raise exception 'TRIP_OFFERING_NOT_CANCELLABLE'; end if;
 if v_o.ride_id is not null then
  select * into v_ride from public.rides where id=v_o.ride_id for update;
  if v_ride.status<>'UPCOMING' then raise exception 'TRIP_ALREADY_IN_FULFILMENT'; end if;
  update public.rides set status='CANCELLED',updated_at=now() where id=v_ride.id;
  update public.ride_bookings set status='CANCELLED' where ride_id=v_ride.id and status='ASSIGNED';
  update public.mobility_commitments set status='RELEASED' where id=v_o.commitment_id and status='RESERVED';
  insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state) values(v_ride.id,'RAAHI_TRIP_DRIVER_CANCELLED','DRIVER',auth.uid(),'UPCOMING','CANCELLED');
 end if;
 update public.trip_bookings set status='DRIVER_CANCELLED',cancelled_at=now(),updated_at=now() where offering_id=v_o.id and status in ('FILLING','CONFIRMED');
 update public.trip_offerings set status='DRIVER_CANCELLED',active_booked_seats=0,cancelled_at=now(),updated_at=now() where id=v_o.id;
 v_result:=jsonb_build_object('offering_id',v_o.id,'status','DRIVER_CANCELLED'); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.cancel_trip_offering(uuid,text) from public,anon,authenticated;
grant execute on function private.cancel_trip_offering(uuid,text) to authenticated;
create or replace function public.cancel_trip_offering(p_offering_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.cancel_trip_offering(p_offering_id,p_idempotency_key); $$;
revoke all on function public.cancel_trip_offering(uuid,text) from public,anon,authenticated;
grant execute on function public.cancel_trip_offering(uuid,text) to authenticated;