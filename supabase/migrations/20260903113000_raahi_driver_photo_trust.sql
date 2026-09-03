-- Raahi trust layer: verified Driver portrait for Passenger confidence.
-- Raw Driver photos stay in the existing private verification bucket and use the same relationship guard as approved car photos.

alter table public.driver_verifications
  add column if not exists driver_photo_status text not null default 'MISSING',
  add column if not exists driver_photo_notes text;

alter table public.driver_verifications drop constraint if exists driver_verifications_driver_photo_status_check;
alter table public.driver_verifications add constraint driver_verifications_driver_photo_status_check
  check(driver_photo_status in ('MISSING','PENDING','VERIFIED','REJECTED'));

alter table public.driver_verification_documents
  drop constraint if exists driver_verification_documents_document_type_check;
alter table public.driver_verification_documents
  add constraint driver_verification_documents_document_type_check check(document_type in (
    'DRIVING_LICENCE','VEHICLE_RC','DRIVER_PHOTO','CAR_PHOTO',
    'VEHICLE_PERMIT','VEHICLE_FITNESS','VEHICLE_INSURANCE','VEHICLE_PUC'
  ));

create unique index if not exists idx_driver_verification_one_current_driver_photo
  on public.driver_verification_documents(driver_id)
  where is_current=true and document_type='DRIVER_PHOTO';

create or replace function public.can_read_driver_verification_object(p_name text)
returns boolean language plpgsql stable security definer set search_path='public','storage'
as $$
begin
  if auth.uid() is null then return false; end if;
  if public.is_admin() then return true; end if;
  if (storage.foldername(p_name))[1]=auth.uid()::text then return true; end if;
  return exists(
    select 1
    from public.driver_verification_documents doc
    join public.driver_verifications v on v.driver_id=doc.driver_id
    where doc.storage_path=p_name and doc.is_current=true
      and (
        (doc.document_type='CAR_PHOTO' and v.car_photos_status='VERIFIED') or
        (doc.document_type='DRIVER_PHOTO' and v.driver_photo_status='VERIFIED')
      )
      and public.can_view_driver_trust(doc.driver_id)
  );
end;
$$;

create or replace function public.get_my_driver_verification()
returns jsonb language plpgsql stable security definer set search_path='public'
as $$
declare v_driver public.drivers; v_vehicle public.vehicles; v_verify public.driver_verifications; v_docs jsonb;
begin
  select d.* into v_driver from public.drivers d join public.profiles p on p.id=d.profile_id
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
    'driver_photo_status',coalesce(v_verify.driver_photo_status,'MISSING'),
    'car_photos_status',coalesce(v_verify.car_photos_status,'MISSING'),
    'driving_licence_notes',v_verify.driving_licence_notes,
    'vehicle_rc_notes',v_verify.vehicle_rc_notes,
    'driver_photo_notes',v_verify.driver_photo_notes,
    'car_photos_notes',v_verify.car_photos_notes,
    'documents',v_docs
  );
end;
$$;

