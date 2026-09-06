-- Slice 9D: generalize the proven Ride/Booking kernel just enough for whole-car Outstation.

alter table public.rides drop constraint rides_status_check;
alter table public.rides add constraint rides_status_check check (status in (
  'UPCOMING','MATCHED','DRIVER_ACKNOWLEDGED','DRIVER_EN_ROUTE','DRIVER_ARRIVED','BOARDING',
  'READY_TO_DEPART','IN_PROGRESS','OUTBOUND_IN_PROGRESS','WAITING_FOR_RETURN',
  'RETURN_BOARDING','RETURN_IN_PROGRESS','COMPLETED','DRIVER_FAILED','CANCELLED','SYSTEM_EXCEPTION'
));

alter table public.rides alter column origin_location_id drop not null;
alter table public.rides alter column destination_location_id drop not null;
alter table public.rides alter column driver_ack_deadline drop not null;
alter table public.rides alter column fare_per_seat_inr drop not null;
alter table public.rides drop constraint if exists rides_fare_per_seat_inr_check;
alter table public.rides
  add column commercial_model text not null default 'PER_SEAT' check (commercial_model in ('PER_SEAT','WHOLE_CAR')),
  add column whole_car_total_inr integer check (whole_car_total_inr>0),
  add column outstation_agreement_id uuid unique references public.outstation_agreements(id),
  add column origin_text_snapshot text,
  add column destination_text_snapshot text,
  add constraint rides_commercial_value_check check (
    (commercial_model='PER_SEAT' and fare_per_seat_inr is not null and fare_per_seat_inr>0 and whole_car_total_inr is null)
    or (commercial_model='WHOLE_CAR' and fare_per_seat_inr is null and whole_car_total_inr is not null)
  );
create index idx_rides_outstation_agreement on public.rides(outstation_agreement_id) where outstation_agreement_id is not null;
alter table public.ride_bookings alter column passenger_request_id drop not null;
alter table public.ride_bookings alter column fare_per_seat_inr drop not null;
alter table public.ride_bookings drop constraint if exists ride_bookings_fare_per_seat_inr_check;
alter table public.ride_bookings
  add column outstation_request_id uuid unique references public.outstation_requests(id),
  add column commercial_model text not null default 'PER_SEAT' check (commercial_model in ('PER_SEAT','WHOLE_CAR')),
  add column quoted_total_inr integer check (quoted_total_inr>0),
  add constraint ride_booking_source_check check (
    (passenger_request_id is not null and outstation_request_id is null)
    or (passenger_request_id is null and outstation_request_id is not null)
  ),
  add constraint ride_booking_commercial_value_check check (
    (commercial_model='PER_SEAT' and fare_per_seat_inr is not null and fare_per_seat_inr>0 and quoted_total_inr is null)
    or (commercial_model='WHOLE_CAR' and fare_per_seat_inr is null and quoted_total_inr is not null)
  );
create index idx_ride_bookings_outstation_request on public.ride_bookings(outstation_request_id) where outstation_request_id is not null;

create or replace function private.create_fixed_payment_due()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_driver_id uuid; v_amount_inr integer;
begin
  if new.status<>'COMPLETED' or old.status='COMPLETED' then return new; end if;
  select r.driver_id into v_driver_id from public.rides r where r.id=new.ride_id;
  v_amount_inr:=coalesce(new.quoted_total_inr,new.seat_count*new.fare_per_seat_inr);
  if v_amount_inr is null or v_amount_inr<=0 then raise exception 'PAYMENT_AMOUNT_INVALID'; end if;
  insert into public.payment_acknowledgements(ride_booking_id,ride_id,passenger_profile_id,driver_id,amount_inr,status)
  values(new.id,new.ride_id,new.passenger_profile_id,v_driver_id,v_amount_inr,'DUE')
  on conflict(ride_booking_id) do nothing;
  return new;
end; $$;
revoke all on function private.create_fixed_payment_due() from public,anon,authenticated;