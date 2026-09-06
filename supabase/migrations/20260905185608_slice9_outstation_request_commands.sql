-- Slice 9B: Outstation command helpers, Passenger request, Driver preference and planned availability.

create or replace function private.claim_user_command(
  p_command_name text, p_idempotency_key text, p_request_hash text
) returns public.command_idempotency
language plpgsql security definer set search_path=''
as $$
declare v_row public.command_idempotency; v_profile uuid:=auth.uid(); v_scope text;
begin
  if v_profile is null then raise exception 'UNAUTHENTICATED'; end if;
  v_scope := 'profile:' || v_profile::text;
  insert into public.command_idempotency(actor_kind,actor_profile_id,actor_scope,command_name,idempotency_key,request_hash)
  values('USER',v_profile,v_scope,p_command_name,p_idempotency_key,p_request_hash)
  on conflict(actor_scope,command_name,idempotency_key) do nothing;
  select * into v_row from public.command_idempotency
   where actor_scope=v_scope and command_name=p_command_name and idempotency_key=p_idempotency_key
   for update;
  if v_row.request_hash<>p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return v_row;
end; $$;
revoke all on function private.claim_user_command(text,text,text) from public,anon,authenticated;

create or replace function private.complete_user_command(p_command_id uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$ begin
  update public.command_idempotency set status='SUCCEEDED',result=p_result,completed_at=now() where id=p_command_id;
  return p_result;
end; $$;
revoke all on function private.complete_user_command(uuid,jsonb) from public,anon,authenticated;
create or replace function private.outstation_product_is_live(p_product_id uuid)
returns boolean language sql security definer stable set search_path=''
as $$
  select exists(
    select 1 from public.service_products p
    join public.markets m on m.id=p.market_id
    where p.id=p_product_id and p.service_type='OUTSTATION'
      and p.status in ('PILOT','ACTIVE') and m.status in ('PILOT','ACTIVE','SCALING')
  );
$$;
revoke all on function private.outstation_product_is_live(uuid) from public,anon,authenticated;

create or replace function private.outstation_commitment_window(p_request_id uuid)
returns tstzrange language sql security definer stable set search_path=''
as $$
  select tstzrange(
    r.departure_at - make_interval(mins=>coalesce((rv.rules->>'pre_departure_buffer_minutes')::int,0)),
    (case when r.travel_type='ROUND_TRIP' then r.return_at
          else r.departure_at + make_interval(mins=>coalesce((rv.rules->>'one_way_commitment_minutes')::int,720)) end)
      + make_interval(mins=>coalesce((rv.rules->>'post_return_buffer_minutes')::int,0)),
    '[)'
  )
  from public.outstation_requests r
  join public.service_product_rule_versions rv on rv.product_id=r.product_id and rv.version_no=r.product_rules_version
  where r.id=p_request_id;
$$;
revoke all on function private.outstation_commitment_window(uuid) from public,anon,authenticated;
create or replace function private.passenger_create_outstation_request(
  p_product_id uuid, p_origin_location_id uuid, p_destination_location_id uuid,
  p_destination_text text, p_travel_type text, p_departure_at timestamptz,
  p_return_at timestamptz, p_passenger_count integer, p_passenger_note text,
  p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_profile uuid:=auth.uid(); v_product public.service_products%rowtype; v_rules jsonb;
  v_hash text; v_idem public.command_idempotency; v_request_id uuid; v_result jsonb;
  v_min_lead int; v_horizon int; v_max_passengers int;
begin
  if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
  v_hash:=md5(concat_ws('|',p_product_id,p_origin_location_id,p_destination_location_id,trim(p_destination_text),p_travel_type,p_departure_at,p_return_at,p_passenger_count,coalesce(p_passenger_note,'')));
  v_idem:=private.claim_user_command('passenger_create_outstation_request',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_product from public.service_products where id=p_product_id;
  if v_product.id is null or not private.outstation_product_is_live(p_product_id) then raise exception 'OUTSTATION_PRODUCT_NOT_AVAILABLE'; end if;
  select rv.rules into v_rules from public.service_product_rule_versions rv
   where rv.product_id=v_product.id and rv.version_no=v_product.current_rules_version;
  v_min_lead:=coalesce((v_rules->>'min_departure_lead_minutes')::int,30);
  v_horizon:=coalesce((v_rules->>'max_request_horizon_days')::int,60);
  v_max_passengers:=coalesce((v_rules->>'max_passengers_per_request')::int,8);
  if p_departure_at<now()+make_interval(mins=>v_min_lead) or p_departure_at>now()+make_interval(days=>v_horizon) then raise exception 'OUTSTATION_DEPARTURE_INVALID'; end if;
  if p_passenger_count<1 or p_passenger_count>v_max_passengers then raise exception 'OUTSTATION_PASSENGER_COUNT_INVALID'; end if;
  if trim(coalesce(p_destination_text,''))='' then raise exception 'OUTSTATION_DESTINATION_REQUIRED'; end if;
  if p_travel_type not in ('ONE_WAY','ROUND_TRIP') then raise exception 'OUTSTATION_TRAVEL_TYPE_INVALID'; end if;
  if (p_travel_type='ONE_WAY' and p_return_at is not null) or (p_travel_type='ROUND_TRIP' and (p_return_at is null or p_return_at<=p_departure_at)) then raise exception 'OUTSTATION_RETURN_INVALID'; end if;
  if p_origin_location_id is not null and not exists(select 1 from public.locations l where l.id=p_origin_location_id and l.market_id=v_product.market_id and l.is_active) then raise exception 'OUTSTATION_ORIGIN_INVALID'; end if;
  if p_destination_location_id is not null and not exists(select 1 from public.locations l where l.id=p_destination_location_id and l.is_active) then raise exception 'OUTSTATION_DESTINATION_INVALID'; end if;
  insert into public.outstation_requests(
    product_id,product_rules_version,passenger_profile_id,origin_market_id,
    origin_location_id,destination_location_id,destination_text,travel_type,
    departure_at,return_at,passenger_count,passenger_note
  ) values(
    v_product.id,v_product.current_rules_version,v_profile,v_product.market_id,
    p_origin_location_id,p_destination_location_id,trim(p_destination_text),p_travel_type,
    p_departure_at,p_return_at,p_passenger_count,nullif(trim(coalesce(p_passenger_note,'')),'')
  ) returning id into v_request_id;
  v_result:=jsonb_build_object('request_id',v_request_id,'status','OPEN','product_id',v_product.id);
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.passenger_create_outstation_request(uuid,uuid,uuid,text,text,timestamptz,timestamptz,integer,text,text) from public,anon,authenticated;
grant execute on function private.passenger_create_outstation_request(uuid,uuid,uuid,text,text,timestamptz,timestamptz,integer,text,text) to authenticated;

create or replace function public.passenger_create_outstation_request(
  p_product_id uuid,p_origin_location_id uuid,p_destination_location_id uuid,
  p_destination_text text,p_travel_type text,p_departure_at timestamptz,p_return_at timestamptz,
  p_passenger_count integer,p_passenger_note text,p_idempotency_key text
) returns jsonb language sql security invoker set search_path=''
as $$ select private.passenger_create_outstation_request(p_product_id,p_origin_location_id,p_destination_location_id,p_destination_text,p_travel_type,p_departure_at,p_return_at,p_passenger_count,p_passenger_note,p_idempotency_key); $$;
revoke all on function public.passenger_create_outstation_request(uuid,uuid,uuid,text,text,timestamptz,timestamptz,integer,text,text) from public,anon,authenticated;
grant execute on function public.passenger_create_outstation_request(uuid,uuid,uuid,text,text,timestamptz,timestamptz,integer,text,text) to authenticated;
create or replace function private.driver_set_outstation_preference(
  p_product_id uuid,p_enabled boolean,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_profile uuid:=auth.uid(); v_driver uuid; v_hash text; v_idem public.command_idempotency; v_result jsonb;
begin
  select d.id into v_driver from public.drivers d where d.profile_id=v_profile and d.standing='ACTIVE';
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_hash:=md5(concat_ws('|',p_product_id,p_enabled));
  v_idem:=private.claim_user_command('driver_set_outstation_preference',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  if not exists(select 1 from public.service_products p where p.id=p_product_id and p.service_type='OUTSTATION' and p.status in ('PILOT','ACTIVE')) then raise exception 'OUTSTATION_PRODUCT_NOT_AVAILABLE'; end if;
  insert into public.driver_product_preferences(driver_id,product_id,is_enabled,updated_at)
  values(v_driver,p_product_id,p_enabled,now())
  on conflict(driver_id,product_id) do update set is_enabled=excluded.is_enabled,updated_at=now();
  v_result:=jsonb_build_object('driver_id',v_driver,'product_id',p_product_id,'is_enabled',p_enabled);
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_set_outstation_preference(uuid,boolean,text) from public,anon,authenticated;
grant execute on function private.driver_set_outstation_preference(uuid,boolean,text) to authenticated;
create or replace function public.driver_set_outstation_preference(p_product_id uuid,p_enabled boolean,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.driver_set_outstation_preference(p_product_id,p_enabled,p_idempotency_key); $$;
revoke all on function public.driver_set_outstation_preference(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.driver_set_outstation_preference(uuid,boolean,text) to authenticated;
create or replace function private.driver_set_planned_market_availability(
  p_market_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_profile uuid:=auth.uid(); v_driver uuid; v_hash text; v_idem public.command_idempotency; v_id uuid; v_result jsonb;
begin
  select d.id into v_driver from public.drivers d where d.profile_id=v_profile and d.standing='ACTIVE';
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_hash:=md5(concat_ws('|',p_market_id,p_starts_at,p_ends_at));
  v_idem:=private.claim_user_command('driver_set_planned_market_availability',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  if p_ends_at<=p_starts_at or p_ends_at<=now() then raise exception 'PLANNED_AVAILABILITY_INVALID'; end if;
  if not exists(select 1 from public.markets m where m.id=p_market_id and m.status in ('PILOT','ACTIVE','SCALING')) then raise exception 'MARKET_NOT_AVAILABLE'; end if;
  insert into public.driver_planned_market_availability(driver_id,market_id,starts_at,ends_at)
  values(v_driver,p_market_id,p_starts_at,p_ends_at) returning id into v_id;
  v_result:=jsonb_build_object('availability_id',v_id,'market_id',p_market_id,'starts_at',p_starts_at,'ends_at',p_ends_at,'status','ACTIVE');
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_set_planned_market_availability(uuid,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function private.driver_set_planned_market_availability(uuid,timestamptz,timestamptz,text) to authenticated;
create or replace function public.driver_set_planned_market_availability(p_market_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.driver_set_planned_market_availability(p_market_id,p_starts_at,p_ends_at,p_idempotency_key); $$;
revoke all on function public.driver_set_planned_market_availability(uuid,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.driver_set_planned_market_availability(uuid,timestamptz,timestamptz,text) to authenticated;
create or replace function private.passenger_cancel_outstation_request(p_request_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_profile uuid:=auth.uid(); v_hash text; v_idem public.command_idempotency; v_req public.outstation_requests%rowtype; v_result jsonb;
begin
  if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
  v_hash:=md5(p_request_id::text);
  v_idem:=private.claim_user_command('passenger_cancel_outstation_request',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_req from public.outstation_requests where id=p_request_id and passenger_profile_id=v_profile for update;
  if v_req.id is null then raise exception 'OUTSTATION_REQUEST_NOT_FOUND'; end if;
  if v_req.status not in ('OPEN','REOPENED') then raise exception 'OUTSTATION_REQUEST_NOT_CANCELLABLE'; end if;
  update public.outstation_requests set status='CANCELLED',cancelled_at=now() where id=v_req.id;
  update public.outstation_quotes set status='CLOSED' where request_id=v_req.id and status='ACTIVE';
  v_result:=jsonb_build_object('request_id',v_req.id,'status','CANCELLED');
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.passenger_cancel_outstation_request(uuid,text) from public,anon,authenticated;
grant execute on function private.passenger_cancel_outstation_request(uuid,text) to authenticated;
create or replace function public.passenger_cancel_outstation_request(p_request_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.passenger_cancel_outstation_request(p_request_id,p_idempotency_key); $$;
revoke all on function public.passenger_cancel_outstation_request(uuid,text) from public,anon,authenticated;
grant execute on function public.passenger_cancel_outstation_request(uuid,text) to authenticated;