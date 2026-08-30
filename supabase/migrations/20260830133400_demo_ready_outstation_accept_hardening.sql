-- Serialize Outstation acceptance by request first, then quote, avoiding lock-order deadlocks.
create or replace function public.accept_outstation_quote(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_quote public.outstation_quotes; v_request public.outstation_requests; v_driver public.drivers; v_vehicle public.vehicles; v_verify public.driver_verifications; v_request_id uuid;
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Sign in required'); end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='passenger' and not p.is_restricted) then
    return jsonb_build_object('success',false,'error','Active Passenger access required');
  end if;
  if not exists(select 1 from auth.users where id=auth.uid() and phone is not null and length(btrim(phone))>0 and phone_confirmed_at is not null) then
    return jsonb_build_object('success',false,'error','Verify your mobile number before accepting an outstation quote');
  end if;
  select q.request_id into v_request_id from public.outstation_quotes q where q.id=p_quote_id;
  if v_request_id is null then return jsonb_build_object('success',false,'error','Quote not found'); end if;
  select * into v_request from public.outstation_requests where id=v_request_id for update;
  if v_request.id is null or v_request.passenger_id<>auth.uid() then return jsonb_build_object('success',false,'error','Outstation request not found'); end if;
  if v_request.status<>'OPEN' or v_request.departure_at<=now() then return jsonb_build_object('success',false,'error','This request is no longer accepting a quote'); end if;
  select * into v_quote from public.outstation_quotes where id=p_quote_id and request_id=v_request.id for update;
  if v_quote.id is null or v_quote.status<>'OFFERED' or v_quote.expires_at<=now() then return jsonb_build_object('success',false,'error','This quote is no longer available'); end if;
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
revoke all on function public.accept_outstation_quote(uuid) from public,anon,service_role;
grant execute on function public.accept_outstation_quote(uuid) to authenticated;
