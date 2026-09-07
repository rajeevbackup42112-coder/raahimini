create or replace function private.raahi_trip_driver_vehicle_eligible(p_driver_id uuid,p_vehicle_id uuid,p_origin_market_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select private.carpool_driver_vehicle_eligible(p_driver_id,p_vehicle_id)
   and exists(select 1 from public.driver_operating_markets om where om.driver_id=p_driver_id and om.market_id=p_origin_market_id);
$$;
revoke all on function private.raahi_trip_driver_vehicle_eligible(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function private.raahi_trip_commitment_window(p_product_id uuid,p_rules_version integer,p_departure_at timestamptz,p_return_departure_at timestamptz)
returns tstzrange language sql stable security definer set search_path=''
as $$
 select tstzrange(
  p_departure_at-make_interval(mins=>coalesce((rv.rules->>'commitment_pre_departure_buffer_minutes')::int,0)),
  p_return_departure_at+make_interval(mins=>coalesce((rv.rules->>'commitment_post_return_buffer_minutes')::int,0)),
  '[)')
 from public.service_product_rule_versions rv where rv.product_id=p_product_id and rv.version_no=p_rules_version;
$$;
revoke all on function private.raahi_trip_commitment_window(uuid,integer,timestamptz,timestamptz) from public,anon,authenticated;

create or replace function private.claim_system_command(p_command_name text,p_idempotency_key text,p_request_hash text)
returns public.command_idempotency language plpgsql security definer set search_path=''
as $$
declare v_row public.command_idempotency;
begin
 insert into public.command_idempotency(actor_kind,actor_profile_id,actor_scope,command_name,idempotency_key,request_hash)
 values('SYSTEM',null,'system:raahi-trip',p_command_name,p_idempotency_key,p_request_hash)
 on conflict(actor_scope,command_name,idempotency_key) do nothing;
 select * into v_row from public.command_idempotency where actor_scope='system:raahi-trip' and command_name=p_command_name and idempotency_key=p_idempotency_key for update;
 if v_row.request_hash<>p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 return v_row;
end; $$;
revoke all on function private.claim_system_command(text,text,text) from public,anon,authenticated;
grant execute on function private.claim_system_command(text,text,text) to service_role;

create or replace function private.initialize_round_trip_booking_return_status()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if exists(
  select 1 from public.rides r join public.service_products p on p.id=r.product_id
  where r.id=new.ride_id and (
   p.service_type in ('FIXED_ROUND_TRIP','RAAHI_TRIP')
   or (p.service_type='OUTSTATION' and exists(select 1 from public.outstation_requests os where os.id=new.outstation_request_id and os.travel_type='ROUND_TRIP'))
  )
 ) then new.return_status:='PENDING'; else new.return_status:='NOT_APPLICABLE'; end if;
 return new;
end; $$;

create or replace function private.sync_round_trip_return_expectation()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.status='NO_SHOW' and old.status<>'NO_SHOW' and new.return_status='PENDING'
    and exists(select 1 from public.rides r join public.service_products p on p.id=r.product_id where r.id=new.ride_id and p.service_type in ('FIXED_ROUND_TRIP','RAAHI_TRIP'))
 then new.return_status:='NOT_APPLICABLE'; end if;
 return new;
end; $$;