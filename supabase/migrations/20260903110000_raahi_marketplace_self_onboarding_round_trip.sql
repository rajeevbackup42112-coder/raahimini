-- Raahi marketplace redesign: Driver self-onboarding + round-trip-only Outstation.
-- This migration does NOT enable public transactions or weaken any existing launch/compliance gate.

create or replace function public.self_onboard_as_driver(
  p_driver_name text,
  p_registration_number text,
  p_vehicle_model text,
  p_vehicle_type text default 'Car',
  p_capacity integer default 4,
  p_origin_area_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_profile public.profiles;
  v_existing_driver public.drivers;
  v_area public.outstation_service_areas;
  v_vehicle_id uuid;
  v_driver_id uuid;
  v_registration text;
  v_phone text;
begin
  if v_uid is null then return jsonb_build_object('success',false,'error','Sign in required'); end if;

  select * into v_profile from public.profiles where id=v_uid for update;
  if v_profile.id is null then return jsonb_build_object('success',false,'error','Raahi profile not found'); end if;
  if v_profile.role='admin' then return jsonb_build_object('success',false,'error','Admin accounts cannot self-onboard as Drivers'); end if;
  if v_profile.is_restricted then return jsonb_build_object('success',false,'error','Restricted accounts cannot join as Drivers'); end if;

  select u.phone into v_phone from auth.users u
  where u.id=v_uid and u.phone is not null and length(btrim(u.phone))>0 and u.phone_confirmed_at is not null;
  if v_phone is null then return jsonb_build_object('success',false,'error','Verify your mobile number before joining as a Driver'); end if;

  if exists(
    select 1 from public.seat_requests sr
    join public.trips t on t.id=sr.trip_id
    where sr.passenger_id=v_uid and sr.status in ('HELD','CONFIRMED')
      and t.status in ('ACTIVE_COLLECTING','IN_PROGRESS')
  ) then
    return jsonb_build_object('success',false,'error','Finish or cancel your active Passenger seat request before joining as a Driver');
  end if;
  if exists(
    select 1 from public.outstation_requests r
    where r.passenger_id=v_uid and r.status in ('OPEN','ACCEPTED')
      and greatest(r.departure_at,coalesce(r.return_at,r.departure_at))>now()
  ) then
    return jsonb_build_object('success',false,'error','Finish or cancel your active Outstation booking before joining as a Driver');
  end if;

  if char_length(btrim(coalesce(p_driver_name,''))) not between 2 and 80 then
    return jsonb_build_object('success',false,'error','Enter your full Driver name');
  end if;
  v_registration:=upper(regexp_replace(btrim(coalesce(p_registration_number,'')),'\s+','','g'));
  if char_length(v_registration)<4 or char_length(v_registration)>24 then
    return jsonb_build_object('success',false,'error','Enter a valid vehicle registration number');
  end if;
  if char_length(btrim(coalesce(p_vehicle_model,''))) not between 2 and 80 then
    return jsonb_build_object('success',false,'error','Enter your vehicle model');
  end if;
  if char_length(btrim(coalesce(p_vehicle_type,''))) not between 2 and 40 then
    return jsonb_build_object('success',false,'error','Choose a valid vehicle type');
  end if;
  if p_capacity not in (4,5,6,7,8) then
    return jsonb_build_object('success',false,'error','Vehicle capacity must be between 4 and 8');
  end if;

  select * into v_area from public.outstation_service_areas where id=p_origin_area_id and is_active=true;
  if v_area.id is null then return jsonb_build_object('success',false,'error','Choose an active Raahi origin area'); end if;

  select * into v_existing_driver from public.drivers where profile_id=v_uid for update;
  if v_existing_driver.id is not null and (
    exists(select 1 from public.driver_queue q where q.driver_id=v_existing_driver.id and q.status in ('WAITING','ACTIVE_COLLECTING')) or
    exists(select 1 from public.trips t where t.driver_id=v_existing_driver.id and t.status in ('ACTIVE_COLLECTING','IN_PROGRESS'))
  ) then
    return jsonb_build_object('success',false,'error','Driver or vehicle details cannot change while queued or on a live trip');
  end if;

  select id into v_vehicle_id from public.vehicles where registration_number=v_registration for update;
  if v_vehicle_id is not null and exists(
    select 1 from public.drivers d where d.vehicle_id=v_vehicle_id and d.profile_id<>v_uid
  ) then
    return jsonb_build_object('success',false,'error','This vehicle registration is already associated with another Raahi Driver');
  end if;
  if v_vehicle_id is not null and exists(
    select 1 from public.trips t join public.drivers d on d.id=t.driver_id
    where t.vehicle_id=v_vehicle_id and t.status in ('ACTIVE_COLLECTING','IN_PROGRESS') and d.profile_id<>v_uid
  ) then
    return jsonb_build_object('success',false,'error','This vehicle is attached to another live trip');
  end if;

  insert into public.vehicles(registration_number,vehicle_type,vehicle_model,capacity,is_active)
  values(v_registration,btrim(p_vehicle_type),btrim(p_vehicle_model),p_capacity,true)
  on conflict(registration_number) do update set
    vehicle_type=excluded.vehicle_type,
    vehicle_model=excluded.vehicle_model,
    capacity=excluded.capacity,
    is_active=true
  returning id into v_vehicle_id;

  update public.profiles set
    role='driver',
    display_name=btrim(p_driver_name),
    phone=v_phone,
    updated_at=now()
  where id=v_uid;

  insert into public.drivers(profile_id,vehicle_id,display_name,phone,is_active)
  values(v_uid,v_vehicle_id,btrim(p_driver_name),v_phone,true)
  on conflict(profile_id) do update set
    vehicle_id=excluded.vehicle_id,
    display_name=excluded.display_name,
    phone=excluded.phone,
    is_active=true,
    updated_at=now()
  returning id into v_driver_id;

  insert into public.driver_verifications(driver_id) values(v_driver_id) on conflict(driver_id) do nothing;

  insert into public.driver_outstation_area_preferences(driver_id,area_id,is_enabled)
  values(v_driver_id,v_area.id,true)
  on conflict(driver_id,area_id) do update set is_enabled=true,updated_at=now();

  perform public.record_audit(
    'driver_self_onboard','drivers',v_driver_id,
    case when v_existing_driver.id is null then null else to_jsonb(v_existing_driver) end,
    jsonb_build_object('profile_id',v_uid,'vehicle_id',v_vehicle_id,'registration_number',v_registration,'capacity',p_capacity,'origin_area_id',v_area.id),null
  );

  return jsonb_build_object(
    'success',true,'driver_id',v_driver_id,'vehicle_id',v_vehicle_id,'origin_area_id',v_area.id,
    'next','ACCEPT_DRIVER_TERMS_AND_VERIFY','operations_unlocked',false
  );
end;
$$;

revoke all on function public.self_onboard_as_driver(text,text,text,text,integer,uuid) from public,anon,service_role;
grant execute on function public.self_onboard_as_driver(text,text,text,text,integer,uuid) to authenticated;

-- Preserve historical one-way rows for ordinary status/history updates, but no new
-- Outstation row or journey-field edit may remain one-way.
create or replace function public.enforce_round_trip_outstation_journey()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.travel_type<>'ROUND_TRIP' then
    raise exception 'OUTSTATION_ROUND_TRIP_REQUIRED';
  end if;
  if new.return_at is null or new.return_at<=new.departure_at+interval '1 hour' then
    raise exception 'OUTSTATION_RETURN_REQUIRED';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_round_trip_outstation_journey() from public,anon,authenticated,service_role;

drop trigger if exists outstation_round_trip_only on public.outstation_requests;
drop trigger if exists outstation_round_trip_only_insert on public.outstation_requests;
drop trigger if exists outstation_round_trip_only_update on public.outstation_requests;
create trigger outstation_round_trip_only_insert
before insert on public.outstation_requests
for each row execute function public.enforce_round_trip_outstation_journey();
create trigger outstation_round_trip_only_update
before update of travel_type,departure_at,return_at on public.outstation_requests
for each row execute function public.enforce_round_trip_outstation_journey();

create or replace function public.create_outstation_request_v2(
  p_origin_area_id uuid,p_pickup_text text,p_destination_text text,p_travel_type text,
  p_departure_at timestamptz,p_return_at timestamptz default null,p_passenger_count integer default 1,p_notes text default null
)
returns jsonb language plpgsql security definer set search_path='public'
as $$
declare
  v_profile public.profiles;
  v_area public.outstation_service_areas;
  v_request_id uuid;
  v_destination text:=btrim(coalesce(p_destination_text,''));
  v_pickup text:=btrim(coalesce(p_pickup_text,''));
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Sign in required'); end if;
  select * into v_profile from public.profiles where id=auth.uid();
  if v_profile.id is null or v_profile.role<>'passenger' or v_profile.is_restricted then return jsonb_build_object('success',false,'error','Active Passenger access required'); end if;
  if not exists(select 1 from auth.users where id=auth.uid() and phone is not null and length(btrim(phone))>0 and phone_confirmed_at is not null) then return jsonb_build_object('success',false,'error','Verify your mobile number before requesting an outstation car'); end if;
  select * into v_area from public.outstation_service_areas where id=p_origin_area_id and is_active=true;
  if v_area.id is null then return jsonb_build_object('success',false,'error','Choose an active Raahi pickup area'); end if;
  if char_length(v_pickup)<2 or char_length(v_pickup)>180 then return jsonb_build_object('success',false,'error','Enter the exact pickup locality or address'); end if;
  if char_length(v_destination)<2 or char_length(v_destination)>160 then return jsonb_build_object('success',false,'error','Enter a destination'); end if;
  if upper(btrim(coalesce(p_travel_type,'')))<>'ROUND_TRIP' then return jsonb_build_object('success',false,'error','Raahi Outstation is round trip only at launch'); end if;
  if p_departure_at<now()+interval '1 hour' or p_departure_at>now()+interval '180 days' then return jsonb_build_object('success',false,'error','Choose a departure at least 1 hour ahead and within 180 days'); end if;
  if p_return_at is null or p_return_at<=p_departure_at+interval '1 hour' then return jsonb_build_object('success',false,'error','Choose a return time after the outbound journey'); end if;
  if p_passenger_count<1 or p_passenger_count>8 then return jsonb_build_object('success',false,'error','Passenger count must be 1 to 8'); end if;
  if p_notes is not null and char_length(p_notes)>500 then return jsonb_build_object('success',false,'error','Notes are too long'); end if;
  if (select count(*) from public.outstation_requests where passenger_id=auth.uid() and status='OPEN' and departure_at>now())>=3 then return jsonb_build_object('success',false,'error','You can keep up to 3 open outstation requests'); end if;

  insert into public.outstation_requests(passenger_id,origin_area_id,origin_location_id,pickup_text,destination_text,travel_type,departure_at,return_at,passenger_count,notes)
  values(auth.uid(),v_area.id,v_area.location_id,v_pickup,v_destination,'ROUND_TRIP',p_departure_at,p_return_at,p_passenger_count,nullif(btrim(coalesce(p_notes,'')),''))
  returning id into v_request_id;

  perform public.record_audit('create_outstation_request','outstation_requests',v_request_id,null,
    jsonb_build_object('origin_area_id',v_area.id,'pickup_text',v_pickup,'destination',v_destination,'travel_type','ROUND_TRIP','passenger_count',p_passenger_count),null);
  return jsonb_build_object('success',true,'request_id',v_request_id,'status','OPEN','travel_type','ROUND_TRIP');
end;
$$;

create or replace function public.driver_get_outstation_leads_v2()
returns table(request_id uuid,origin_area_id uuid,origin_name text,pickup_text text,destination_text text,travel_type text,departure_at timestamptz,return_at timestamptz,passenger_count integer,notes text,created_at timestamptz,my_quote_id uuid,my_quote_price integer,my_quote_status text,verification_complete boolean,vehicle_capacity integer)
language plpgsql stable security definer set search_path='public'
as $$
declare v_driver public.drivers; v_capacity integer;
begin
  select d.* into v_driver from public.drivers d join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
  if v_driver.id is null then return; end if;
  if not public.is_driver_launch_compliant(v_driver.id) then return; end if;
  select capacity into v_capacity from public.vehicles where id=v_driver.vehicle_id and is_active=true;
  if coalesce(v_capacity,0)<1 then return; end if;

  return query select req.id,req.origin_area_id,coalesce(a.name,l.name,'Unknown area'),req.pickup_text,req.destination_text,req.travel_type,req.departure_at,req.return_at,
    req.passenger_count,req.notes,req.created_at,q.id,q.total_price,q.status,true,coalesce(v_capacity,0)
  from public.outstation_requests req
  left join public.outstation_service_areas a on a.id=req.origin_area_id
  left join public.locations l on l.id=req.origin_location_id
  left join public.outstation_quotes q on q.request_id=req.id and q.driver_id=v_driver.id
  where req.status='OPEN' and req.departure_at>now()
    and req.travel_type='ROUND_TRIP' and req.return_at is not null
    and not exists(select 1 from public.outstation_driver_ignores ig where ig.request_id=req.id and ig.driver_id=v_driver.id)
    and exists(select 1 from public.driver_outstation_area_preferences pref where pref.driver_id=v_driver.id and pref.area_id=req.origin_area_id and pref.is_enabled)
  order by req.departure_at,req.created_at;
end;
$$;

create or replace function public.driver_send_outstation_quote(
  p_request_id uuid,p_total_price integer,p_includes_tolls boolean default false,p_includes_parking boolean default false,p_driver_note text default null
)
returns jsonb language plpgsql security definer set search_path='public'
as $$
declare
  v_driver public.drivers;
  v_vehicle public.vehicles;
  v_request public.outstation_requests;
  v_quote_id uuid;
  v_expiry timestamptz;
begin
  select d.* into v_driver from public.drivers d join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
  if v_driver.id is null then return jsonb_build_object('success',false,'error','Active Driver access required'); end if;
  if not public.is_driver_launch_compliant(v_driver.id) then return jsonb_build_object('success',false,'error','Complete Raahi Driver verification before sending Outstation quotes'); end if;
  select * into v_vehicle from public.vehicles where id=v_driver.vehicle_id and is_active=true;
  if v_vehicle.id is null then return jsonb_build_object('success',false,'error','Active vehicle required'); end if;
  select * into v_request from public.outstation_requests where id=p_request_id for update;
  if v_request.id is null or v_request.status<>'OPEN' or v_request.departure_at<=now()+interval '30 minutes' then return jsonb_build_object('success',false,'error','This Outstation request is no longer open for quotes'); end if;
  if v_request.travel_type<>'ROUND_TRIP' or v_request.return_at is null then return jsonb_build_object('success',false,'error','Only round-trip Outstation requests can receive quotes'); end if;
  if v_request.origin_area_id is null or not exists(select 1 from public.driver_outstation_area_preferences pref where pref.driver_id=v_driver.id and pref.area_id=v_request.origin_area_id and pref.is_enabled) then return jsonb_build_object('success',false,'error','This lead is outside your selected Outstation areas'); end if;
  if v_vehicle.capacity<v_request.passenger_count then return jsonb_build_object('success',false,'error','Your current vehicle does not have enough passenger capacity'); end if;
  if p_total_price<1 or p_total_price>1000000 then return jsonb_build_object('success',false,'error','Enter a valid total quote'); end if;
  if p_driver_note is not null and char_length(p_driver_note)>300 then return jsonb_build_object('success',false,'error','Quote note is too long'); end if;

  v_expiry:=least(v_request.departure_at-interval '30 minutes',now()+interval '24 hours');
  insert into public.outstation_quotes(request_id,driver_id,vehicle_id,total_price,includes_tolls,includes_parking,driver_note,vehicle_number,vehicle_type,vehicle_model,vehicle_capacity,status,expires_at)
  values(v_request.id,v_driver.id,v_vehicle.id,p_total_price,coalesce(p_includes_tolls,false),coalesce(p_includes_parking,false),nullif(btrim(coalesce(p_driver_note,'')),''),v_vehicle.registration_number,v_vehicle.vehicle_type,v_vehicle.vehicle_model,v_vehicle.capacity,'OFFERED',v_expiry)
  on conflict(request_id,driver_id) do update set
    vehicle_id=excluded.vehicle_id,total_price=excluded.total_price,includes_tolls=excluded.includes_tolls,includes_parking=excluded.includes_parking,
    driver_note=excluded.driver_note,vehicle_number=excluded.vehicle_number,vehicle_type=excluded.vehicle_type,vehicle_model=excluded.vehicle_model,
    vehicle_capacity=excluded.vehicle_capacity,status='OFFERED',expires_at=excluded.expires_at,updated_at=now()
  returning id into v_quote_id;

  delete from public.outstation_driver_ignores where request_id=v_request.id and driver_id=v_driver.id;
  perform public.record_audit('driver_send_outstation_quote','outstation_quotes',v_quote_id,null,
    jsonb_build_object('request_id',v_request.id,'driver_id',v_driver.id,'total_price',p_total_price,'vehicle_number',v_vehicle.registration_number,'origin_area_id',v_request.origin_area_id),null);
  return jsonb_build_object('success',true,'quote_id',v_quote_id,'status','OFFERED','expires_at',v_expiry);
end;
$$;

revoke all on function public.create_outstation_request_v2(uuid,text,text,text,timestamptz,timestamptz,integer,text) from public,anon,service_role;
revoke all on function public.driver_get_outstation_leads_v2() from public,anon,service_role;
revoke all on function public.driver_send_outstation_quote(uuid,integer,boolean,boolean,text) from public,anon,service_role;
grant execute on function public.create_outstation_request_v2(uuid,text,text,text,timestamptz,timestamptz,integer,text) to authenticated;
grant execute on function public.driver_get_outstation_leads_v2() to authenticated;
grant execute on function public.driver_send_outstation_quote(uuid,integer,boolean,boolean,text) to authenticated;