create or replace function public.register_driver_verification_upload(
  p_document_type text,p_storage_path text,p_original_name text,p_mime_type text,p_file_size integer
)
returns jsonb language plpgsql security definer set search_path='public','storage'
as $$
declare v_driver_id uuid; v_type text:=upper(btrim(coalesce(p_document_type,''))); v_id uuid; v_count integer;
begin
  select d.id into v_driver_id from public.drivers d join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Active Driver access required'); end if;
  if v_type not in ('DRIVING_LICENCE','VEHICLE_RC','DRIVER_PHOTO','CAR_PHOTO') then return jsonb_build_object('success',false,'error','Invalid trust document type'); end if;
  if coalesce(p_file_size,0)<=0 or p_file_size>8388608 then return jsonb_build_object('success',false,'error','File must be 8 MB or smaller'); end if;
  if lower(coalesce(p_mime_type,'')) not in ('image/jpeg','image/png','image/webp','application/pdf') then return jsonb_build_object('success',false,'error','Unsupported file type'); end if;
  if v_type in ('DRIVER_PHOTO','CAR_PHOTO') and lower(p_mime_type)='application/pdf' then return jsonb_build_object('success',false,'error','Driver and car photos must be images'); end if;
  if length(btrim(coalesce(p_original_name,'')))<1 or length(p_original_name)>180 then return jsonb_build_object('success',false,'error','Invalid file name'); end if;
  if position(auth.uid()::text||'/' in p_storage_path)<>1 then return jsonb_build_object('success',false,'error','Invalid private storage path'); end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='driver-verification' and o.name=p_storage_path) then return jsonb_build_object('success',false,'error','Uploaded file not found'); end if;

  insert into public.driver_verifications(driver_id) values(v_driver_id) on conflict(driver_id) do nothing;
  if v_type in ('DRIVING_LICENCE','VEHICLE_RC','DRIVER_PHOTO') then
    update public.driver_verification_documents set is_current=false,retired_at=now()
    where driver_id=v_driver_id and document_type=v_type and is_current=true;
  else
    select count(*) into v_count from public.driver_verification_documents where driver_id=v_driver_id and document_type='CAR_PHOTO' and is_current=true;
    if v_count>=4 then return jsonb_build_object('success',false,'error','Keep up to 4 current car photos'); end if;
  end if;

  insert into public.driver_verification_documents(driver_id,document_type,storage_path,original_name,mime_type,file_size)
  values(v_driver_id,v_type,p_storage_path,btrim(p_original_name),lower(p_mime_type),p_file_size) returning id into v_id;

  if v_type='DRIVING_LICENCE' then update public.driver_verifications set driving_licence_status='PENDING',driving_licence_notes=null where driver_id=v_driver_id;
  elsif v_type='VEHICLE_RC' then update public.driver_verifications set vehicle_rc_status='PENDING',vehicle_rc_notes=null where driver_id=v_driver_id;
  elsif v_type='DRIVER_PHOTO' then update public.driver_verifications set driver_photo_status='PENDING',driver_photo_notes=null where driver_id=v_driver_id;
  else update public.driver_verifications set car_photos_status='PENDING',car_photos_notes=null where driver_id=v_driver_id;
  end if;

  perform public.record_audit('driver_verification_upload','driver_verification_documents',v_id,null,jsonb_build_object('driver_id',v_driver_id,'document_type',v_type),null);
  return jsonb_build_object('success',true,'document_id',v_id,'document_type',v_type);
end;
$$;

create or replace function public.retire_my_driver_verification_document(p_document_id uuid)
returns jsonb language plpgsql security definer set search_path='public'
as $$
declare v_driver_id uuid; v_doc public.driver_verification_documents; v_remaining integer;
begin
  select d.id into v_driver_id from public.drivers d join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Active Driver access required'); end if;
  select * into v_doc from public.driver_verification_documents where id=p_document_id and driver_id=v_driver_id and is_current=true and document_type in ('DRIVING_LICENCE','VEHICLE_RC','DRIVER_PHOTO','CAR_PHOTO') for update;
  if v_doc.id is null then return jsonb_build_object('success',false,'error','Current trust document not found'); end if;
  update public.driver_verification_documents set is_current=false,retired_at=now() where id=v_doc.id;

  if v_doc.document_type='DRIVING_LICENCE' then update public.driver_verifications set driving_licence_status='MISSING',driving_licence_notes=null where driver_id=v_driver_id;
  elsif v_doc.document_type='VEHICLE_RC' then update public.driver_verifications set vehicle_rc_status='MISSING',vehicle_rc_notes=null where driver_id=v_driver_id;
  elsif v_doc.document_type='DRIVER_PHOTO' then update public.driver_verifications set driver_photo_status='MISSING',driver_photo_notes=null where driver_id=v_driver_id;
  else
    select count(*) into v_remaining from public.driver_verification_documents where driver_id=v_driver_id and document_type='CAR_PHOTO' and is_current=true;
    update public.driver_verifications set car_photos_status=case when v_remaining>0 then 'PENDING' else 'MISSING' end,car_photos_notes=null where driver_id=v_driver_id;
  end if;

  perform public.record_audit('driver_verification_retire','driver_verification_documents',v_doc.id,to_jsonb(v_doc),jsonb_build_object('is_current',false),null);
  return jsonb_build_object('success',true,'document_type',v_doc.document_type);
end;
$$;

create or replace function public.admin_list_driver_verifications_v2()
returns table(
  driver_id uuid,profile_id uuid,display_name text,vehicle_number text,vehicle_type text,vehicle_model text,
  driving_licence_status text,vehicle_rc_status text,driver_photo_status text,car_photos_status text,
  fully_verified boolean,current_document_count bigint
)
language plpgsql stable security definer set search_path='public'
as $$
begin
  if not public.is_admin() then return; end if;
  return query select d.id,d.profile_id,d.display_name,v.registration_number,v.vehicle_type,v.vehicle_model,
    coalesce(ver.driving_licence_status,'MISSING'),coalesce(ver.vehicle_rc_status,'MISSING'),coalesce(ver.driver_photo_status,'MISSING'),coalesce(ver.car_photos_status,'MISSING'),
    coalesce(ver.driving_licence_status='VERIFIED' and ver.vehicle_rc_status='VERIFIED' and ver.driver_photo_status='VERIFIED' and ver.car_photos_status='VERIFIED',false),
    (select count(*) from public.driver_verification_documents doc where doc.driver_id=d.id and doc.is_current=true)
  from public.drivers d
  join public.profiles p on p.id=d.profile_id
  left join public.vehicles v on v.id=d.vehicle_id
  left join public.driver_verifications ver on ver.driver_id=d.id
  where d.is_active=true and not p.is_restricted
  order by d.display_name;
