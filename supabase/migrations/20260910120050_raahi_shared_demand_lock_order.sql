-- Keep every Shared hold mutation on one lock order: Offering -> Match -> Intent.
-- This replacement avoids a cancel-vs-expiry deadlock where the original trigger
-- could lock Match before Offering.

create or replace function private.trigger_release_shared_holds_on_intent_close()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_candidate record;
  v_m public.shared_trip_matches%rowtype;
begin
  if old.status='ACTIVE' and new.status<>'ACTIVE' then
    for v_candidate in
      select m.id,m.offering_id
        from public.shared_trip_matches m
       where m.travel_intent_id=new.id and m.status='OFFERED'
       order by m.offered_at,m.id
    loop
      perform 1 from public.trip_offerings where id=v_candidate.offering_id for update;
      if not found then raise exception 'TRIP_OFFERING_NOT_FOUND'; end if;

      select * into v_m from public.shared_trip_matches
       where id=v_candidate.id and status='OFFERED' for update;
      if found then
        update public.trip_offerings
           set held_seats=held_seats-v_m.seat_count,updated_at=now()
         where id=v_m.offering_id and held_seats>=v_m.seat_count;
        if not found then raise exception 'SHARED_HOLD_STATE_INVALID'; end if;
        update public.shared_trip_matches
           set status='CANCELLED',cancelled_at=now(),updated_at=now()
         where id=v_m.id and status='OFFERED';
      end if;
    end loop;
  end if;
  return new;
end; $$;
revoke all on function private.trigger_release_shared_holds_on_intent_close() from public,anon,authenticated;
