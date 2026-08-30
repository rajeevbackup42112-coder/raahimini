-- Driver Outstation leads, quote, ignore and accepted-booking projections.
create or replace function public.driver_get_outstation_leads()
returns table(
  request_id uuid,origin_location_id uuid,origin_name text,destination_text text,travel_type text,departure_at timestamptz,return_at timestamptz,
  passenger_count integer,notes text,created_at timestamptz,my_quote_id uuid,my_quote_price integer,my_quote_status text,
  verification_complete boolean,vehicle_capacity integer
)
language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_driver public.drivers; v_verify public.driver_verifications; v_capacity integer;
begin
  select d.* into v_driver from public.drivers d join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
  if v_driver.id is null then return; end if;
  select * into v_verify from public.driver_verifications where driver_id=v_driver.id;
  select capacity into v_capacity from public.vehicles where id=v_driver.vehicle_id and is_active=true;
  return query
  select req.id,req.origin_location_id,l.name,req.destination_text,req.travel_type,req.departure_at,req.return_at,
    req.passenger_count,req.notes,req.created_at,q.id,q.total_price,q.status,
    coalesce(v_verify.driving_licence_status='VERIFIED' and v_verify.vehicle_rc_status='VERIFIED' and v_verify.car_photos_status='VERIFIED',false),
    coalesce(v_capacity,0)
  from public.outstation_requests req
  join public.locations l on l.id=req.origin_location_id
  left join public.outstation_quotes q on q.request_id=req.id and q.driver_id=v_driver.id
  where req.status='OPEN' and req.departure_at>now()
    and not exists(select 1 from public.outstation_driver_ignores ig where ig.request_id=req.id and ig.driver_id=v_driver.id)
    and exists(
      select 1 from public.driver_route_preferences rp
      join public.routes r on r.route_family_id=rp.route_family_id
      where rp.driver_id=v_driver.id and r.is_current=true and r.is_active=true and r.version_status='PUBLISHED'
        and r.from_location_id=req.origin_location_id
    )
  order by req.departure_at,req.created_at;
end;
$function$;

create or replace function public.driver_send_outstation_quote(
  p_request_id uuid,p_total_price integer,p_includes_tolls boolean default false,p_includes_parking boolean default false,p_driver_note text default null
)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_driver public.drivers; v_vehicle public.vehicles; v_verify public.driver_verifications; v_request public.outstation_requests; v_quote_id uuid; v_expiry timestamptz;
begin
  select d.* into v_driver from public.drivers d join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
  if v_driver.id is null then return jsonb_build_object('success',false,'error','Active Driver access required'); end if;
  select * into v_vehicle from public.vehicles where id=v_driver.vehicle_id and is_active=true;
  select * into v_verify from public.driver_verifications where driver_id=v_driver.id;
  if v_vehicle.id is null then return jsonb_build_object('success',false,'error','Active vehicle required'); end if;
  if not coalesce(v_verify.driving_licence_status='VERIFIED' and v_verify.vehicle_rc_status='VERIFIED' and v_verify.car_photos_status='VERIFIED',false) then
    return jsonb_build_object('success',false,'error','Complete Driving Licence, RC and car photo verification before sending an outstation quote');
  end if;
  select * into v_request from public.outstation_requests where id=p_request_id for update;
  if v_request.id is null or v_request.status<>'OPEN' or v_request.departure_at<=now()+interval '30 minutes' then
    return jsonb_build_object('success',false,'error','This outstation request is no longer open for quotes');
  end if;
  if not exists(
    select 1 from public.driver_route_preferences rp join public.routes r on r.route_family_id=rp.route_family_id
    where rp.driver_id=v_driver.id and r.is_current=true and r.is_active=true and r.version_status='PUBLISHED' and r.from_location_id=v_request.origin_location_id
  ) then return jsonb_build_object('success',false,'error','This lead is outside your selected Raahi origins'); end if;
  if v_vehicle.capacity<v_request.passenger_count then return jsonb_build_object('success',false,'error','Your current vehicle does not have enough passenger capacity'); end if;
  if p_total_price<1 or p_total_price>1000000 then return jsonb_build_object('success',false,'error','Enter a valid total quote'); end if;
  if p_driver_note is not null and char_length(p_driver_note)>300 then return jsonb_build_object('success',false,'error','Quote note is too long'); end if;
  v_expiry:=least(v_request.departure_at-interval '30 minutes',now()+interval '24 hours');
  insert into public.outstation_quotes(request_id,driver_id,vehicle_id,total_price,includes_tolls,includes_parking,driver_note,vehicle_number,vehicle_type,vehicle_model,vehicle_capacity,status,expires_at)
  values(v_request.id,v_driver.id,v_vehicle.id,p_total_price,coalesce(p_includes_tolls,false),coalesce(p_includes_parking,false),nullif(trim(coalesce(p_driver_note,'')),''),v_vehicle.registration_number,v_vehicle.vehicle_type,v_vehicle.vehicle_model,v_vehicle.capacity,'OFFERED',v_expiry)
  on conflict(request_id,driver_id) do update set
    vehicle_id=excluded.vehicle_id,total_price=excluded.total_price,includes_tolls=excluded.includes_tolls,includes_parking=excluded.includes_parking,
    driver_note=excluded.driver_note,vehicle_number=excluded.vehicle_number,vehicle_type=excluded.vehicle_type,vehicle_model=excluded.vehicle_model,
    vehicle_capacity=excluded.vehicle_capacity,status='OFFERED',expires_at=excluded.expires_at,updated_at=now()
  returning id into v_quote_id;
  delete from public.outstation_driver_ignores where request_id=v_request.id and driver_id=v_driver.id;
  perform public.record_audit('driver_send_outstation_quote','outstation_quotes',v_quote_id,null,jsonb_build_object('request_id',v_request.id,'driver_id',v_driver.id,'total_price',p_total_price,'vehicle_number',v_vehicle.registration_number),null);
  return jsonb_build_object('success',true,'quote_id',v_quote_id,'status','OFFERED','expires_at',v_expiry);