end;
$$;

create or replace function public.admin_set_driver_verification_status(
  p_driver_id uuid,p_document_type text,p_status text,p_notes text default null
)
returns jsonb language plpgsql security definer set search_path='public'
as $$
declare v_type text:=upper(btrim(coalesce(p_document_type,''))); v_status text:=upper(btrim(coalesce(p_status,''))); v_before public.driver_verifications; v_count integer;
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  if v_type not in ('DRIVING_LICENCE','VEHICLE_RC','DRIVER_PHOTO','CAR_PHOTO') then return jsonb_build_object('success',false,'error','Invalid verification type'); end if;
  if v_status not in ('VERIFIED','REJECTED') then return jsonb_build_object('success',false,'error','Review status must be VERIFIED or REJECTED'); end if;
  if not exists(select 1 from public.drivers d where d.id=p_driver_id and d.is_active=true) then return jsonb_build_object('success',false,'error','Active Driver not found'); end if;
  select count(*) into v_count from public.driver_verification_documents where driver_id=p_driver_id and document_type=v_type and is_current=true;
  if v_count<1 then return jsonb_build_object('success',false,'error','Upload at least one current document before review'); end if;
  insert into public.driver_verifications(driver_id) values(p_driver_id) on conflict(driver_id) do nothing;
  select * into v_before from public.driver_verifications where driver_id=p_driver_id for update;

  if v_type='DRIVING_LICENCE' then update public.driver_verifications set driving_licence_status=v_status,driving_licence_notes=nullif(btrim(coalesce(p_notes,'')),'') where driver_id=p_driver_id;
  elsif v_type='VEHICLE_RC' then update public.driver_verifications set vehicle_rc_status=v_status,vehicle_rc_notes=nullif(btrim(coalesce(p_notes,'')),'') where driver_id=p_driver_id;
  elsif v_type='DRIVER_PHOTO' then update public.driver_verifications set driver_photo_status=v_status,driver_photo_notes=nullif(btrim(coalesce(p_notes,'')),'') where driver_id=p_driver_id;
  else update public.driver_verifications set car_photos_status=v_status,car_photos_notes=nullif(btrim(coalesce(p_notes,'')),'') where driver_id=p_driver_id;
  end if;
  update public.driver_verifications set reviewed_by=auth.uid(),reviewed_at=now() where driver_id=p_driver_id;
  perform public.record_audit('admin_driver_verification_review','driver_verifications',p_driver_id,to_jsonb(v_before),jsonb_build_object('document_type',v_type,'status',v_status),null);
  return jsonb_build_object('success',true,'driver_id',p_driver_id,'document_type',v_type,'status',v_status);
end;
$$;

create or replace function public.get_driver_trust_badge(p_driver_id uuid)
returns jsonb language plpgsql stable security definer set search_path='public'
as $$
declare v_driver public.drivers; v_vehicle public.vehicles; v_verify public.driver_verifications;
begin
  if not public.can_view_driver_trust(p_driver_id) then return jsonb_build_object('success',false,'error','Driver trust access required'); end if;
  select d.* into v_driver from public.drivers d join public.profiles p on p.id=d.profile_id where d.id=p_driver_id and d.is_active=true and not p.is_restricted;
  if v_driver.id is null then return jsonb_build_object('success',false,'error','Active Driver not found'); end if;
  select * into v_vehicle from public.vehicles where id=v_driver.vehicle_id and is_active=true;
  select * into v_verify from public.driver_verifications where driver_id=v_driver.id;
  return jsonb_build_object(
    'success',true,'driver_id',v_driver.id,'display_name',v_driver.display_name,
    'driving_licence_verified',coalesce(v_verify.driving_licence_status='VERIFIED',false),
    'vehicle_rc_verified',coalesce(v_verify.vehicle_rc_status='VERIFIED',false),
    'driver_photo_verified',coalesce(v_verify.driver_photo_status='VERIFIED',false),
    'car_photos_verified',coalesce(v_verify.car_photos_status='VERIFIED',false),
    'fully_verified',coalesce(v_verify.driving_licence_status='VERIFIED' and v_verify.vehicle_rc_status='VERIFIED' and v_verify.driver_photo_status='VERIFIED' and v_verify.car_photos_status='VERIFIED',false),
    'vehicle_number',v_vehicle.registration_number,'vehicle_type',v_vehicle.vehicle_type,'vehicle_model',v_vehicle.vehicle_model,'capacity',v_vehicle.capacity
  );
