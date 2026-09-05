-- Slice 8F: make payment creation independent of generated-column trigger timing.

create or replace function private.create_fixed_payment_due()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_driver_id uuid;
  v_amount_inr integer;
begin
  if new.status<>'COMPLETED' or old.status='COMPLETED' then return new; end if;
  select r.driver_id into v_driver_id from public.rides r where r.id=new.ride_id;
  v_amount_inr := new.seat_count * new.fare_per_seat_inr;
  if v_amount_inr is null or v_amount_inr <= 0 then
    raise exception 'PAYMENT_AMOUNT_INVALID';
  end if;
  insert into public.payment_acknowledgements(
    ride_booking_id,ride_id,passenger_profile_id,driver_id,amount_inr,status
  ) values (
    new.id,new.ride_id,new.passenger_profile_id,v_driver_id,v_amount_inr,'DUE'
  ) on conflict (ride_booking_id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_fixed_payment_due() from public,anon,authenticated;