-- Outstation Areas v2: independent pickup/service areas for Outstation.
-- Shared Ride routes, route preferences, FIFO, seats, GPS and lifecycle stay untouched.
create table if not exists public.outstation_service_areas (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{2,32}$'),
  name text not null check (char_length(name) between 2 and 80),
  state text not null check (char_length(state) between 2 and 80),
  location_id uuid references public.locations(id) on delete set null,
  is_active boolean not null default true,
  sort_order integer not null default 100 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.outstation_service_areas enable row level security;
revoke all on table public.outstation_service_areas from public,anon,authenticated,service_role;
drop trigger if exists set_outstation_service_areas_updated_at on public.outstation_service_areas;
create trigger set_outstation_service_areas_updated_at before update on public.outstation_service_areas
for each row execute function public.set_updated_at();

create table if not exists public.driver_outstation_area_preferences (
  driver_id uuid not null references public.drivers(id) on delete cascade,
  area_id uuid not null references public.outstation_service_areas(id) on delete cascade,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(driver_id,area_id)
);alter table public.driver_outstation_area_preferences enable row level security;
revoke all on table public.driver_outstation_area_preferences from public,anon,authenticated,service_role;
create index if not exists idx_driver_outstation_area_enabled
  on public.driver_outstation_area_preferences(area_id,driver_id) where is_enabled;
drop trigger if exists set_driver_outstation_area_preferences_updated_at on public.driver_outstation_area_preferences;
create trigger set_driver_outstation_area_preferences_updated_at before update on public.driver_outstation_area_preferences
for each row execute function public.set_updated_at();

insert into public.outstation_service_areas(code,name,state,location_id,is_active,sort_order)
values
 ('GOMOH','Gomoh','Jharkhand',(select id from public.locations where lower(name)='gomoh' limit 1),true,10),
 ('DHANBAD','Dhanbad','Jharkhand',(select id from public.locations where lower(name)='dhanbad' limit 1),true,20),
 ('PARASNATH','Parasnath','Jharkhand',(select id from public.locations where lower(name)='parasnath' limit 1),true,30),
 ('MADHUBAN','Madhuban','Jharkhand',(select id from public.locations where lower(name)='madhuban' limit 1),true,40),
 ('BOKARO','Bokaro','Jharkhand',null,true,50)
on conflict(code) do update set name=excluded.name,state=excluded.state,
 location_id=coalesce(public.outstation_service_areas.location_id,excluded.location_id),sort_order=excluded.sort_order;

insert into public.driver_outstation_area_preferences(driver_id,area_id,is_enabled)
select distinct rp.driver_id,a.id,true
from public.driver_route_preferences rp
join public.routes r on r.route_family_id=rp.route_family_id
join public.outstation_service_areas a on a.location_id=r.from_location_id
where r.is_current=true and r.is_active=true and r.version_status='PUBLISHED'
on conflict(driver_id,area_id) do nothing;

alter table public.outstation_requests add column if not exists origin_area_id uuid references public.outstation_service_areas(id);
alter table public.outstation_requests add column if not exists pickup_text text;
alter table public.outstation_requests alter column origin_location_id drop not null;update public.outstation_requests r set origin_area_id=a.id
from public.outstation_service_areas a
where r.origin_area_id is null and r.origin_location_id=a.location_id;
create index if not exists idx_outstation_requests_open_area
  on public.outstation_requests(origin_area_id,departure_at) where status='OPEN';

create or replace function public.get_outstation_service_areas()
returns table(area_id uuid,area_code text,area_name text,state text)
language sql stable security definer set search_path to 'public'
as $function$
  select a.id,a.code,a.name,a.state from public.outstation_service_areas a
  where a.is_active=true order by a.sort_order,a.name;
$function$;

create or replace function public.create_outstation_request_v2(
  p_origin_area_id uuid,p_pickup_text text,p_destination_text text,p_travel_type text,
  p_departure_at timestamptz,p_return_at timestamptz default null,p_passenger_count integer default 1,p_notes text default null
)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_profile public.profiles; v_area public.outstation_service_areas; v_request_id uuid;
 v_type text:=upper(trim(coalesce(p_travel_type,''))); v_destination text:=trim(coalesce(p_destination_text,''));
 v_pickup text:=trim(coalesce(p_pickup_text,''));
begin
 if auth.uid() is null then return jsonb_build_object('success',false,'error','Sign in required'); end if;
 select * into v_profile from public.profiles where id=auth.uid();
 if v_profile.id is null or v_profile.role<>'passenger' or v_profile.is_restricted then return jsonb_build_object('success',false,'error','Active Passenger access required'); end if;
 if not exists(select 1 from auth.users where id=auth.uid() and phone is not null and length(btrim(phone))>0 and phone_confirmed_at is not null) then return jsonb_build_object('success',false,'error','Verify your mobile number before requesting an outstation car'); end if;
 select * into v_area from public.outstation_service_areas where id=p_origin_area_id and is_active=true;
 if v_area.id is null then return jsonb_build_object('success',false,'error','Choose an active Raahi pickup area'); end if; if char_length(v_pickup)<2 or char_length(v_pickup)>180 then return jsonb_build_object('success',false,'error','Enter the exact pickup locality or address'); end if;
 if char_length(v_destination)<2 or char_length(v_destination)>160 then return jsonb_build_object('success',false,'error','Enter a destination'); end if;
 if v_type not in ('ONE_WAY','ROUND_TRIP') then return jsonb_build_object('success',false,'error','Choose one way or round trip'); end if;
 if p_departure_at<now()+interval '1 hour' or p_departure_at>now()+interval '180 days' then return jsonb_build_object('success',false,'error','Choose a departure at least 1 hour ahead and within 180 days'); end if;
 if p_passenger_count<1 or p_passenger_count>8 then return jsonb_build_object('success',false,'error','Passenger count must be 1 to 8'); end if;
 if v_type='ROUND_TRIP' and (p_return_at is null or p_return_at<=p_departure_at+interval '1 hour') then return jsonb_build_object('success',false,'error','Choose a return time after the outbound journey'); end if;
 if v_type='ONE_WAY' then p_return_at:=null; end if;
 if p_notes is not null and char_length(p_notes)>500 then return jsonb_build_object('success',false,'error','Notes are too long'); end if;
 if (select count(*) from public.outstation_requests where passenger_id=auth.uid() and status='OPEN' and departure_at>now())>=3 then return jsonb_build_object('success',false,'error','You can keep up to 3 open outstation requests'); end if;
 insert into public.outstation_requests(passenger_id,origin_area_id,origin_location_id,pickup_text,destination_text,travel_type,departure_at,return_at,passenger_count,notes)
 values(auth.uid(),v_area.id,v_area.location_id,v_pickup,v_destination,v_type,p_departure_at,p_return_at,p_passenger_count,nullif(trim(coalesce(p_notes,'')),'')) returning id into v_request_id;
 perform public.record_audit('create_outstation_request','outstation_requests',v_request_id,null,jsonb_build_object('origin_area_id',v_area.id,'pickup_text',v_pickup,'destination',v_destination,'travel_type',v_type,'passenger_count',p_passenger_count),null);
 return jsonb_build_object('success',true,'request_id',v_request_id,'status','OPEN');
end;$function$;

create or replace function public.get_my_outstation_requests_v2()
returns table(request_id uuid,origin_area_id uuid,origin_name text,pickup_text text,destination_text text,travel_type text,departure_at timestamptz,return_at timestamptz,passenger_count integer,notes text,status text,quote_count bigint,accepted_quote_id uuid,accepted_price integer,accepted_driver_name text,accepted_driver_phone text,accepted_vehicle_number text,accepted_vehicle_model text,created_at timestamptz)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
 if auth.uid() is null then return; end if;
 return query select r.id,r.origin_area_id,coalesce(a.name,l.name,'Unknown area'),r.pickup_text,r.destination_text,r.travel_type,r.departure_at,r.return_at,r.passenger_count,r.notes,r.status,
 (select count(*) from public.outstation_quotes qx where qx.request_id=r.id and qx.status='OFFERED' and qx.expires_at>now()),r.accepted_quote_id,q.total_price,d.display_name,
 case when r.status='ACCEPTED' then d.phone else null end,q.vehicle_number,q.vehicle_model,r.created_at
 from public.outstation_requests r left join public.outstation_service_areas a on a.id=r.origin_area_id
 left join public.locations l on l.id=r.origin_location_id left join public.outstation_quotes q on q.id=r.accepted_quote_id left join public.drivers d on d.id=q.driver_id
 where r.passenger_id=auth.uid() order by case when r.status='OPEN' then 0 when r.status='ACCEPTED' then 1 else 2 end,r.created_at desc;
end;$function$;
create or replace function public.get_my_driver_outstation_area_preferences()
returns table(area_id uuid,area_code text,area_name text,state text,is_active boolean,subscribed boolean)
language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_driver_id uuid;
begin
 select d.id into v_driver_id from public.drivers d join public.profiles p on p.id=d.profile_id
 where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
 if v_driver_id is null then return; end if;
 return query select a.id,a.code,a.name,a.state,a.is_active,coalesce(pref.is_enabled,false)
 from public.outstation_service_areas a
 left join public.driver_outstation_area_preferences pref on pref.area_id=a.id and pref.driver_id=v_driver_id
 where a.is_active=true or coalesce(pref.is_enabled,false)
 order by a.sort_order,a.name;
end;$function$;

create or replace function public.set_my_driver_outstation_area_preference(p_area_id uuid,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_driver_id uuid; v_area public.outstation_service_areas;
begin
 select d.id into v_driver_id from public.drivers d join public.profiles p on p.id=d.profile_id
 where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
 if v_driver_id is null then return jsonb_build_object('success',false,'error','Active Driver access required'); end if;
 select * into v_area from public.outstation_service_areas where id=p_area_id;
 if v_area.id is null then return jsonb_build_object('success',false,'error','Outstation area not found'); end if;
 if coalesce(p_enabled,false) and not v_area.is_active then return jsonb_build_object('success',false,'error','This Outstation area is not accepting new Driver subscriptions'); end if;
 insert into public.driver_outstation_area_preferences(driver_id,area_id,is_enabled)
 values(v_driver_id,v_area.id,coalesce(p_enabled,false))
 on conflict(driver_id,area_id) do update set is_enabled=excluded.is_enabled,updated_at=now();
 perform public.record_audit('set_driver_outstation_area_preference','driver_outstation_area_preferences',v_area.id,null,jsonb_build_object('driver_id',v_driver_id,'area_id',v_area.id,'enabled',coalesce(p_enabled,false)),null);
 return jsonb_build_object('success',true,'area_id',v_area.id,'enabled',coalesce(p_enabled,false));
end;$function$;
create or replace function public.driver_get_outstation_leads_v2()
returns table(request_id uuid,origin_area_id uuid,origin_name text,pickup_text text,destination_text text,travel_type text,departure_at timestamptz,return_at timestamptz,passenger_count integer,notes text,created_at timestamptz,my_quote_id uuid,my_quote_price integer,my_quote_status text,verification_complete boolean,vehicle_capacity integer)
language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_driver public.drivers; v_verify public.driver_verifications; v_capacity integer;
begin
 select d.* into v_driver from public.drivers d join public.profiles p on p.id=d.profile_id
 where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
 if v_driver.id is null then return; end if;
 select * into v_verify from public.driver_verifications where driver_id=v_driver.id;
 select capacity into v_capacity from public.vehicles where id=v_driver.vehicle_id and is_active=true;
 return query select req.id,req.origin_area_id,coalesce(a.name,l.name,'Unknown area'),req.pickup_text,req.destination_text,req.travel_type,req.departure_at,req.return_at,
 req.passenger_count,req.notes,req.created_at,q.id,q.total_price,q.status,
 coalesce(v_verify.driving_licence_status='VERIFIED' and v_verify.vehicle_rc_status='VERIFIED' and v_verify.car_photos_status='VERIFIED',false),coalesce(v_capacity,0)
 from public.outstation_requests req
 left join public.outstation_service_areas a on a.id=req.origin_area_id
 left join public.locations l on l.id=req.origin_location_id
 left join public.outstation_quotes q on q.request_id=req.id and q.driver_id=v_driver.id
 where req.status='OPEN' and req.departure_at>now()
 and not exists(select 1 from public.outstation_driver_ignores ig where ig.request_id=req.id and ig.driver_id=v_driver.id)
 and exists(select 1 from public.driver_outstation_area_preferences pref
            where pref.driver_id=v_driver.id and pref.area_id=req.origin_area_id and pref.is_enabled)
 order by req.departure_at,req.created_at;
end;$function$;

create or replace function public.driver_get_my_outstation_bookings_v2()
returns table(request_id uuid,quote_id uuid,origin_name text,pickup_text text,destination_text text,travel_type text,departure_at timestamptz,return_at timestamptz,passenger_count integer,passenger_name text,passenger_phone text,total_price integer,includes_tolls boolean,includes_parking boolean,vehicle_number text)
language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_driver_id uuid;
begin
 select d.id into v_driver_id from public.drivers d join public.profiles p on p.id=d.profile_id
 where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
 if v_driver_id is null then return; end if;
 return query select r.id,q.id,coalesce(a.name,l.name,'Unknown area'),r.pickup_text,r.destination_text,r.travel_type,r.departure_at,r.return_at,r.passenger_count,p.display_name,p.phone,q.total_price,q.includes_tolls,q.includes_parking,q.vehicle_number
 from public.outstation_quotes q join public.outstation_requests r on r.id=q.request_id and r.status='ACCEPTED' and r.accepted_quote_id=q.id
 left join public.outstation_service_areas a on a.id=r.origin_area_id left join public.locations l on l.id=r.origin_location_id
 join public.profiles p on p.id=r.passenger_id where q.driver_id=v_driver_id and q.status='ACCEPTED' order by r.departure_at;
end;$function$;
create or replace function public.driver_send_outstation_quote(p_request_id uuid,p_total_price integer,p_includes_tolls boolean default false,p_includes_parking boolean default false,p_driver_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_driver public.drivers; v_vehicle public.vehicles; v_verify public.driver_verifications;
 v_request public.outstation_requests; v_quote_id uuid; v_expiry timestamptz;
begin
 select d.* into v_driver from public.drivers d join public.profiles p on p.id=d.profile_id
 where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
 if v_driver.id is null then return jsonb_build_object('success',false,'error','Active Driver access required'); end if;
 select * into v_vehicle from public.vehicles where id=v_driver.vehicle_id and is_active=true;
 select * into v_verify from public.driver_verifications where driver_id=v_driver.id;
 if v_vehicle.id is null then return jsonb_build_object('success',false,'error','Active vehicle required'); end if;
 if not coalesce(v_verify.driving_licence_status='VERIFIED' and v_verify.vehicle_rc_status='VERIFIED' and v_verify.car_photos_status='VERIFIED',false) then return jsonb_build_object('success',false,'error','Complete Driving Licence, RC and car photo verification before sending an outstation quote'); end if;
 select * into v_request from public.outstation_requests where id=p_request_id for update;
 if v_request.id is null or v_request.status<>'OPEN' or v_request.departure_at<=now()+interval '30 minutes' then return jsonb_build_object('success',false,'error','This outstation request is no longer open for quotes'); end if;
 if v_request.origin_area_id is null or not exists(select 1 from public.driver_outstation_area_preferences pref where pref.driver_id=v_driver.id and pref.area_id=v_request.origin_area_id and pref.is_enabled) then return jsonb_build_object('success',false,'error','This lead is outside your selected Outstation areas'); end if;
 if v_vehicle.capacity<v_request.passenger_count then return jsonb_build_object('success',false,'error','Your current vehicle does not have enough passenger capacity'); end if;
 if p_total_price<1 or p_total_price>1000000 then return jsonb_build_object('success',false,'error','Enter a valid total quote'); end if;
 if p_driver_note is not null and char_length(p_driver_note)>300 then return jsonb_build_object('success',false,'error','Quote note is too long'); end if;
 v_expiry:=least(v_request.departure_at-interval '30 minutes',now()+interval '24 hours');
 insert into public.outstation_quotes(request_id,driver_id,vehicle_id,total_price,includes_tolls,includes_parking,driver_note,vehicle_number,vehicle_type,vehicle_model,vehicle_capacity,status,expires_at)
 values(v_request.id,v_driver.id,v_vehicle.id,p_total_price,coalesce(p_includes_tolls,false),coalesce(p_includes_parking,false),nullif(trim(coalesce(p_driver_note,'')),''),v_vehicle.registration_number,v_vehicle.vehicle_type,v_vehicle.vehicle_model,v_vehicle.capacity,'OFFERED',v_expiry)
 on conflict(request_id,driver_id) do update set vehicle_id=excluded.vehicle_id,total_price=excluded.total_price,includes_tolls=excluded.includes_tolls,includes_parking=excluded.includes_parking,driver_note=excluded.driver_note,vehicle_number=excluded.vehicle_number,vehicle_type=excluded.vehicle_type,vehicle_model=excluded.vehicle_model,vehicle_capacity=excluded.vehicle_capacity,status='OFFERED',expires_at=excluded.expires_at,updated_at=now()
 returning id into v_quote_id;
 delete from public.outstation_driver_ignores where request_id=v_request.id and driver_id=v_driver.id; perform public.record_audit('driver_send_outstation_quote','outstation_quotes',v_quote_id,null,jsonb_build_object('request_id',v_request.id,'driver_id',v_driver.id,'total_price',p_total_price,'vehicle_number',v_vehicle.registration_number,'origin_area_id',v_request.origin_area_id),null);
 return jsonb_build_object('success',true,'quote_id',v_quote_id,'status','OFFERED','expires_at',v_expiry);
end;$function$;

create or replace function public.driver_ignore_outstation_request(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_driver_id uuid; v_area_id uuid;
begin
 select d.id into v_driver_id from public.drivers d join public.profiles p on p.id=d.profile_id
 where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
 if v_driver_id is null then return jsonb_build_object('success',false,'error','Active Driver access required'); end if;
 select r.origin_area_id into v_area_id from public.outstation_requests r where r.id=p_request_id and r.status='OPEN';
 if v_area_id is null then return jsonb_build_object('success',false,'error','Open request not found'); end if;
 if not exists(select 1 from public.driver_outstation_area_preferences pref where pref.driver_id=v_driver_id and pref.area_id=v_area_id and pref.is_enabled) then return jsonb_build_object('success',false,'error','This lead is outside your selected Outstation areas'); end if;
 if exists(select 1 from public.outstation_quotes q where q.request_id=p_request_id and q.driver_id=v_driver_id and q.status='OFFERED') then return jsonb_build_object('success',false,'error','Withdraw your quote before ignoring this request'); end if;
 insert into public.outstation_driver_ignores(request_id,driver_id) values(p_request_id,v_driver_id) on conflict do nothing;
 return jsonb_build_object('success',true,'ignored',true);
end;$function$;

create or replace function public.admin_list_outstation_service_areas()
returns table(area_id uuid,area_code text,area_name text,state text,is_active boolean,sort_order integer,driver_count bigint)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
 if not public.is_admin() then return; end if;
 return query select a.id,a.code,a.name,a.state,a.is_active,a.sort_order,
 (select count(*) from public.driver_outstation_area_preferences p where p.area_id=a.id and p.is_enabled)
 from public.outstation_service_areas a order by a.sort_order,a.name;
end;$function$;
create or replace function public.admin_save_outstation_service_area(
 p_area_id uuid,p_code text,p_name text,p_state text,p_is_active boolean default true,p_sort_order integer default 100
)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_id uuid:=p_area_id; v_code text:=upper(regexp_replace(trim(coalesce(p_code,'')),'[^A-Za-z0-9_-]+','_','g'));
 v_name text:=trim(coalesce(p_name,'')); v_state text:=trim(coalesce(p_state,'')); v_before jsonb;
begin
 if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
 if v_code !~ '^[A-Z0-9_-]{2,32}$' then return jsonb_build_object('success',false,'error','Enter a short area code'); end if;
 if char_length(v_name)<2 or char_length(v_name)>80 then return jsonb_build_object('success',false,'error','Enter an area name'); end if;
 if char_length(v_state)<2 or char_length(v_state)>80 then return jsonb_build_object('success',false,'error','Enter a state'); end if;
 if coalesce(p_sort_order,100)<0 or coalesce(p_sort_order,100)>10000 then return jsonb_build_object('success',false,'error','Invalid sort order'); end if;
 if v_id is null then
   insert into public.outstation_service_areas(code,name,state,is_active,sort_order)
   values(v_code,v_name,v_state,coalesce(p_is_active,true),coalesce(p_sort_order,100)) returning id into v_id;
 else
   select to_jsonb(a) into v_before from public.outstation_service_areas a where a.id=v_id;
   if v_before is null then return jsonb_build_object('success',false,'error','Outstation area not found'); end if;
   update public.outstation_service_areas set code=v_code,name=v_name,state=v_state,is_active=coalesce(p_is_active,true),sort_order=coalesce(p_sort_order,100) where id=v_id;
 end if;
 perform public.record_audit('admin_save_outstation_service_area','outstation_service_areas',v_id,v_before,jsonb_build_object('code',v_code,'name',v_name,'state',v_state,'is_active',coalesce(p_is_active,true),'sort_order',coalesce(p_sort_order,100)),null);
 return jsonb_build_object('success',true,'area_id',v_id);
end;$function$;
create or replace function public.admin_get_outstation_marketplace_v2()
returns table(request_id uuid,passenger_name text,passenger_phone text,origin_name text,pickup_text text,destination_text text,travel_type text,departure_at timestamptz,return_at timestamptz,passenger_count integer,effective_status text,quote_count bigint,accepted_driver_name text,accepted_driver_phone text,accepted_price integer,accepted_vehicle_number text,created_at timestamptz)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
 if not public.is_admin() then return; end if;
 return query select r.id,p.display_name,p.phone,coalesce(a.name,l.name,'Unknown area'),r.pickup_text,r.destination_text,r.travel_type,r.departure_at,r.return_at,r.passenger_count,
 case when r.status='OPEN' and r.departure_at<=now() then 'EXPIRED' else r.status end,
 (select count(*) from public.outstation_quotes qx where qx.request_id=r.id and qx.status in ('OFFERED','ACCEPTED') and (qx.status='ACCEPTED' or qx.expires_at>now())),
 d.display_name,d.phone,q.total_price,q.vehicle_number,r.created_at
 from public.outstation_requests r join public.profiles p on p.id=r.passenger_id
 left join public.outstation_service_areas a on a.id=r.origin_area_id left join public.locations l on l.id=r.origin_location_id
 left join public.outstation_quotes q on q.id=r.accepted_quote_id left join public.drivers d on d.id=q.driver_id
 order by case when r.status='OPEN' and r.departure_at>now() then 0 when r.status='ACCEPTED' then 1 else 2 end,r.departure_at,r.created_at desc;
end;$function$;

revoke all on function public.get_outstation_service_areas() from public,service_role;
revoke all on function public.create_outstation_request_v2(uuid,text,text,text,timestamptz,timestamptz,integer,text) from public,anon,service_role;
revoke all on function public.get_my_outstation_requests_v2() from public,anon,service_role;
revoke all on function public.get_my_driver_outstation_area_preferences() from public,anon,service_role;
revoke all on function public.set_my_driver_outstation_area_preference(uuid,boolean) from public,anon,service_role;
revoke all on function public.driver_get_outstation_leads_v2() from public,anon,service_role;
revoke all on function public.driver_get_my_outstation_bookings_v2() from public,anon,service_role;
revoke all on function public.admin_list_outstation_service_areas() from public,anon,service_role;
revoke all on function public.admin_save_outstation_service_area(uuid,text,text,text,boolean,integer) from public,anon,service_role;
revoke all on function public.admin_get_outstation_marketplace_v2() from public,anon,service_role;grant execute on function public.get_outstation_service_areas() to anon,authenticated;
grant execute on function public.create_outstation_request_v2(uuid,text,text,text,timestamptz,timestamptz,integer,text) to authenticated;
grant execute on function public.get_my_outstation_requests_v2() to authenticated;
grant execute on function public.get_my_driver_outstation_area_preferences() to authenticated;
grant execute on function public.set_my_driver_outstation_area_preference(uuid,boolean) to authenticated;
grant execute on function public.driver_get_outstation_leads_v2() to authenticated;
grant execute on function public.driver_get_my_outstation_bookings_v2() to authenticated;
grant execute on function public.admin_list_outstation_service_areas() to authenticated;
grant execute on function public.admin_save_outstation_service_area(uuid,text,text,text,boolean,integer) to authenticated;
grant execute on function public.admin_get_outstation_marketplace_v2() to authenticated;
