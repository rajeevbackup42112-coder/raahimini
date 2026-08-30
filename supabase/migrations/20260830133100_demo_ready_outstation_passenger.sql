-- Passenger-facing Outstation commands and read projections.
create or replace function public.get_outstation_origins()
returns table(location_id uuid,location_name text,state text)
language sql stable security definer set search_path to 'public'
as $function$
  select distinct l.id,l.name,l.state
  from public.locations l
  join public.routes r on r.from_location_id=l.id
  where l.is_active=true and r.is_active=true and r.is_current=true and r.version_status='PUBLISHED'
  order by l.name;
$function$;

create or replace function public.create_outstation_request(
  p_origin_location_id uuid,p_destination_text text,p_travel_type text,p_departure_at timestamptz,
  p_return_at timestamptz default null,p_passenger_count integer default 1,p_notes text default null
)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_profile public.profiles; v_request_id uuid; v_type text:=upper(trim(coalesce(p_travel_type,''))); v_destination text:=trim(coalesce(p_destination_text,''));
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Sign in required'); end if;
  select * into v_profile from public.profiles where id=auth.uid();
  if v_profile.id is null or v_profile.role<>'passenger' or v_profile.is_restricted then
    return jsonb_build_object('success',false,'error','Active Passenger access required');
  end if;
  if not exists(select 1 from auth.users where id=auth.uid() and phone is not null and length(btrim(phone))>0 and phone_confirmed_at is not null) then
    return jsonb_build_object('success',false,'error','Verify your mobile number before requesting an outstation car');
  end if;
  if not exists(select 1 from public.routes r join public.locations l on l.id=r.from_location_id where l.id=p_origin_location_id and l.is_active=true and r.is_active=true and r.is_current=true and r.version_status='PUBLISHED') then
    return jsonb_build_object('success',false,'error','Choose a current Raahi origin');
  end if;
  if char_length(v_destination)<2 or char_length(v_destination)>160 then return jsonb_build_object('success',false,'error','Enter a destination'); end if;
  if v_type not in ('ONE_WAY','ROUND_TRIP') then return jsonb_build_object('success',false,'error','Choose one way or round trip'); end if;
  if p_departure_at<now()+interval '1 hour' or p_departure_at>now()+interval '180 days' then
    return jsonb_build_object('success',false,'error','Choose a departure at least 1 hour ahead and within 180 days');
  end if;
  if p_passenger_count<1 or p_passenger_count>8 then return jsonb_build_object('success',false,'error','Passenger count must be 1 to 8'); end if;
  if v_type='ROUND_TRIP' and (p_return_at is null or p_return_at<=p_departure_at+interval '1 hour') then
    return jsonb_build_object('success',false,'error','Choose a return time after the outbound journey');
  end if;
  if v_type='ONE_WAY' then p_return_at:=null; end if;
  if p_notes is not null and char_length(p_notes)>500 then return jsonb_build_object('success',false,'error','Notes are too long'); end if;
  if (select count(*) from public.outstation_requests where passenger_id=auth.uid() and status='OPEN' and departure_at>now())>=3 then
    return jsonb_build_object('success',false,'error','You can keep up to 3 open outstation requests');
  end if;
  insert into public.outstation_requests(passenger_id,origin_location_id,destination_text,travel_type,departure_at,return_at,passenger_count,notes)
  values(auth.uid(),p_origin_location_id,v_destination,v_type,p_departure_at,p_return_at,p_passenger_count,nullif(trim(coalesce(p_notes,'')),''))
  returning id into v_request_id;
  perform public.record_audit('create_outstation_request','outstation_requests',v_request_id,null,jsonb_build_object('origin_location_id',p_origin_location_id,'destination',v_destination,'travel_type',v_type,'passenger_count',p_passenger_count),null);
  return jsonb_build_object('success',true,'request_id',v_request_id,'status','OPEN');
end;
$function$;

create or replace function public.get_my_outstation_requests()
returns table(
  request_id uuid,origin_location_id uuid,origin_name text,destination_text text,travel_type text,departure_at timestamptz,return_at timestamptz,
  passenger_count integer,notes text,status text,quote_count bigint,accepted_quote_id uuid,accepted_price integer,
  accepted_driver_name text,accepted_driver_phone text,accepted_vehicle_number text,accepted_vehicle_model text,created_at timestamptz
)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return; end if;
  return query
  select r.id,r.origin_location_id,l.name,r.destination_text,r.travel_type,r.departure_at,r.return_at,r.passenger_count,r.notes,r.status,
    (select count(*) from public.outstation_quotes qx where qx.request_id=r.id and qx.status='OFFERED' and qx.expires_at>now()),
    r.accepted_quote_id,q.total_price,d.display_name,
    case when r.status='ACCEPTED' then d.phone else null end,
    q.vehicle_number,q.vehicle_model,r.created_at
  from public.outstation_requests r
  join public.locations l on l.id=r.origin_location_id
  left join public.outstation_quotes q on q.id=r.accepted_quote_id
  left join public.drivers d on d.id=q.driver_id
  where r.passenger_id=auth.uid()
  order by case when r.status='OPEN' then 0 when r.status='ACCEPTED' then 1 else 2 end,r.created_at desc;
end;
$function$;

