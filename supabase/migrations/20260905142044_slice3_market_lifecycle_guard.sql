-- Slice 3 hardening: Driver FIFO eligibility must respect Market lifecycle.

create or replace function private.fixed_product_market_is_live(p_product_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.service_products p
    join public.markets m on m.id = p.market_id
    where p.id = p_product_id
      and p.service_type = 'FIXED_ONE_WAY'
      and p.status in ('PILOT','ACTIVE')
      and m.status in ('PILOT','ACTIVE','SCALING')
  );
$$;

revoke all on function private.fixed_product_market_is_live(uuid)
from public, anon, authenticated;
grant execute on function private.fixed_product_market_is_live(uuid) to authenticated;

create or replace function private.enforce_driver_availability_market_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.fixed_product_market_is_live(new.product_id) then
    raise exception 'FIXED_PRODUCT_NOT_AVAILABLE';
  end if;

  if not exists (
    select 1 from public.service_products p
    where p.id = new.product_id
      and p.market_id = new.operating_market_id
  ) then
    raise exception 'OPERATING_MARKET_MISMATCH';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_driver_availability_market_lifecycle()
from public, anon, authenticated;

drop trigger if exists enforce_driver_availability_market_lifecycle
on public.driver_availability;

create trigger enforce_driver_availability_market_lifecycle
before insert or update of product_id, operating_market_id
on public.driver_availability
for each row execute function private.enforce_driver_availability_market_lifecycle();
