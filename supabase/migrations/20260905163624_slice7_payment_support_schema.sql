-- Slice 7A: direct-payment acknowledgements and independent support Cases.

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid not null references public.profiles(id),
  origin_market_id uuid references public.markets(id),
  object_type text not null check (object_type in ('RIDE','BOOKING','PAYMENT')),
  object_id uuid not null,
  category text not null check (category in (
    'SAFETY','DRIVER_DID_NOT_ARRIVE','PASSENGER_DID_NOT_ARRIVE','WRONG_VEHICLE',
    'PAYMENT_PROBLEM','FARE_DISAGREEMENT','BEHAVIOUR','BREAKDOWN','APP_SYSTEM_PROBLEM','OTHER'
  )),
  details text not null check (char_length(details) between 3 and 2000),
  status text not null default 'OPEN' check (status in (
    'OPEN','ACKNOWLEDGED','UNDER_REVIEW','RESOLVED','CLOSED_NO_ACTION',
    'ESCALATED','DUPLICATE','UNABLE_TO_DETERMINE'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

create index idx_cases_reporter on public.cases(reporter_profile_id,created_at desc);
create index idx_cases_market_status on public.cases(origin_market_id,status,created_at desc);
create index idx_cases_object on public.cases(object_type,object_id,created_at desc);

create table public.payment_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  ride_booking_id uuid not null unique references public.ride_bookings(id),
  ride_id uuid not null references public.rides(id),
  passenger_profile_id uuid not null references public.profiles(id),
  driver_id uuid not null references public.drivers(id),
  amount_inr integer not null check (amount_inr > 0),
  status text not null default 'DUE' check (status in (
    'DUE','PASSENGER_MARKED_PAID','DRIVER_CONFIRMED_RECEIVED','PAYMENT_DISPUTED'
  )),
  passenger_marked_paid_at timestamptz,
  driver_confirmed_received_at timestamptz,
  disputed_at timestamptz,
  dispute_case_id uuid references public.cases(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payments_passenger on public.payment_acknowledgements(passenger_profile_id,status,created_at desc);
create index idx_payments_driver on public.payment_acknowledgements(driver_id,status,created_at desc);
create index idx_payments_ride on public.payment_acknowledgements(ride_id,status);

create trigger cases_set_updated_at before update on public.cases
for each row execute function private.set_updated_at();
create trigger payment_ack_set_updated_at before update on public.payment_acknowledgements
for each row execute function private.set_updated_at();

alter table public.cases enable row level security;
alter table public.payment_acknowledgements enable row level security;
revoke all on public.cases from public, anon, authenticated;
revoke all on public.payment_acknowledgements from public, anon, authenticated;
create policy cases_no_direct_client_access on public.cases
for all to anon, authenticated using (false) with check (false);
create policy payments_no_direct_client_access on public.payment_acknowledgements
for all to anon, authenticated using (false) with check (false);

create or replace function private.create_fixed_payment_due()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_driver_id uuid;
begin
  if new.status<>'COMPLETED' or old.status='COMPLETED' then return new; end if;
  select r.driver_id into v_driver_id from public.rides r where r.id=new.ride_id;
  insert into public.payment_acknowledgements(
    ride_booking_id,ride_id,passenger_profile_id,driver_id,amount_inr,status
  ) values (
    new.id,new.ride_id,new.passenger_profile_id,v_driver_id,new.total_fare_inr,'DUE'
  ) on conflict (ride_booking_id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_fixed_payment_due() from public, anon, authenticated;
create trigger ride_booking_payment_due
before update of status on public.ride_bookings
for each row execute function private.create_fixed_payment_due();

-- Historical completed Fixed bookings enter payment acknowledgement as DUE.
insert into public.payment_acknowledgements(
  ride_booking_id,ride_id,passenger_profile_id,driver_id,amount_inr,status
)
select b.id,b.ride_id,b.passenger_profile_id,r.driver_id,b.total_fare_inr,'DUE'
from public.ride_bookings b
join public.rides r on r.id=b.ride_id
where b.status='COMPLETED'
on conflict (ride_booking_id) do nothing;
