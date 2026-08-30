-- Driver verification foundation: private DL/RC files, reviewed car photos and public trust badges.
-- This does not change FIFO, trip lifecycle, seat ownership, GPS or phone verification.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'driver-verification','driver-verification',false,8388608,
  array['image/jpeg','image/png','image/webp','application/pdf']::text[]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.driver_verifications (
  driver_id uuid primary key references public.drivers(id) on delete cascade,
  driving_licence_status text not null default 'MISSING' check (driving_licence_status in ('MISSING','PENDING','VERIFIED','REJECTED')),
  vehicle_rc_status text not null default 'MISSING' check (vehicle_rc_status in ('MISSING','PENDING','VERIFIED','REJECTED')),
  car_photos_status text not null default 'MISSING' check (car_photos_status in ('MISSING','PENDING','VERIFIED','REJECTED')),
  driving_licence_notes text,
  vehicle_rc_notes text,
  car_photos_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_verification_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  document_type text not null check (document_type in ('DRIVING_LICENCE','VEHICLE_RC','CAR_PHOTO')),
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  file_size integer not null check (file_size>0 and file_size<=8388608),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

create unique index if not exists idx_driver_verification_one_current_identity_doc
  on public.driver_verification_documents(driver_id,document_type)
  where is_current=true and document_type in ('DRIVING_LICENCE','VEHICLE_RC');
create index if not exists idx_driver_verification_current_docs
  on public.driver_verification_documents(driver_id,document_type,created_at desc)
  where is_current=true;

alter table public.driver_verifications enable row level security;
alter table public.driver_verification_documents enable row level security;
revoke all on table public.driver_verifications from public,anon,authenticated,service_role;
revoke all on table public.driver_verification_documents from public,anon,authenticated,service_role;

drop trigger if exists set_driver_verifications_updated_at on public.driver_verifications;
create trigger set_driver_verifications_updated_at
  before update on public.driver_verifications
  for each row execute function public.set_updated_at();

create or replace function public.can_upload_driver_verification_object(p_name text)
returns boolean language sql stable security definer set search_path to 'public','storage'
as $function$
  select exists(
    select 1 from public.drivers d
    join public.profiles p on p.id=d.profile_id
    where d.profile_id=auth.uid()
      and d.is_active=true
      and not p.is_restricted
      and (storage.foldername(p_name))[1]=auth.uid()::text
  );
$function$;

create or replace function public.can_read_driver_verification_object(p_name text)
returns boolean language plpgsql stable security definer set search_path to 'public','storage'
as $function$
begin
  if auth.uid() is null then return false; end if;
  if public.is_admin() then return true; end if;
  if (storage.foldername(p_name))[1]=auth.uid()::text then return true; end if;
  return exists(
    select 1
    from public.driver_verification_documents doc
    join public.driver_verifications v on v.driver_id=doc.driver_id
    where doc.storage_path=p_name
      and doc.document_type='CAR_PHOTO'
      and doc.is_current=true
      and v.car_photos_status='VERIFIED'
  );
end;
$function$;

revoke all on function public.can_upload_driver_verification_object(text) from public,anon,service_role;
revoke all on function public.can_read_driver_verification_object(text) from public,anon,service_role;
grant execute on function public.can_upload_driver_verification_object(text) to authenticated;
grant execute on function public.can_read_driver_verification_object(text) to authenticated;

drop policy if exists "Raahi driver verification upload own" on storage.objects;
create policy "Raahi driver verification upload own"
on storage.objects for insert to authenticated
with check (
  bucket_id='driver-verification'
  and public.can_upload_driver_verification_object(name)
);

drop policy if exists "Raahi driver verification read guarded" on storage.objects;
create policy "Raahi driver verification read guarded"
on storage.objects for select to authenticated
using (
  bucket_id='driver-verification'
  and public.can_read_driver_verification_object(name)
);

create or replace function public.get_my_driver_verification()
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_driver public.drivers; v_vehicle public.vehicles; v_verify public.driver_verifications; v_docs jsonb;
begin
  select d.* into v_driver from public.drivers d
  join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
  if v_driver.id is null then return jsonb_build_object('success',false,'error','Active Driver access required'); end if;
  select * into v_vehicle from public.vehicles where id=v_driver.vehicle_id;
  select * into v_verify from public.driver_verifications where driver_id=v_driver.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'document_id',doc.id,'document_type',doc.document_type,'storage_path',doc.storage_path,
    'original_name',doc.original_name,'mime_type',doc.mime_type,'file_size',doc.file_size,'created_at',doc.created_at
  ) order by doc.created_at desc),'[]'::jsonb) into v_docs
  from public.driver_verification_documents doc
  where doc.driver_id=v_driver.id and doc.is_current=true;

  return jsonb_build_object(
    'success',true,'driver_id',v_driver.id,
    'vehicle',jsonb_build_object('registration_number',v_vehicle.registration_number,'vehicle_type',v_vehicle.vehicle_type,'vehicle_model',v_vehicle.vehicle_model,'capacity',v_vehicle.capacity),
    'driving_licence_status',coalesce(v_verify.driving_licence_status,'MISSING'),
    'vehicle_rc_status',coalesce(v_verify.vehicle_rc_status,'MISSING'),
    'car_photos_status',coalesce(v_verify.car_photos_status,'MISSING'),
    'driving_licence_notes',v_verify.driving_licence_notes,
    'vehicle_rc_notes',v_verify.vehicle_rc_notes,
    'car_photos_notes',v_verify.car_photos_notes,
    'documents',v_docs
  );
