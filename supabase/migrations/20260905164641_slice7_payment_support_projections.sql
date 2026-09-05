-- Slice 7C: scoped payment and support projections.

create or replace function private.get_my_fixed_payment(p_request_id uuid)
returns table(
  payment_id uuid,ride_id uuid,booking_id uuid,status text,amount_inr integer,
  passenger_marked_paid_at timestamptz,driver_confirmed_received_at timestamptz,
  disputed_at timestamptz,dispute_case_id uuid
)
language sql security definer stable set search_path=''
as $$
  select p.id,p.ride_id,p.ride_booking_id,p.status,p.amount_inr,
         p.passenger_marked_paid_at,p.driver_confirmed_received_at,p.disputed_at,p.dispute_case_id
  from public.fixed_passenger_requests q
  join public.ride_bookings b on b.passenger_request_id=q.id
  join public.payment_acknowledgements p on p.ride_booking_id=b.id
  where q.id=p_request_id and q.passenger_profile_id=auth.uid();
$$;
revoke all on function private.get_my_fixed_payment(uuid) from public,anon,authenticated;
create or replace function public.get_my_fixed_payment(p_request_id uuid)
returns table(payment_id uuid,ride_id uuid,booking_id uuid,status text,amount_inr integer,
  passenger_marked_paid_at timestamptz,driver_confirmed_received_at timestamptz,
  disputed_at timestamptz,dispute_case_id uuid)
language sql security invoker stable set search_path=''
as $$ select * from private.get_my_fixed_payment(p_request_id); $$;
revoke all on function public.get_my_fixed_payment(uuid) from public,anon,authenticated;
grant execute on function public.get_my_fixed_payment(uuid) to authenticated;
create or replace function private.get_my_driver_payments()
returns table(
  payment_id uuid,ride_id uuid,status text,amount_inr integer,passenger_name text,
  origin_name text,destination_name text,completed_at timestamptz
)
language plpgsql security definer stable set search_path=''
as $$
declare v_driver_id uuid:=private.current_driver_id();
begin
  if v_driver_id is null then raise exception 'DRIVER_CAPABILITY_REQUIRED'; end if;
  return query
  select p.id,p.ride_id,p.status,p.amount_inr,coalesce(pr.display_name,'Passenger'),
         lo.name,ld.name,r.completed_at
  from public.payment_acknowledgements p
  join public.ride_bookings b on b.id=p.ride_booking_id
  join public.profiles pr on pr.id=b.passenger_profile_id
  join public.rides r on r.id=p.ride_id
  join public.locations lo on lo.id=r.origin_location_id
  join public.locations ld on ld.id=r.destination_location_id
  where p.driver_id=v_driver_id order by r.completed_at desc nulls last,p.created_at desc;
end;
$$;
revoke all on function private.get_my_driver_payments() from public,anon,authenticated;
create or replace function public.get_my_driver_payments()
returns table(payment_id uuid,ride_id uuid,status text,amount_inr integer,passenger_name text,
  origin_name text,destination_name text,completed_at timestamptz)
language sql security invoker stable set search_path=''
as $$ select * from private.get_my_driver_payments(); $$;
revoke all on function public.get_my_driver_payments() from public,anon,authenticated;
grant execute on function public.get_my_driver_payments() to authenticated;
create or replace function private.get_my_cases()
returns table(case_id uuid,object_type text,object_id uuid,category text,status text,details text,created_at timestamptz)
language sql security definer stable set search_path=''
as $$
  select c.id,c.object_type,c.object_id,c.category,c.status,c.details,c.created_at
  from public.cases c where c.reporter_profile_id=auth.uid()
  order by c.created_at desc;
$$;
revoke all on function private.get_my_cases() from public,anon,authenticated;
create or replace function public.get_my_cases()
returns table(case_id uuid,object_type text,object_id uuid,category text,status text,details text,created_at timestamptz)
language sql security invoker stable set search_path=''
as $$ select * from private.get_my_cases(); $$;
revoke all on function public.get_my_cases() from public,anon,authenticated;
grant execute on function public.get_my_cases() to authenticated;

grant usage on schema private to authenticated;
grant execute on function private.get_my_fixed_payment(uuid) to authenticated;
grant execute on function private.get_my_driver_payments() to authenticated;
grant execute on function private.get_my_cases() to authenticated;