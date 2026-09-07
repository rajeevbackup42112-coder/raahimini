do $$
declare ddl text;
begin
 select pg_get_functiondef(p.oid) into ddl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='get_driver_trip_workspace';
 ddl:=replace(ddl,$x$'trip_booking_id',b.id,'ride_booking_id',b.ride_booking_id,'status',b.status$x$,$x$'trip_booking_id',b.id,'ride_booking_id',b.ride_booking_id,'ride_booking_status',rb.status,'return_status',rb.return_status,'status',b.status$x$);
 ddl:=replace(ddl,$x$left join public.payment_acknowledgements pay on pay.ride_booking_id=b.ride_booking_id where b.offering_id=t.id$x$,$x$left join public.ride_bookings rb on rb.id=b.ride_booking_id left join public.payment_acknowledgements pay on pay.ride_booking_id=b.ride_booking_id where b.offering_id=t.id$x$);
 execute ddl;
end $$;