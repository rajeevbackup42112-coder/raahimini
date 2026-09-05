-- Slice 7B: canonical direct-payment and support commands.

create or replace function private.can_report_case_object(p_object_type text,p_object_id uuid)
returns boolean
language sql
security definer
stable
set search_path=''
as $$
  select case p_object_type
    when 'RIDE' then exists (
      select 1 from public.rides r
      join public.drivers d on d.id=r.driver_id
      where r.id=p_object_id and (
        d.profile_id=auth.uid() or exists (
          select 1 from public.ride_bookings b
          where b.ride_id=r.id and b.passenger_profile_id=auth.uid()
        )
      )
    )
    when 'BOOKING' then exists (
      select 1 from public.ride_bookings b
      join public.rides r on r.id=b.ride_id
      join public.drivers d on d.id=r.driver_id
      where b.id=p_object_id and (b.passenger_profile_id=auth.uid() or d.profile_id=auth.uid())
    )
    when 'PAYMENT' then exists (
      select 1 from public.payment_acknowledgements p
      join public.drivers d on d.id=p.driver_id
      where p.id=p_object_id and (p.passenger_profile_id=auth.uid() or d.profile_id=auth.uid())
    )
    else false
  end;
$$;
revoke all on function private.can_report_case_object(text,uuid) from public, anon, authenticated;
create or replace function private.passenger_mark_payment_paid(
  p_payment_id uuid,p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_idem public.command_idempotency%rowtype;
  v_payment public.payment_acknowledgements%rowtype;
  v_result jsonb;
begin
  v_idem:=private.claim_user_command('passenger_mark_payment_paid',p_idempotency_key,md5(p_payment_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_payment from public.payment_acknowledgements p
  where p.id=p_payment_id and p.passenger_profile_id=auth.uid() for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;

  if v_payment.status='PASSENGER_MARKED_PAID' then
    v_result:=jsonb_build_object('payment_id',v_payment.id,'status',v_payment.status,'marked_paid_at',v_payment.passenger_marked_paid_at);
  elsif v_payment.status<>'DUE' then
    raise exception 'PAYMENT_TRANSITION_INVALID';
  else
    update public.payment_acknowledgements
    set status='PASSENGER_MARKED_PAID',passenger_marked_paid_at=now()
    where id=v_payment.id;
    v_result:=jsonb_build_object('payment_id',v_payment.id,'status','PASSENGER_MARKED_PAID','marked_paid_at',now());
  end if;
  perform private.finish_user_command(v_idem.id,v_result);
  return v_result;
end;
$$;
revoke all on function private.passenger_mark_payment_paid(uuid,text) from public, anon, authenticated;
create or replace function public.passenger_mark_payment_paid(p_payment_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.passenger_mark_payment_paid(p_payment_id,p_idempotency_key); $$;
revoke all on function public.passenger_mark_payment_paid(uuid,text) from public, anon, authenticated;
grant execute on function public.passenger_mark_payment_paid(uuid,text) to authenticated;
create or replace function private.driver_confirm_payment_received(
  p_payment_id uuid,p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_driver_id uuid:=private.current_driver_id();
  v_idem public.command_idempotency%rowtype;
  v_payment public.payment_acknowledgements%rowtype;
  v_result jsonb;
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem:=private.claim_user_command('driver_confirm_payment_received',p_idempotency_key,md5(p_payment_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_payment from public.payment_acknowledgements p
  where p.id=p_payment_id and p.driver_id=v_driver_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;

  if v_payment.status='DRIVER_CONFIRMED_RECEIVED' then
    v_result:=jsonb_build_object('payment_id',v_payment.id,'status',v_payment.status,'confirmed_at',v_payment.driver_confirmed_received_at);
  elsif v_payment.status<>'PASSENGER_MARKED_PAID' then
    raise exception 'PAYMENT_TRANSITION_INVALID';
  else
    update public.payment_acknowledgements
    set status='DRIVER_CONFIRMED_RECEIVED',driver_confirmed_received_at=now()
    where id=v_payment.id;
    v_result:=jsonb_build_object('payment_id',v_payment.id,'status','DRIVER_CONFIRMED_RECEIVED','confirmed_at',now());
  end if;
  perform private.finish_user_command(v_idem.id,v_result);
  return v_result;
end;
$$;
revoke all on function private.driver_confirm_payment_received(uuid,text) from public, anon, authenticated;
create or replace function public.driver_confirm_payment_received(p_payment_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.driver_confirm_payment_received(p_payment_id,p_idempotency_key); $$;
revoke all on function public.driver_confirm_payment_received(uuid,text) from public, anon, authenticated;
grant execute on function public.driver_confirm_payment_received(uuid,text) to authenticated;
create or replace function private.report_payment_issue(
  p_payment_id uuid,p_details text,p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_driver_id uuid:=private.current_driver_id();
  v_idem public.command_idempotency%rowtype;
  v_payment public.payment_acknowledgements%rowtype;
  v_market_id uuid;
  v_case_id uuid;
  v_result jsonb;
  v_hash text:=md5(concat_ws('|',p_payment_id,p_details));
begin
  if p_details is null or char_length(btrim(p_details))<3 then raise exception 'CASE_DETAILS_REQUIRED'; end if;
  v_idem:=private.claim_user_command('report_payment_issue',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_payment from public.payment_acknowledgements p where p.id=p_payment_id for update;
  if not found or not (v_payment.passenger_profile_id=auth.uid() or v_payment.driver_id=v_driver_id) then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if v_payment.status='DRIVER_CONFIRMED_RECEIVED' then raise exception 'PAYMENT_TRANSITION_INVALID'; end if;
  if v_payment.status='PAYMENT_DISPUTED' then
    v_result:=jsonb_build_object('payment_id',v_payment.id,'status',v_payment.status,'case_id',v_payment.dispute_case_id);
    perform private.finish_user_command(v_idem.id,v_result);
    return v_result;
  end if;

  select r.origin_market_id into v_market_id from public.rides r where r.id=v_payment.ride_id;
  insert into public.cases(reporter_profile_id,origin_market_id,object_type,object_id,category,details)
  values(auth.uid(),v_market_id,'PAYMENT',v_payment.id,'PAYMENT_PROBLEM',btrim(p_details))
  returning id into v_case_id;
  update public.payment_acknowledgements
  set status='PAYMENT_DISPUTED',disputed_at=now(),dispute_case_id=v_case_id
  where id=v_payment.id;
  v_result:=jsonb_build_object('payment_id',v_payment.id,'status','PAYMENT_DISPUTED','case_id',v_case_id);
  perform private.finish_user_command(v_idem.id,v_result);
  return v_result;
end;
$$;
revoke all on function private.report_payment_issue(uuid,text,text) from public, anon, authenticated;
create or replace function public.report_payment_issue(p_payment_id uuid,p_details text,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.report_payment_issue(p_payment_id,p_details,p_idempotency_key); $$;
revoke all on function public.report_payment_issue(uuid,text,text) from public, anon, authenticated;
grant execute on function public.report_payment_issue(uuid,text,text) to authenticated;

create or replace function private.report_issue(
  p_object_type text,p_object_id uuid,p_category text,p_details text,p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_idem public.command_idempotency%rowtype;
  v_market_id uuid;
  v_case_id uuid;
  v_result jsonb;
  v_hash text:=md5(concat_ws('|',p_object_type,p_object_id,p_category,p_details));
begin  if p_category not in (
    'SAFETY','DRIVER_DID_NOT_ARRIVE','PASSENGER_DID_NOT_ARRIVE','WRONG_VEHICLE',
    'PAYMENT_PROBLEM','FARE_DISAGREEMENT','BEHAVIOUR','BREAKDOWN','APP_SYSTEM_PROBLEM','OTHER'
  ) then raise exception 'CASE_CATEGORY_INVALID'; end if;
  if p_details is null or char_length(btrim(p_details))<3 then raise exception 'CASE_DETAILS_REQUIRED'; end if;
  if not private.can_report_case_object(p_object_type,p_object_id) then raise exception 'CASE_OBJECT_NOT_FOUND'; end if;
  v_idem:=private.claim_user_command('report_issue',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  if p_object_type='RIDE' then
    select r.origin_market_id into v_market_id from public.rides r where r.id=p_object_id;
  elsif p_object_type='BOOKING' then
    select r.origin_market_id into v_market_id
    from public.ride_bookings b join public.rides r on r.id=b.ride_id where b.id=p_object_id;
  elsif p_object_type='PAYMENT' then
    select r.origin_market_id into v_market_id
    from public.payment_acknowledgements p join public.rides r on r.id=p.ride_id where p.id=p_object_id;
  else raise exception 'CASE_OBJECT_NOT_FOUND'; end if;

  insert into public.cases(reporter_profile_id,origin_market_id,object_type,object_id,category,details)
  values(auth.uid(),v_market_id,p_object_type,p_object_id,p_category,btrim(p_details))
  returning id into v_case_id;
  v_result:=jsonb_build_object('case_id',v_case_id,'status','OPEN');
  perform private.finish_user_command(v_idem.id,v_result);
  return v_result;
end;
$$;revoke all on function private.report_issue(text,uuid,text,text,text) from public, anon, authenticated;
create or replace function public.report_issue(
  p_object_type text,p_object_id uuid,p_category text,p_details text,p_idempotency_key text
)
returns jsonb language sql security invoker set search_path=''
as $$ select private.report_issue(p_object_type,p_object_id,p_category,p_details,p_idempotency_key); $$;
revoke all on function public.report_issue(text,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.report_issue(text,uuid,text,text,text) to authenticated;

-- Public wrappers execute under the authenticated caller, so only these private
-- implementations receive authenticated EXECUTE. Tables remain inaccessible directly.
grant usage on schema private to authenticated;
grant execute on function private.passenger_mark_payment_paid(uuid,text) to authenticated;
grant execute on function private.driver_confirm_payment_received(uuid,text) to authenticated;
grant execute on function private.report_payment_issue(uuid,text,text) to authenticated;
grant execute on function private.report_issue(text,uuid,text,text,text) to authenticated;
grant execute on function private.can_report_case_object(text,uuid) to authenticated;