end;
$function$;

create or replace function public.register_driver_verification_upload(
  p_document_type text,p_storage_path text,p_original_name text,p_mime_type text,p_file_size integer
)
returns jsonb language plpgsql security definer set search_path to 'public','storage'
as $function$
declare v_driver_id uuid; v_type text:=upper(trim(coalesce(p_document_type,''))); v_id uuid; v_count integer;
begin
  select d.id into v_driver_id from public.drivers d
  join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Active Driver access required'); end if;
  if v_type not in ('DRIVING_LICENCE','VEHICLE_RC','CAR_PHOTO') then return jsonb_build_object('success',false,'error','Invalid document type'); end if;
  if coalesce(p_file_size,0)<=0 or p_file_size>8388608 then return jsonb_build_object('success',false,'error','File must be 8 MB or smaller'); end if;
  if lower(coalesce(p_mime_type,'')) not in ('image/jpeg','image/png','image/webp','application/pdf') then return jsonb_build_object('success',false,'error','Unsupported file type'); end if;
  if v_type='CAR_PHOTO' and lower(p_mime_type)='application/pdf' then return jsonb_build_object('success',false,'error','Car photos must be images'); end if;
  if length(trim(coalesce(p_original_name,'')))<1 or length(p_original_name)>180 then return jsonb_build_object('success',false,'error','Invalid file name'); end if;
  if position(auth.uid()::text||'/' in p_storage_path)<>1 then return jsonb_build_object('success',false,'error','Invalid private storage path'); end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='driver-verification' and o.name=p_storage_path) then return jsonb_build_object('success',false,'error','Uploaded file not found'); end if;

  insert into public.driver_verifications(driver_id) values(v_driver_id) on conflict(driver_id) do nothing;
  if v_type in ('DRIVING_LICENCE','VEHICLE_RC') then
    update public.driver_verification_documents set is_current=false,retired_at=now()
    where driver_id=v_driver_id and document_type=v_type and is_current=true;
  else
    select count(*) into v_count from public.driver_verification_documents where driver_id=v_driver_id and document_type='CAR_PHOTO' and is_current=true;
    if v_count>=4 then return jsonb_build_object('success',false,'error','Keep up to 4 current car photos'); end if;
  end if;

  insert into public.driver_verification_documents(driver_id,document_type,storage_path,original_name,mime_type,file_size)
  values(v_driver_id,v_type,p_storage_path,trim(p_original_name),lower(p_mime_type),p_file_size) returning id into v_id;

  if v_type='DRIVING_LICENCE' then
    update public.driver_verifications set driving_licence_status='PENDING',driving_licence_notes=null where driver_id=v_driver_id;
  elsif v_type='VEHICLE_RC' then
    update public.driver_verifications set vehicle_rc_status='PENDING',vehicle_rc_notes=null where driver_id=v_driver_id;
  else
    update public.driver_verifications set car_photos_status='PENDING',car_photos_notes=null where driver_id=v_driver_id;
  end if;

  perform public.record_audit('driver_verification_upload','driver_verification_documents',v_id,null,
    jsonb_build_object('driver_id',v_driver_id,'document_type',v_type),null);
  return jsonb_build_object('success',true,'document_id',v_id,'document_type',v_type);
end;
$function$;