end;
$$;

create or replace function public.get_driver_verified_profile_photo(p_driver_id uuid)
returns table(document_id uuid,storage_path text,original_name text,mime_type text)
language plpgsql stable security definer set search_path='public'
as $$
begin
  if not public.can_view_driver_trust(p_driver_id) then return; end if;
  if not exists(
    select 1 from public.drivers d join public.profiles p on p.id=d.profile_id join public.driver_verifications v on v.driver_id=d.id
    where d.id=p_driver_id and d.is_active=true and not p.is_restricted and v.driver_photo_status='VERIFIED'
  ) then return; end if;
  return query select doc.id,doc.storage_path,doc.original_name,doc.mime_type
  from public.driver_verification_documents doc
  where doc.driver_id=p_driver_id and doc.document_type='DRIVER_PHOTO' and doc.is_current=true
  order by doc.created_at desc limit 1;
end;
$$;

create or replace function public.is_driver_launch_compliant(p_driver_id uuid)
returns boolean language sql stable security definer set search_path='public' as $$
  select exists(
    select 1 from public.driver_verifications v
    where v.driver_id=p_driver_id
      and v.driving_licence_status='VERIFIED'
      and v.vehicle_rc_status='VERIFIED'
      and v.driver_photo_status='VERIFIED'
      and v.car_photos_status='VERIFIED'
      and v.vehicle_classification='COMMERCIAL_PERMITTED'
      and v.vehicle_classification_status='VERIFIED'
      and v.vehicle_permit_status='VERIFIED'
      and v.vehicle_fitness_status='VERIFIED'
      and v.vehicle_insurance_status='VERIFIED'
      and v.vehicle_puc_status='VERIFIED'
  );
$$;

revoke all on function public.admin_list_driver_verifications_v2() from public,anon,service_role;
revoke all on function public.get_driver_verified_profile_photo(uuid) from public,anon,service_role;
grant execute on function public.admin_list_driver_verifications_v2() to authenticated;
grant execute on function public.get_driver_verified_profile_photo(uuid) to authenticated;

-- Keep the Passenger quote projection aligned with the same full launch-compliance
-- definition enforced at Driver lead/quote/accept boundaries.
create or replace function public.get_my_outstation_quotes(p_request_id uuid)
returns table(
  quote_id uuid,driver_id uuid,driver_name text,total_price integer,includes_tolls boolean,includes_parking boolean,driver_note text,
  vehicle_number text,vehicle_type text,vehicle_model text,vehicle_capacity integer,quote_status text,expires_at timestamptz,
  driving_licence_verified boolean,vehicle_rc_verified boolean,car_photos_verified boolean,fully_verified boolean,driver_phone text
)
language plpgsql stable security definer set search_path='public'
as $$
begin
  if not exists(select 1 from public.outstation_requests r where r.id=p_request_id and (r.passenger_id=auth.uid() or public.is_admin())) then return; end if;
  return query select q.id,q.driver_id,d.display_name,q.total_price,q.includes_tolls,q.includes_parking,q.driver_note,
    q.vehicle_number,q.vehicle_type,q.vehicle_model,q.vehicle_capacity,q.status,q.expires_at,
    coalesce(v.driving_licence_status='VERIFIED',false),coalesce(v.vehicle_rc_status='VERIFIED',false),coalesce(v.car_photos_status='VERIFIED',false),
    public.is_driver_launch_compliant(q.driver_id),case when q.status='ACCEPTED' then d.phone else null end
  from public.outstation_quotes q join public.drivers d on d.id=q.driver_id left join public.driver_verifications v on v.driver_id=q.driver_id
  where q.request_id=p_request_id and q.status in ('OFFERED','ACCEPTED') and (q.status='ACCEPTED' or q.expires_at>now())
  order by case when q.status='ACCEPTED' then 0 else 1 end,q.total_price,q.created_at;
end;
$$;
revoke all on function public.get_my_outstation_quotes(uuid) from public,anon,service_role;
grant execute on function public.get_my_outstation_quotes(uuid) to authenticated;
