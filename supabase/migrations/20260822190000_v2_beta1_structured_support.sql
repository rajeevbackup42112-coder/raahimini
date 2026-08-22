create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  reporter_role public.user_role not null,
  trip_id uuid references public.trips(id) on delete set null,
  request_id uuid references public.seat_requests(id) on delete set null,
  category text not null check (category in ('FARE_ISSUE','WRONG_DRIVER_VEHICLE','EXTRA_MONEY','UNSAFE_BEHAVIOUR','BOOKING_PROBLEM','PASSENGER_NO_SHOW','VEHICLE_BREAKDOWN','OTHER')),
  details text,
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.support_cases enable row level security;
revoke all on table public.support_cases from public, anon, authenticated, service_role;

create or replace function public.create_support_case(
  p_category text,
  p_trip_id uuid default null,
  p_request_id uuid default null,
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_profile public.profiles;
  v_driver_id uuid;
  v_trip_id uuid:=p_trip_id;
  v_case_id uuid;
  v_category text:=upper(coalesce(p_category,''));
  v_details text:=nullif(btrim(coalesce(p_details,'')),'');
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Authentication required'); end if;
  select * into v_profile from public.profiles where id=auth.uid();
  if v_profile.id is null or v_profile.is_restricted then return jsonb_build_object('success',false,'error','Account is restricted or unavailable'); end if;
  if v_details is not null and length(v_details)>500 then return jsonb_build_object('success',false,'error','Details must be 500 characters or less'); end if;

  if v_profile.role='passenger' then
    if v_category not in ('FARE_ISSUE','WRONG_DRIVER_VEHICLE','EXTRA_MONEY','UNSAFE_BEHAVIOUR','BOOKING_PROBLEM','OTHER') then return jsonb_build_object('success',false,'error','Invalid passenger support category'); end if;
    if p_request_id is null then return jsonb_build_object('success',false,'error','Passenger support requires a ride request'); end if;
    select sr.trip_id into v_trip_id from public.seat_requests sr where sr.id=p_request_id and sr.passenger_id=auth.uid();
    if v_trip_id is null then return jsonb_build_object('success',false,'error','Ride request not found'); end if;
  elsif v_profile.role='driver' then
    if v_category not in ('VEHICLE_BREAKDOWN','PASSENGER_NO_SHOW','FARE_ISSUE','UNSAFE_BEHAVIOUR','OTHER') then return jsonb_build_object('success',false,'error','Invalid driver support category'); end if;
    select d.id into v_driver_id from public.drivers d where d.profile_id=auth.uid() and d.is_active=true;
    if v_driver_id is null or v_trip_id is null or not exists(select 1 from public.trips t where t.id=v_trip_id and t.driver_id=v_driver_id) then return jsonb_build_object('success',false,'error','Driver trip not found'); end if;
  else
    return jsonb_build_object('success',false,'error','Support reporting is available to passenger and driver accounts');
  end if;

  select sc.id into v_case_id
  from public.support_cases sc
  where sc.reporter_id=auth.uid() and sc.status='OPEN' and sc.category=v_category
    and sc.trip_id is not distinct from v_trip_id and sc.request_id is not distinct from p_request_id
  order by sc.created_at desc limit 1;

  if v_case_id is not null then return jsonb_build_object('success',true,'case_id',v_case_id,'already_open',true); end if;

  insert into public.support_cases(reporter_id,reporter_role,trip_id,request_id,category,details)
  values(auth.uid(),v_profile.role,v_trip_id,p_request_id,v_category,v_details)
  returning id into v_case_id;

  perform public.record_audit('create_support_case','support_cases',v_case_id,null,jsonb_build_object('category',v_category,'trip_id',v_trip_id,'request_id',p_request_id),null);
  return jsonb_build_object('success',true,'case_id',v_case_id,'already_open',false);
end;
$function$;

create or replace function public.admin_get_open_support_cases()
returns table(case_id uuid, reporter_name text, reporter_role text, category text, route_code text, trip_id uuid, request_id uuid, details text, created_at timestamptz)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select sc.id,p.display_name,sc.reporter_role::text,sc.category,r.code,sc.trip_id,sc.request_id,sc.details,sc.created_at
  from public.support_cases sc
  join public.profiles p on p.id=sc.reporter_id
  left join public.trips t on t.id=sc.trip_id
  left join public.routes r on r.id=t.route_id
  where sc.status='OPEN'
  order by sc.created_at asc;
end;
$function$;

create or replace function public.admin_resolve_support_case(p_case_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_case public.support_cases;
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  select * into v_case from public.support_cases where id=p_case_id for update;
  if v_case.id is null then return jsonb_build_object('success',false,'error','Support case not found'); end if;
  if v_case.status='RESOLVED' then return jsonb_build_object('success',true,'already_resolved',true); end if;
  update public.support_cases set status='RESOLVED',resolved_at=now() where id=p_case_id;
  perform public.record_audit('admin_resolve_support_case','support_cases',p_case_id,null,jsonb_build_object('status','RESOLVED'),null);
  return jsonb_build_object('success',true,'already_resolved',false);
end;
$function$;

revoke execute on function public.create_support_case(text,uuid,uuid,text) from public, anon, service_role;
revoke execute on function public.admin_get_open_support_cases() from public, anon, service_role;
revoke execute on function public.admin_resolve_support_case(uuid) from public, anon, service_role;
grant execute on function public.create_support_case(text,uuid,uuid,text) to authenticated;
grant execute on function public.admin_get_open_support_cases() to authenticated;
grant execute on function public.admin_resolve_support_case(uuid) to authenticated;
