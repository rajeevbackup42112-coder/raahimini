create or replace function private.cancel_carpool_journey(p_journey_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_driver uuid:=private.current_driver_id(); v_j public.carpool_journeys%rowtype; v_ride public.rides%rowtype; v_hash text; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_driver is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
 v_hash:=md5(p_journey_id::text); v_idem:=private.claim_user_command('cancel_carpool_journey',p_idempotency_key,v_hash);
 if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_j from public.carpool_journeys where id=p_journey_id and driver_id=v_driver for update;
 if not found then raise exception 'CARPOOL_JOURNEY_NOT_FOUND'; end if;
 if v_j.status='DRIVER_CANCELLED' then v_result:=jsonb_build_object('journey_id',v_j.id,'status','DRIVER_CANCELLED'); return private.complete_user_command(v_idem.id,v_result); end if;
 if v_j.status='IN_FULFILMENT' then raise exception 'CARPOOL_ALREADY_IN_FULFILMENT'; end if;
 if v_j.status not in ('PUBLISHED','FULL','CHANGE_PENDING') then raise exception 'CARPOOL_JOURNEY_NOT_CANCELLABLE'; end if;
 if v_j.ride_id is not null then
   select * into v_ride from public.rides where id=v_j.ride_id for update;
   if v_ride.status<>'UPCOMING' then raise exception 'CARPOOL_ALREADY_IN_FULFILMENT'; end if;
   update public.rides set status='CANCELLED' where id=v_ride.id;
   update public.ride_bookings set status='CANCELLED' where ride_id=v_ride.id and status='ASSIGNED';
   update public.mobility_commitments set status='RELEASED' where id=v_j.commitment_id and status='RESERVED';
   insert into public.ride_events(ride_id,event_type,actor_kind,actor_profile_id,previous_state,next_state)
   values(v_ride.id,'CARPOOL_DRIVER_CANCELLED','DRIVER',auth.uid(),'UPCOMING','CANCELLED');
 end if;
 update public.carpool_bookings set status='DRIVER_CANCELLED',cancelled_at=now() where journey_id=v_j.id and status='ACTIVE';
 update public.carpool_change_proposals set status='CANCELLED',resolved_at=now() where journey_id=v_j.id and status='PENDING';
 update public.carpool_journeys set status='DRIVER_CANCELLED',active_booked_seats=0,cancelled_at=now() where id=v_j.id;
 v_result:=jsonb_build_object('journey_id',v_j.id,'status','DRIVER_CANCELLED');
 return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.cancel_carpool_journey(uuid,text) from public,anon,authenticated;
grant execute on function private.cancel_carpool_journey(uuid,text) to authenticated;