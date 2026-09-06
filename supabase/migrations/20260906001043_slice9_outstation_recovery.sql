-- Slice 9F: accepted Driver cancellation reopens demand without reviving old quotes.

create or replace function private.driver_cancel_outstation_agreement(
  p_agreement_id uuid,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_profile uuid:=auth.uid(); v_driver uuid; v_agreement public.outstation_agreements%rowtype;
  v_req public.outstation_requests%rowtype; v_ride public.rides%rowtype;
  v_hash text; v_idem public.command_idempotency; v_result jsonb;
begin
  select d.id into v_driver from public.drivers d where d.profile_id=v_profile;
  if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_hash:=md5(p_agreement_id::text);
  v_idem:=private.claim_user_command('driver_cancel_outstation_agreement',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;

  select * into v_agreement from public.outstation_agreements
   where id=p_agreement_id and driver_id=v_driver for update;
  if v_agreement.id is null then raise exception 'OUTSTATION_AGREEMENT_NOT_FOUND'; end if;
  if v_agreement.status<>'ACTIVE' then raise exception 'OUTSTATION_AGREEMENT_NOT_CANCELLABLE'; end if;

  select * into v_req from public.outstation_requests where id=v_agreement.request_id for update;
  select * into v_ride from public.rides where outstation_agreement_id=v_agreement.id for update;
  if v_req.status<>'CONFIRMED' or v_req.accepted_agreement_id<>v_agreement.id then
    raise exception 'OUTSTATION_REQUEST_NOT_CONFIRMED';
  end if;
  if v_ride.id is null or v_ride.status<>'UPCOMING' then
    raise exception 'OUTSTATION_ALREADY_IN_FULFILMENT';
  end if;
  update public.outstation_agreements
     set status='DRIVER_CANCELLED',cancelled_at=now()
   where id=v_agreement.id;
  update public.mobility_commitments
     set status='RELEASED'
   where id=v_agreement.commitment_id and status in ('RESERVED','ACTIVE');
  update public.rides set status='CANCELLED' where id=v_ride.id;
  update public.ride_bookings set status='CANCELLED' where ride_id=v_ride.id and status='ASSIGNED';
  update public.outstation_quotes set status='CLOSED'
   where request_id=v_req.id and status in ('ACTIVE','ACCEPTED','NOT_SELECTED','WITHDRAWN');
  update public.outstation_requests
     set status='REOPENED',accepted_agreement_id=null,recovery_count=recovery_count+1
   where id=v_req.id;

  insert into public.ride_events(
    ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata
  ) values(
    v_ride.id,'OUTSTATION_DRIVER_CANCELLED','DRIVER',v_profile,'UPCOMING','CANCELLED',
    jsonb_build_object('agreement_id',v_agreement.id,'request_id',v_req.id,'request_reopened',true)
  );

  v_result:=jsonb_build_object(
    'agreement_id',v_agreement.id,'request_id',v_req.id,'ride_id',v_ride.id,
    'agreement_status','DRIVER_CANCELLED','request_status','REOPENED',
    'ride_status','CANCELLED','commitment_status','RELEASED'
  );
  return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.driver_cancel_outstation_agreement(uuid,text) from public,anon,authenticated;
grant execute on function private.driver_cancel_outstation_agreement(uuid,text) to authenticated;
create or replace function public.driver_cancel_outstation_agreement(
  p_agreement_id uuid,p_idempotency_key text
) returns jsonb language sql security invoker set search_path=''
as $$ select private.driver_cancel_outstation_agreement(p_agreement_id,p_idempotency_key); $$;
revoke all on function public.driver_cancel_outstation_agreement(uuid,text) from public,anon,authenticated;
grant execute on function public.driver_cancel_outstation_agreement(uuid,text) to authenticated;
