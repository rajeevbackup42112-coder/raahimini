create or replace function private.driver_depart_fixed_return(p_ride_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_driver_id uuid:=private.current_driver_id();
  v_idem public.command_idempotency%rowtype;
  v_ride public.rides%rowtype;
  v_result jsonb;
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem:=private.claim_user_command('driver_depart_fixed_return',p_idempotency_key,md5(p_ride_id::text));
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_ride from public.rides r where r.id=p_ride_id and r.driver_id=v_driver_id for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  if not exists (select 1 from public.service_products p where p.id=v_ride.product_id and p.service_type='FIXED_ROUND_TRIP')
    then raise exception 'RIDE_TRANSITION_INVALID'; end if;
  if v_ride.status='RETURN_IN_PROGRESS' then
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status',v_ride.status,'return_departed_at',v_ride.return_departed_at);
  elsif v_ride.status<>'RETURN_BOARDING' then raise exception 'RIDE_TRANSITION_INVALID';
  elsif exists (
    select 1 from public.ride_bookings b where b.ride_id=v_ride.id and b.status='BOARDED' and b.return_status='PENDING'
  ) then raise exception 'RETURN_MANIFEST_UNRESOLVED';
  else
    update public.rides set status='RETURN_IN_PROGRESS',return_departed_at=now() where id=v_ride.id;
    insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state)
    values(v_ride.id,'RETURN_DEPARTED','DRIVER',auth.uid(),'RETURN_BOARDING','RETURN_IN_PROGRESS');
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status','RETURN_IN_PROGRESS','return_departed_at',now());
  end if;
  perform private.finish_user_command(v_idem.id,v_result); return v_result;
end; $$;
revoke all on function private.driver_depart_fixed_return(uuid,text) from public,anon,authenticated;
grant execute on function private.driver_depart_fixed_return(uuid,text) to authenticated;
create or replace function public.driver_depart_fixed_return(p_ride_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.driver_depart_fixed_return(p_ride_id,p_idempotency_key); $$;
revoke all on function public.driver_depart_fixed_return(uuid,text) from public,anon,authenticated;
grant execute on function public.driver_depart_fixed_return(uuid,text) to authenticated;

create or replace function private.driver_complete_fixed_round_trip(
  p_ride_id uuid,p_latitude double precision,p_longitude double precision,
  p_accuracy_meters double precision,p_captured_at timestamptz,p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_driver_id uuid:=private.current_driver_id();
  v_idem public.command_idempotency%rowtype;
  v_ride public.rides%rowtype;
  v_zone_id uuid;
  v_distance double precision;
  v_result jsonb;
  v_hash text:=md5(concat_ws('|',p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at));
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  v_idem:=private.claim_user_command('driver_complete_fixed_round_trip',p_idempotency_key,v_hash);
  if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
  select * into v_ride from public.rides r where r.id=p_ride_id and r.driver_id=v_driver_id for update;
  if not found then raise exception 'RIDE_NOT_FOUND'; end if;
  if not exists (select 1 from public.service_products p where p.id=v_ride.product_id and p.service_type='FIXED_ROUND_TRIP')
    then raise exception 'RIDE_TRANSITION_INVALID'; end if;
  if v_ride.status='COMPLETED' then
    v_result:=jsonb_build_object('ride_id',v_ride.id,'status',v_ride.status,'completed_at',v_ride.completed_at);
    perform private.finish_user_command(v_idem.id,v_result); return v_result;
  end if;
  if v_ride.status<>'RETURN_IN_PROGRESS' then raise exception 'RIDE_TRANSITION_INVALID'; end if;
  select z.zone_id,z.distance_meters into v_zone_id,v_distance
  from private.verify_fixed_rule_zone(p_ride_id,'return_completion',p_latitude,p_longitude,p_accuracy_meters,p_captured_at) z;
  update public.rides set status='COMPLETED',completed_at=now(),return_completed_at=now(),
    return_completion_zone_id=v_zone_id,return_completion_accuracy_meters=p_accuracy_meters
  where id=v_ride.id;
  update public.ride_bookings set status='COMPLETED'
  where ride_id=v_ride.id and status='BOARDED';
  update public.mobility_commitments set status='COMPLETED'
  where id=v_ride.commitment_id and status in ('RESERVED','ACTIVE');
  insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state,metadata)
  values(v_ride.id,'RETURN_COMPLETED','DRIVER',auth.uid(),'RETURN_IN_PROGRESS','COMPLETED',
    jsonb_build_object('zone_id',v_zone_id,'distance_meters',round(v_distance::numeric),'accuracy_meters',p_accuracy_meters));
  v_result:=jsonb_build_object('ride_id',v_ride.id,'status','COMPLETED','completed_at',now());
  perform private.finish_user_command(v_idem.id,v_result); return v_result;
end; $$;
revoke all on function private.driver_complete_fixed_round_trip(uuid,double precision,double precision,double precision,timestamptz,text)
from public,anon,authenticated;
grant execute on function private.driver_complete_fixed_round_trip(uuid,double precision,double precision,double precision,timestamptz,text)
to authenticated;
create or replace function public.driver_complete_fixed_round_trip(
  p_ride_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision,
  p_captured_at timestamptz,p_idempotency_key text
) returns jsonb language sql security invoker set search_path='' as $$
  select private.driver_complete_fixed_round_trip(p_ride_id,p_latitude,p_longitude,p_accuracy_meters,p_captured_at,p_idempotency_key);
$$;
revoke all on function public.driver_complete_fixed_round_trip(uuid,double precision,double precision,double precision,timestamptz,text)
from public,anon,authenticated;
grant execute on function public.driver_complete_fixed_round_trip(uuid,double precision,double precision,double precision,timestamptz,text)
to authenticated;
