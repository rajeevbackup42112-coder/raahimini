-- Slice 4: automatically invoke the canonical matcher when liquidity changes.
-- The trigger never contains matching rules; it delegates to private.match_fixed_product.

create or replace function private.trigger_fixed_product_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  if new.status <> 'QUEUED' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'QUEUED' then
    return new;
  end if;

  v_key := 'queue:' || tg_table_name || ':' || new.id::text;
  perform private.match_fixed_product(new.product_id, v_key);
  return new;
end;
$$;

revoke all on function private.trigger_fixed_product_match()
from public, anon, authenticated;
drop trigger if exists auto_match_fixed_passenger_request
on public.fixed_passenger_requests;
create trigger auto_match_fixed_passenger_request
after insert or update of status
on public.fixed_passenger_requests
for each row execute function private.trigger_fixed_product_match();

drop trigger if exists auto_match_fixed_driver_availability
on public.driver_availability;
create trigger auto_match_fixed_driver_availability
after insert or update of status
on public.driver_availability
for each row execute function private.trigger_fixed_product_match();
