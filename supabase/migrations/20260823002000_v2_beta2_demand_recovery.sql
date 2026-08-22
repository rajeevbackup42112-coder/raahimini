-- Raahi V2 Beta2 durable passenger demand recovery.
-- Demand remains advisory; explicit seat booking alone satisfies a NOW intent.

create or replace function public.satisfy_now_demand_after_booking()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_route_id uuid;
begin
  select route_id into v_route_id from public.trips where id = new.trip_id;
  if v_route_id is null then return new; end if;

  update public.demand_intents
  set status='SATISFIED', satisfied_at=now(), updated_at=now()
  where passenger_id=new.passenger_id
    and route_id=v_route_id
    and intent_kind='NOW'
    and status='ACTIVE';

  return new;
end;
$function$;

drop trigger if exists trg_satisfy_now_demand_after_booking on public.seat_requests;
create trigger trg_satisfy_now_demand_after_booking
after insert on public.seat_requests
for each row execute function public.satisfy_now_demand_after_booking();
revoke execute on function public.satisfy_now_demand_after_booking()
from public, anon, authenticated, service_role;
