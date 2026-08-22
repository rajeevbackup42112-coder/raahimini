create or replace function public.get_driver_daily_summary()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
  v_trips integer:=0;
  v_passengers integer:=0;
  v_fare integer:=0;
  v_fill numeric:=null;
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Not authenticated'); end if;
  select d.id into v_driver_id from public.drivers d where d.profile_id=auth.uid() and d.is_active=true;
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Active driver account required'); end if;

  select count(*)::integer,
         coalesce(sum(t.confirmed_count),0)::integer,
         coalesce(sum(t.confirmed_count*t.fare_per_seat),0)::integer,
         round(avg(case when t.started_at is not null then extract(epoch from (t.started_at-t.created_at))/60.0 end)::numeric,1)
  into v_trips,v_passengers,v_fare,v_fill
  from public.trips t
  where t.driver_id=v_driver_id
    and t.status='COMPLETED'
    and (t.completed_at at time zone 'Asia/Kolkata')::date=(now() at time zone 'Asia/Kolkata')::date;

  return jsonb_build_object('success',true,'trips_completed',v_trips,'passengers_carried',v_passengers,'fare_collected_estimate',v_fare,'average_fill_minutes',v_fill,'timezone','Asia/Kolkata');
end;
$function$;

revoke execute on function public.get_driver_daily_summary() from public, anon, service_role;
grant execute on function public.get_driver_daily_summary() to authenticated;