create or replace function public.get_my_outstation_quotes(p_request_id uuid)
returns table(
  quote_id uuid,driver_id uuid,driver_name text,total_price integer,includes_tolls boolean,includes_parking boolean,driver_note text,
  vehicle_number text,vehicle_type text,vehicle_model text,vehicle_capacity integer,quote_status text,expires_at timestamptz,
  driving_licence_verified boolean,vehicle_rc_verified boolean,car_photos_verified boolean,fully_verified boolean,driver_phone text
)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not exists(select 1 from public.outstation_requests r where r.id=p_request_id and (r.passenger_id=auth.uid() or public.is_admin())) then return; end if;
  return query
  select q.id,q.driver_id,d.display_name,q.total_price,q.includes_tolls,q.includes_parking,q.driver_note,
    q.vehicle_number,q.vehicle_type,q.vehicle_model,q.vehicle_capacity,q.status,q.expires_at,
    coalesce(v.driving_licence_status='VERIFIED',false),coalesce(v.vehicle_rc_status='VERIFIED',false),coalesce(v.car_photos_status='VERIFIED',false),
    coalesce(v.driving_licence_status='VERIFIED' and v.vehicle_rc_status='VERIFIED' and v.car_photos_status='VERIFIED',false),
    case when q.status='ACCEPTED' then d.phone else null end
  from public.outstation_quotes q
  join public.drivers d on d.id=q.driver_id
  left join public.driver_verifications v on v.driver_id=q.driver_id
  where q.request_id=p_request_id and q.status in ('OFFERED','ACCEPTED') and (q.status='ACCEPTED' or q.expires_at>now())
  order by case when q.status='ACCEPTED' then 0 else 1 end,q.total_price,q.created_at;
end;
$function$;

create or replace function public.cancel_my_outstation_request(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_request public.outstation_requests;
begin
  select * into v_request from public.outstation_requests where id=p_request_id for update;
  if v_request.id is null or v_request.passenger_id<>auth.uid() then return jsonb_build_object('success',false,'error','Outstation request not found'); end if;
  if v_request.status<>'OPEN' then return jsonb_build_object('success',false,'error','Only an open request can be cancelled'); end if;
  update public.outstation_requests set status='CANCELLED',cancelled_at=now() where id=v_request.id;
  update public.outstation_quotes set status='CLOSED' where request_id=v_request.id and status='OFFERED';
  perform public.record_audit('cancel_outstation_request','outstation_requests',v_request.id,to_jsonb(v_request),jsonb_build_object('status','CANCELLED'),null);
  return jsonb_build_object('success',true,'status','CANCELLED');
end;
$function$;

create or replace function public.accept_outstation_quote(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_quote public.outstation_quotes; v_request public.outstation_requests; v_driver public.drivers; v_vehicle public.vehicles; v_verify public.driver_verifications;
begin
  select * into v_quote from public.outstation_quotes where id=p_quote_id for update;
  if v_quote.id is null then return jsonb_build_object('success',false,'error','Quote not found'); end if;
  select * into v_request from public.outstation_requests where id=v_quote.request_id for update;
  if v_request.passenger_id<>auth.uid() then return jsonb_build_object('success',false,'error','Outstation request not found'); end if;
  if v_request.status<>'OPEN' or v_request.departure_at<=now() then return jsonb_build_object('success',false,'error','This request is no longer accepting a quote'); end if;
  if v_quote.status<>'OFFERED' or v_quote.expires_at<=now() then return jsonb_build_object('success',false,'error','This quote is no longer available'); end if;
  select * into v_driver from public.drivers where id=v_quote.driver_id and is_active=true;
  select * into v_vehicle from public.vehicles where id=v_quote.vehicle_id and is_active=true;
  select * into v_verify from public.driver_verifications where driver_id=v_quote.driver_id;
  if v_driver.id is null or v_vehicle.id is null or v_driver.vehicle_id<>v_quote.vehicle_id or v_vehicle.capacity<v_request.passenger_count then
    return jsonb_build_object('success',false,'error','Driver or vehicle is no longer available for this request');
  end if;
  if not coalesce(v_verify.driving_licence_status='VERIFIED' and v_verify.vehicle_rc_status='VERIFIED' and v_verify.car_photos_status='VERIFIED',false) then
    return jsonb_build_object('success',false,'error','Driver verification is no longer complete');
  end if;
  update public.outstation_quotes set status=case when id=v_quote.id then 'ACCEPTED' else 'CLOSED' end where request_id=v_request.id and status='OFFERED';
  update public.outstation_requests set status='ACCEPTED',accepted_quote_id=v_quote.id,accepted_at=now() where id=v_request.id;
  perform public.record_audit('accept_outstation_quote','outstation_requests',v_request.id,to_jsonb(v_request),jsonb_build_object('status','ACCEPTED','quote_id',v_quote.id,'driver_id',v_quote.driver_id,'total_price',v_quote.total_price),null);
  return jsonb_build_object('success',true,'request_id',v_request.id,'quote_id',v_quote.id,'driver_id',v_quote.driver_id,'driver_phone',v_driver.phone,'vehicle_number',v_quote.vehicle_number,'total_price',v_quote.total_price);
end;
$function$;

revoke all on function public.get_outstation_origins() from public,service_role;
revoke all on function public.create_outstation_request(uuid,text,text,timestamptz,timestamptz,integer,text) from public,anon,service_role;
revoke all on function public.get_my_outstation_requests() from public,anon,service_role;
revoke all on function public.get_my_outstation_quotes(uuid) from public,anon,service_role;
revoke all on function public.cancel_my_outstation_request(uuid) from public,anon,service_role;
revoke all on function public.accept_outstation_quote(uuid) from public,anon,service_role;
grant execute on function public.get_outstation_origins() to anon,authenticated;
grant execute on function public.create_outstation_request(uuid,text,text,timestamptz,timestamptz,integer,text) to authenticated;
grant execute on function public.get_my_outstation_requests() to authenticated;
grant execute on function public.get_my_outstation_quotes(uuid) to authenticated;
grant execute on function public.cancel_my_outstation_request(uuid) to authenticated;
grant execute on function public.accept_outstation_quote(uuid) to authenticated;