create or replace function public.retire_my_driver_verification_document(p_document_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_driver_id uuid; v_doc public.driver_verification_documents; v_remaining integer;
begin
  select d.id into v_driver_id from public.drivers d
  join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Active Driver access required'); end if;
  select * into v_doc from public.driver_verification_documents where id=p_document_id and driver_id=v_driver_id and is_current=true for update;
  if v_doc.id is null then return jsonb_build_object('success',false,'error','Current document not found'); end if;
  update public.driver_verification_documents set is_current=false,retired_at=now() where id=v_doc.id;

  if v_doc.document_type='DRIVING_LICENCE' then
    update public.driver_verifications set driving_licence_status='MISSING',driving_licence_notes=null where driver_id=v_driver_id;
  elsif v_doc.document_type='VEHICLE_RC' then
    update public.driver_verifications set vehicle_rc_status='MISSING',vehicle_rc_notes=null where driver_id=v_driver_id;
  else
    select count(*) into v_remaining from public.driver_verification_documents
    where driver_id=v_driver_id and document_type='CAR_PHOTO' and is_current=true;
    update public.driver_verifications
    set car_photos_status=case when v_remaining>0 then 'PENDING' else 'MISSING' end,car_photos_notes=null
    where driver_id=v_driver_id;
  end if;
  perform public.record_audit('driver_verification_retire','driver_verification_documents',v_doc.id,to_jsonb(v_doc),
    jsonb_build_object('is_current',false),null);
  return jsonb_build_object('success',true,'document_type',v_doc.document_type);
end;
$function$;

create or replace function public.admin_list_driver_verifications()
returns table(
  driver_id uuid,profile_id uuid,display_name text,vehicle_number text,vehicle_type text,vehicle_model text,
  driving_licence_status text,vehicle_rc_status text,car_photos_status text,fully_verified boolean,current_document_count bigint
)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then return; end if;
  return query
  select d.id,d.profile_id,d.display_name,v.registration_number,v.vehicle_type,v.vehicle_model,
    coalesce(ver.driving_licence_status,'MISSING'),coalesce(ver.vehicle_rc_status,'MISSING'),coalesce(ver.car_photos_status,'MISSING'),
    coalesce(ver.driving_licence_status='VERIFIED' and ver.vehicle_rc_status='VERIFIED' and ver.car_photos_status='VERIFIED',false),
    (select count(*) from public.driver_verification_documents doc where doc.driver_id=d.id and doc.is_current=true)
  from public.drivers d
  join public.profiles p on p.id=d.profile_id
  left join public.vehicles v on v.id=d.vehicle_id
  left join public.driver_verifications ver on ver.driver_id=d.id
  where d.is_active=true and not p.is_restricted
  order by d.display_name;
end;
$function$;

create or replace function public.admin_get_driver_verification_documents(p_driver_id uuid)
returns table(
  document_id uuid,document_type text,storage_path text,original_name text,mime_type text,file_size integer,created_at timestamptz
)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then return; end if;
  return query
  select doc.id,doc.document_type,doc.storage_path,doc.original_name,doc.mime_type,doc.file_size,doc.created_at
  from public.driver_verification_documents doc
  where doc.driver_id=p_driver_id and doc.is_current=true
  order by doc.document_type,doc.created_at desc;
end;
$function$;

create or replace function public.admin_set_driver_verification_status(
  p_driver_id uuid,p_document_type text,p_status text,p_notes text default null
)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_type text:=upper(trim(coalesce(p_document_type,''))); v_status text:=upper(trim(coalesce(p_status,''))); v_before public.driver_verifications; v_count integer;
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  if v_type not in ('DRIVING_LICENCE','VEHICLE_RC','CAR_PHOTO') then return jsonb_build_object('success',false,'error','Invalid verification type'); end if;
  if v_status not in ('VERIFIED','REJECTED') then return jsonb_build_object('success',false,'error','Review status must be VERIFIED or REJECTED'); end if;
  if not exists(select 1 from public.drivers d where d.id=p_driver_id and d.is_active=true) then return jsonb_build_object('success',false,'error','Active Driver not found'); end if;
  select count(*) into v_count from public.driver_verification_documents where driver_id=p_driver_id and document_type=v_type and is_current=true;
  if v_count<1 then return jsonb_build_object('success',false,'error','Upload at least one current document before review'); end if;
  insert into public.driver_verifications(driver_id) values(p_driver_id) on conflict(driver_id) do nothing;
  select * into v_before from public.driver_verifications where driver_id=p_driver_id for update;
  if v_type='DRIVING_LICENCE' then
    update public.driver_verifications set driving_licence_status=v_status,driving_licence_notes=nullif(trim(coalesce(p_notes,'')),'') where driver_id=p_driver_id;
  elsif v_type='VEHICLE_RC' then
    update public.driver_verifications set vehicle_rc_status=v_status,vehicle_rc_notes=nullif(trim(coalesce(p_notes,'')),'') where driver_id=p_driver_id;
  else
    update public.driver_verifications set car_photos_status=v_status,car_photos_notes=nullif(trim(coalesce(p_notes,'')),'') where driver_id=p_driver_id;
  end if;
  update public.driver_verifications set reviewed_by=auth.uid(),reviewed_at=now() where driver_id=p_driver_id;
  perform public.record_audit('admin_set_driver_verification_status','driver_verifications',p_driver_id,to_jsonb(v_before),
    jsonb_build_object('document_type',v_type,'status',v_status,'notes',nullif(trim(coalesce(p_notes,'')),'')),null);
  return jsonb_build_object('success',true,'document_type',v_type,'status',v_status);
end;
$function$;

create or replace function public.get_driver_trust_badge(p_driver_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_driver public.drivers; v_vehicle public.vehicles; v_verify public.driver_verifications;
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Sign in required'); end if;
  select d.* into v_driver from public.drivers d
  join public.profiles p on p.id=d.profile_id
  where d.id=p_driver_id and d.is_active=true and not p.is_restricted;
  if v_driver.id is null then return jsonb_build_object('success',false,'error','Active Driver not found'); end if;
  select * into v_vehicle from public.vehicles where id=v_driver.vehicle_id and is_active=true;
  select * into v_verify from public.driver_verifications where driver_id=v_driver.id;
  return jsonb_build_object(
    'success',true,'driver_id',v_driver.id,'display_name',v_driver.display_name,
    'driving_licence_verified',coalesce(v_verify.driving_licence_status='VERIFIED',false),
    'vehicle_rc_verified',coalesce(v_verify.vehicle_rc_status='VERIFIED',false),
    'car_photos_verified',coalesce(v_verify.car_photos_status='VERIFIED',false),
    'fully_verified',coalesce(v_verify.driving_licence_status='VERIFIED' and v_verify.vehicle_rc_status='VERIFIED' and v_verify.car_photos_status='VERIFIED',false),
    'vehicle_number',v_vehicle.registration_number,'vehicle_type',v_vehicle.vehicle_type,'vehicle_model',v_vehicle.vehicle_model,'capacity',v_vehicle.capacity
  );
end;
$function$;

create or replace function public.get_driver_verified_car_photos(p_driver_id uuid)
returns table(document_id uuid,storage_path text,original_name text,mime_type text)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return; end if;
  if not exists(
    select 1 from public.drivers d
    join public.profiles p on p.id=d.profile_id
    join public.driver_verifications v on v.driver_id=d.id
    where d.id=p_driver_id and d.is_active=true and not p.is_restricted and v.car_photos_status='VERIFIED'
  ) then return; end if;
  return query
  select doc.id,doc.storage_path,doc.original_name,doc.mime_type
  from public.driver_verification_documents doc
  where doc.driver_id=p_driver_id and doc.document_type='CAR_PHOTO' and doc.is_current=true
  order by doc.created_at asc;
end;
$function$;

revoke all on function public.get_my_driver_verification() from public,anon,service_role;
revoke all on function public.register_driver_verification_upload(text,text,text,text,integer) from public,anon,service_role;
revoke all on function public.retire_my_driver_verification_document(uuid) from public,anon,service_role;
revoke all on function public.admin_list_driver_verifications() from public,anon,service_role;
revoke all on function public.admin_get_driver_verification_documents(uuid) from public,anon,service_role;
revoke all on function public.admin_set_driver_verification_status(uuid,text,text,text) from public,anon,service_role;
revoke all on function public.get_driver_trust_badge(uuid) from public,anon,service_role;
revoke all on function public.get_driver_verified_car_photos(uuid) from public,anon,service_role;

grant execute on function public.get_my_driver_verification() to authenticated;
grant execute on function public.register_driver_verification_upload(text,text,text,text,integer) to authenticated;
grant execute on function public.retire_my_driver_verification_document(uuid) to authenticated;
grant execute on function public.admin_list_driver_verifications() to authenticated;
grant execute on function public.admin_get_driver_verification_documents(uuid) to authenticated;
grant execute on function public.admin_set_driver_verification_status(uuid,text,text,text) to authenticated;
grant execute on function public.get_driver_trust_badge(uuid) to authenticated;
grant execute on function public.get_driver_verified_car_photos(uuid) to authenticated;
