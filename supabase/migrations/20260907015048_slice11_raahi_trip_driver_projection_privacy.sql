do $$
declare ddl text;
begin
 select pg_get_functiondef(p.oid) into ddl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='get_driver_trip_workspace';
 ddl:=replace(ddl,$x$where b.offering_id=t.id$x$,$x$where b.offering_id=t.id and t.status not in ('DRAFT','FILLING','NOT_CONFIRMED','EXPIRED')$x$);
 execute ddl;
end $$;