end;
$function$;

create or replace function public.driver_ignore_outstation_request(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_driver_id uuid;
begin
  select d.id into v_driver_id from public.drivers d join public.profiles p on p.id=d.profile_id where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Active Driver access required'); end if;
  if not exists(select 1 from public.outstation_requests r where r.id=p_request_id and r.status='OPEN') then return jsonb_build_object('success',false,'error','Open request not found'); end if;
  if exists(select 1 from public.outstation_quotes q where q.request_id=p_request_id and q.driver_id=v_driver_id and q.status='OFFERED') then
    return jsonb_build_object('success',false,'error','Withdraw your quote before ignoring this request');
  end if;
  insert into public.outstation_driver_ignores(request_id,driver_id) values(p_request_id,v_driver_id) on conflict do nothing;
  return jsonb_build_object('success',true,'ignored',true);
end;
$function$;

create or replace function public.driver_withdraw_outstation_quote(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_driver_id uuid; v_quote public.outstation_quotes;
begin
  select d.id into v_driver_id from public.drivers d join public.profiles p on p.id=d.profile_id where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Active Driver access required'); end if;
  select * into v_quote from public.outstation_quotes where id=p_quote_id and driver_id=v_driver_id for update;
  if v_quote.id is null or v_quote.status<>'OFFERED' then return jsonb_build_object('success',false,'error','Active quote not found'); end if;
  update public.outstation_quotes set status='WITHDRAWN' where id=v_quote.id;
  perform public.record_audit('driver_withdraw_outstation_quote','outstation_quotes',v_quote.id,to_jsonb(v_quote),jsonb_build_object('status','WITHDRAWN'),null);
  return jsonb_build_object('success',true,'status','WITHDRAWN');
end;
$function$;

create or replace function public.driver_get_my_outstation_bookings()
returns table(
  request_id uuid,quote_id uuid,origin_name text,destination_text text,travel_type text,departure_at timestamptz,return_at timestamptz,
  passenger_count integer,passenger_name text,passenger_phone text,total_price integer,includes_tolls boolean,includes_parking boolean,vehicle_number text
)
language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_driver_id uuid;
begin
  select d.id into v_driver_id from public.drivers d join public.profiles p on p.id=d.profile_id where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
  if v_driver_id is null then return; end if;
  return query
  select r.id,q.id,l.name,r.destination_text,r.travel_type,r.departure_at,r.return_at,r.passenger_count,p.display_name,p.phone,
    q.total_price,q.includes_tolls,q.includes_parking,q.vehicle_number
  from public.outstation_quotes q
  join public.outstation_requests r on r.id=q.request_id and r.status='ACCEPTED' and r.accepted_quote_id=q.id
  join public.locations l on l.id=r.origin_location_id
  join public.profiles p on p.id=r.passenger_id
  where q.driver_id=v_driver_id and q.status='ACCEPTED'
  order by r.departure_at;
end;
$function$;

revoke all on function public.driver_get_outstation_leads() from public,anon,service_role;
revoke all on function public.driver_send_outstation_quote(uuid,integer,boolean,boolean,text) from public,anon,service_role;
revoke all on function public.driver_ignore_outstation_request(uuid) from public,anon,service_role;
revoke all on function public.driver_withdraw_outstation_quote(uuid) from public,anon,service_role;
revoke all on function public.driver_get_my_outstation_bookings() from public,anon,service_role;
grant execute on function public.driver_get_outstation_leads() to authenticated;
grant execute on function public.driver_send_outstation_quote(uuid,integer,boolean,boolean,text) to authenticated;
grant execute on function public.driver_ignore_outstation_request(uuid) to authenticated;
grant execute on function public.driver_withdraw_outstation_quote(uuid) to authenticated;
grant execute on function public.driver_get_my_outstation_bookings() to authenticated;
