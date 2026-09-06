-- Slice 9C: Driver audience eligibility, ignore and immutable quote revisions.

create or replace function private.outstation_driver_eligible(
  p_request_id uuid,p_driver_id uuid,p_vehicle_id uuid
) returns boolean language sql security definer stable set search_path=''
as $$
  select exists(
    select 1
    from public.outstation_requests r
    join public.service_products p on p.id=r.product_id
    join public.markets m on m.id=r.origin_market_id
    join public.drivers d on d.id=p_driver_id and d.standing='ACTIVE'
    join public.driver_product_preferences pref on pref.driver_id=d.id and pref.product_id=p.id and pref.is_enabled
    join public.driver_active_vehicles av on av.driver_id=d.id and av.vehicle_id=p_vehicle_id
    join public.driver_vehicle_access dva on dva.driver_id=d.id and dva.vehicle_id=p_vehicle_id and dva.revoked_at is null
    join public.vehicles v on v.id=p_vehicle_id and v.status='ELIGIBLE' and v.bookable_passenger_capacity>=r.passenger_count
    where r.id=p_request_id and r.status in ('OPEN','REOPENED') and r.departure_at>now()
      and p.service_type='OUTSTATION' and p.status in ('PILOT','ACTIVE')
      and m.status in ('PILOT','ACTIVE','SCALING')
      and (exists(select 1 from public.driver_operating_markets om where om.driver_id=d.id and om.market_id=r.origin_market_id)
        or exists(select 1 from public.driver_planned_market_availability pa
          where pa.driver_id=d.id and pa.market_id=r.origin_market_id and pa.status='ACTIVE'
            and pa.starts_at<=lower(private.outstation_commitment_window(r.id))
            and pa.ends_at>=upper(private.outstation_commitment_window(r.id))))
      and not exists (
        select 1 from (values ('PHONE'),('DRIVING_LICENCE'),('DRIVER_PHOTO')) req(t)
        where not exists (select 1 from public.verification_records vr
          where vr.driver_id=d.id and vr.verification_type=req.t and vr.status='VERIFIED'
            and (vr.expires_at is null or vr.expires_at>now()))
      )      and not exists (
        select 1 from (values ('VEHICLE_RC'),('VEHICLE_PHOTOS')) req(t)
        where not exists (select 1 from public.verification_records vr
          where vr.vehicle_id=p_vehicle_id and vr.verification_type=req.t and vr.status='VERIFIED'
            and (vr.expires_at is null or vr.expires_at>now()))
      )
      and not exists (
        select 1 from public.mobility_commitments c
        where (c.driver_id=d.id or c.vehicle_id=p_vehicle_id)
          and c.status in ('RESERVED','ACTIVE')
          and c.starts_at<upper(private.outstation_commitment_window(r.id))
          and c.ends_at>lower(private.outstation_commitment_window(r.id))
      )
  );
