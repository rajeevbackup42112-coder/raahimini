do $$
declare r record; ddl text;
begin
 for r in
  select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname in ('create_trip_draft','update_unbooked_trip','publish_trip_offering')
 loop
  ddl:=pg_get_functiondef(r.oid);
  ddl:=replace(ddl,$x$m.status='ACTIVE'$x$,$x$m.status in ('PILOT','ACTIVE','SCALING')$x$);
  execute ddl;
 end loop;
end $$;