$$;
revoke all on function private.outstation_driver_eligible(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function private.driver_ignore_outstation_request(p_request_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_profile uuid:=auth.uid(); v_driver uuid; v_hash text; v_idem public.command_idempotency; v_result jsonb;
begin
  select d.id into v_driver from public.drivers d where d.profile_id=v_profile and d.standing='ACTIVE';
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_hash:=md5(p_request_id::text);
  v_idem:=private.claim_user_command('driver_ignore_outstation_request',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  if not exists(select 1 from public.outstation_requests r where r.id=p_request_id and r.status in ('OPEN','REOPENED')) then raise exception 'OUTSTATION_REQUEST_NOT_AVAILABLE'; end if;
  insert into public.outstation_driver_ignores(request_id,driver_id) values(p_request_id,v_driver)
  on conflict(request_id,driver_id) do nothing;
  v_result:=jsonb_build_object('request_id',p_request_id,'ignored',true);
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_ignore_outstation_request(uuid,text) from public,anon,authenticated;
grant execute on function private.driver_ignore_outstation_request(uuid,text) to authenticated;
create or replace function public.driver_ignore_outstation_request(p_request_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.driver_ignore_outstation_request(p_request_id,p_idempotency_key); $$;
revoke all on function public.driver_ignore_outstation_request(uuid,text) from public,anon,authenticated;
grant execute on function public.driver_ignore_outstation_request(uuid,text) to authenticated;

create or replace function private.driver_submit_outstation_quote(
  p_request_id uuid,p_vehicle_id uuid,p_total_price_inr integer,
  p_includes_tolls boolean,p_includes_parking boolean,p_commercial_note text,
  p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_profile uuid:=auth.uid(); v_driver uuid; v_req public.outstation_requests%rowtype;
  v_quote public.outstation_quotes%rowtype; v_rules jsonb; v_revision_no int;
  v_revision_id uuid; v_valid_until timestamptz; v_hash text;
  v_idem public.command_idempotency; v_result jsonb;
begin
  select d.id into v_driver from public.drivers d where d.profile_id=v_profile and d.standing='ACTIVE';
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_hash:=md5(concat_ws('|',p_request_id,p_vehicle_id,p_total_price_inr,p_includes_tolls,p_includes_parking,coalesce(p_commercial_note,'')));
  v_idem:=private.claim_user_command('driver_submit_outstation_quote',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_req from public.outstation_requests where id=p_request_id for update;
  if v_req.id is null or v_req.status not in ('OPEN','REOPENED') or v_req.departure_at<=now() then raise exception 'OUTSTATION_REQUEST_NOT_AVAILABLE'; end if;
  if p_total_price_inr<=0 then raise exception 'OUTSTATION_QUOTE_PRICE_INVALID'; end if;
  if not private.outstation_driver_eligible(v_req.id,v_driver,p_vehicle_id) then raise exception 'OUTSTATION_DRIVER_NOT_ELIGIBLE'; end if;
  select rv.rules into v_rules from public.service_product_rule_versions rv
   where rv.product_id=v_req.product_id and rv.version_no=v_req.product_rules_version;
  v_valid_until:=least(v_req.departure_at,now()+make_interval(mins=>coalesce((v_rules->>'quote_validity_minutes')::int,60)));
  if v_valid_until<=now() then raise exception 'OUTSTATION_QUOTE_WINDOW_CLOSED'; end if;

  insert into public.outstation_quotes(request_id,driver_id) values(v_req.id,v_driver)
  on conflict(request_id,driver_id) do nothing;
  select * into v_quote from public.outstation_quotes where request_id=v_req.id and driver_id=v_driver for update;
  if v_quote.status='ACCEPTED' then raise exception 'OUTSTATION_QUOTE_ALREADY_ACCEPTED'; end if;
  v_revision_no:=v_quote.current_revision_no+1;
  insert into public.outstation_quote_revisions(
    quote_id,revision_no,vehicle_id,total_price_inr,includes_tolls,includes_parking,commercial_note,valid_until
  ) values(
    v_quote.id,v_revision_no,p_vehicle_id,p_total_price_inr,p_includes_tolls,p_includes_parking,
    nullif(trim(coalesce(p_commercial_note,'')),''),v_valid_until
  ) returning id into v_revision_id;
  update public.outstation_quotes set status='ACTIVE',current_revision_no=v_revision_no where id=v_quote.id;
  delete from public.outstation_driver_ignores where request_id=v_req.id and driver_id=v_driver;
  v_result:=jsonb_build_object('quote_id',v_quote.id,'revision_id',v_revision_id,'revision_no',v_revision_no,
    'request_id',v_req.id,'total_price_inr',p_total_price_inr,'valid_until',v_valid_until,'status','ACTIVE');
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_submit_outstation_quote(uuid,uuid,integer,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function private.driver_submit_outstation_quote(uuid,uuid,integer,boolean,boolean,text,text) to authenticated;
create or replace function public.driver_submit_outstation_quote(
  p_request_id uuid,p_vehicle_id uuid,p_total_price_inr integer,
  p_includes_tolls boolean,p_includes_parking boolean,p_commercial_note text,p_idempotency_key text
) returns jsonb language sql security invoker set search_path=''
as $$ select private.driver_submit_outstation_quote(p_request_id,p_vehicle_id,p_total_price_inr,p_includes_tolls,p_includes_parking,p_commercial_note,p_idempotency_key); $$;
revoke all on function public.driver_submit_outstation_quote(uuid,uuid,integer,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.driver_submit_outstation_quote(uuid,uuid,integer,boolean,boolean,text,text) to authenticated;

create or replace function private.driver_withdraw_outstation_quote(p_quote_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_profile uuid:=auth.uid(); v_driver uuid; v_quote public.outstation_quotes%rowtype; v_req public.outstation_requests%rowtype; v_hash text; v_idem public.command_idempotency; v_result jsonb;
begin
  select d.id into v_driver from public.drivers d where d.profile_id=v_profile;
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_hash:=md5(p_quote_id::text);
  v_idem:=private.claim_user_command('driver_withdraw_outstation_quote',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_quote from public.outstation_quotes where id=p_quote_id and driver_id=v_driver for update;
  if v_quote.id is null then raise exception 'OUTSTATION_QUOTE_NOT_FOUND'; end if;
  select * into v_req from public.outstation_requests where id=v_quote.request_id for update;
  if v_req.status not in ('OPEN','REOPENED') or v_quote.status<>'ACTIVE' then raise exception 'OUTSTATION_QUOTE_NOT_WITHDRAWABLE'; end if;
  update public.outstation_quotes set status='WITHDRAWN' where id=v_quote.id;
  v_result:=jsonb_build_object('quote_id',v_quote.id,'request_id',v_req.id,'status','WITHDRAWN');
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_withdraw_outstation_quote(uuid,text) from public,anon,authenticated;
grant execute on function private.driver_withdraw_outstation_quote(uuid,text) to authenticated;
create or replace function public.driver_withdraw_outstation_quote(p_quote_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.driver_withdraw_outstation_quote(p_quote_id,p_idempotency_key); $$;
revoke all on function public.driver_withdraw_outstation_quote(uuid,text) from public,anon,authenticated;
grant execute on function public.driver_withdraw_outstation_quote(uuid,text) to authenticated;