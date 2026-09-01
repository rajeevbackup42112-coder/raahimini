-- Raahi Driver launch compliance.
-- Extends the existing trust documents without exposing new raw documents to Passengers.

alter table public.driver_verifications
  add column if not exists vehicle_classification text not null default 'UNDECLARED',
  add column if not exists vehicle_classification_status text not null default 'MISSING',
  add column if not exists vehicle_classification_notes text,
  add column if not exists vehicle_permit_status text not null default 'MISSING',
  add column if not exists vehicle_permit_notes text,
  add column if not exists vehicle_fitness_status text not null default 'MISSING',
  add column if not exists vehicle_fitness_notes text,
  add column if not exists vehicle_insurance_status text not null default 'MISSING',
  add column if not exists vehicle_insurance_notes text,
  add column if not exists vehicle_puc_status text not null default 'MISSING',
  add column if not exists vehicle_puc_notes text;

alter table public.driver_verifications drop constraint if exists driver_verifications_vehicle_classification_check;
alter table public.driver_verifications add constraint driver_verifications_vehicle_classification_check
  check(vehicle_classification in ('UNDECLARED','COMMERCIAL_PERMITTED','PRIVATE_NON_TRANSPORT','OTHER'));

alter table public.driver_verifications drop constraint if exists driver_verifications_launch_status_check;
alter table public.driver_verifications add constraint driver_verifications_launch_status_check check(
  vehicle_classification_status in ('MISSING','PENDING','VERIFIED','REJECTED') and
  vehicle_permit_status in ('MISSING','PENDING','VERIFIED','REJECTED') and
  vehicle_fitness_status in ('MISSING','PENDING','VERIFIED','REJECTED') and
  vehicle_insurance_status in ('MISSING','PENDING','VERIFIED','REJECTED') and
  vehicle_puc_status in ('MISSING','PENDING','VERIFIED','REJECTED')
);
alter table public.driver_verification_documents
  drop constraint if exists driver_verification_documents_document_type_check;
alter table public.driver_verification_documents
  add constraint driver_verification_documents_document_type_check check(document_type in (
    'DRIVING_LICENCE','VEHICLE_RC','CAR_PHOTO',
    'VEHICLE_PERMIT','VEHICLE_FITNESS','VEHICLE_INSURANCE','VEHICLE_PUC'
  ));

create or replace function public.is_driver_launch_compliant(p_driver_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.driver_verifications v
    where v.driver_id=p_driver_id
      and v.driving_licence_status='VERIFIED'
      and v.vehicle_rc_status='VERIFIED'
      and v.car_photos_status='VERIFIED'
      and v.vehicle_classification='COMMERCIAL_PERMITTED'
      and v.vehicle_classification_status='VERIFIED'
      and v.vehicle_permit_status='VERIFIED'
      and v.vehicle_fitness_status='VERIFIED'
      and v.vehicle_insurance_status='VERIFIED'
      and v.vehicle_puc_status='VERIFIED'
  );
$$;
revoke all on function public.is_driver_launch_compliant(uuid) from public,anon,authenticated;

create or replace function public.get_my_driver_launch_compliance()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_driver_id uuid; v public.driver_verifications; v_docs jsonb;
begin
  select d.id into v_driver_id from public.drivers d join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Active Driver access required'); end if;
  select * into v from public.driver_verifications where driver_id=v_driver_id;
  select coalesce(jsonb_agg(jsonb_build_object('document_id',d.id,'document_type',d.document_type,'storage_path',d.storage_path,'original_name',d.original_name,'mime_type',d.mime_type,'file_size',d.file_size,'created_at',d.created_at) order by d.created_at desc),'[]'::jsonb)
    into v_docs from public.driver_verification_documents d where d.driver_id=v_driver_id and d.is_current=true and d.document_type in ('VEHICLE_PERMIT','VEHICLE_FITNESS','VEHICLE_INSURANCE','VEHICLE_PUC');
  return jsonb_build_object('success',true,'driver_id',v_driver_id,'vehicle_classification',coalesce(v.vehicle_classification,'UNDECLARED'),'vehicle_classification_status',coalesce(v.vehicle_classification_status,'MISSING'),'vehicle_classification_notes',v.vehicle_classification_notes,
    'vehicle_permit_status',coalesce(v.vehicle_permit_status,'MISSING'),'vehicle_permit_notes',v.vehicle_permit_notes,
    'vehicle_fitness_status',coalesce(v.vehicle_fitness_status,'MISSING'),'vehicle_fitness_notes',v.vehicle_fitness_notes,
    'vehicle_insurance_status',coalesce(v.vehicle_insurance_status,'MISSING'),'vehicle_insurance_notes',v.vehicle_insurance_notes,
    'vehicle_puc_status',coalesce(v.vehicle_puc_status,'MISSING'),'vehicle_puc_notes',v.vehicle_puc_notes,
    'launch_compliant',public.is_driver_launch_compliant(v_driver_id),'documents',v_docs);
end; $$;
create or replace function public.set_my_vehicle_classification(p_classification text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_driver_id uuid; v_class text:=upper(trim(coalesce(p_classification,'')));
begin
  select d.id into v_driver_id from public.drivers d join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Active Driver access required'); end if;
  if v_class not in ('COMMERCIAL_PERMITTED','PRIVATE_NON_TRANSPORT','OTHER') then return jsonb_build_object('success',false,'error','Choose a valid vehicle classification'); end if;
  insert into public.driver_verifications(driver_id) values(v_driver_id) on conflict(driver_id) do nothing;
  update public.driver_verifications set vehicle_classification=v_class,vehicle_classification_status='PENDING',vehicle_classification_notes=null where driver_id=v_driver_id;
  perform public.record_audit('driver_vehicle_classification','driver_verifications',v_driver_id,null,jsonb_build_object('vehicle_classification',v_class),null);
  return jsonb_build_object('success',true,'vehicle_classification',v_class,'status','PENDING');
end; $$;

create or replace function public.register_driver_compliance_upload(
  p_document_type text,p_storage_path text,p_original_name text,p_mime_type text,p_file_size integer
)
returns jsonb language plpgsql security definer set search_path to 'public','storage' as $$
declare v_driver_id uuid; v_type text:=upper(trim(coalesce(p_document_type,''))); v_id uuid;
begin
  select d.id into v_driver_id from public.drivers d join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Active Driver access required'); end if;
  if v_type not in ('VEHICLE_PERMIT','VEHICLE_FITNESS','VEHICLE_INSURANCE','VEHICLE_PUC') then return jsonb_build_object('success',false,'error','Invalid compliance document type'); end if;
  if coalesce(p_file_size,0)<=0 or p_file_size>8388608 then return jsonb_build_object('success',false,'error','File must be 8 MB or smaller'); end if;
  if lower(coalesce(p_mime_type,'')) not in ('image/jpeg','image/png','image/webp','application/pdf') then return jsonb_build_object('success',false,'error','Unsupported file type'); end if;
  if length(trim(coalesce(p_original_name,'')))<1 or length(p_original_name)>180 then return jsonb_build_object('success',false,'error','Invalid file name'); end if;
  if position(auth.uid()::text||'/' in p_storage_path)<>1 then return jsonb_build_object('success',false,'error','Invalid private storage path'); end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='driver-verification' and o.name=p_storage_path) then return jsonb_build_object('success',false,'error','Uploaded file not found'); end if;
  insert into public.driver_verifications(driver_id) values(v_driver_id) on conflict(driver_id) do nothing;
  update public.driver_verification_documents set is_current=false,retired_at=now() where driver_id=v_driver_id and document_type=v_type and is_current=true;
  insert into public.driver_verification_documents(driver_id,document_type,storage_path,original_name,mime_type,file_size)
  values(v_driver_id,v_type,p_storage_path,trim(p_original_name),lower(p_mime_type),p_file_size) returning id into v_id;
  if v_type='VEHICLE_PERMIT' then
    update public.driver_verifications set vehicle_permit_status='PENDING',vehicle_permit_notes=null where driver_id=v_driver_id;
  elsif v_type='VEHICLE_FITNESS' then
    update public.driver_verifications set vehicle_fitness_status='PENDING',vehicle_fitness_notes=null where driver_id=v_driver_id;
  elsif v_type='VEHICLE_INSURANCE' then
    update public.driver_verifications set vehicle_insurance_status='PENDING',vehicle_insurance_notes=null where driver_id=v_driver_id;
  else
    update public.driver_verifications set vehicle_puc_status='PENDING',vehicle_puc_notes=null where driver_id=v_driver_id;
  end if;
  perform public.record_audit('driver_compliance_upload','driver_verification_documents',v_id,null,jsonb_build_object('driver_id',v_driver_id,'document_type',v_type),null);
  return jsonb_build_object('success',true,'document_id',v_id,'document_type',v_type);
end; $$;

create or replace function public.retire_my_driver_compliance_document(p_document_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_driver_id uuid; v_doc public.driver_verification_documents;
begin
  select d.id into v_driver_id from public.drivers d join public.profiles p on p.id=d.profile_id
  where d.profile_id=auth.uid() and d.is_active=true and not p.is_restricted;
  if v_driver_id is null then return jsonb_build_object('success',false,'error','Active Driver access required'); end if;
  select * into v_doc from public.driver_verification_documents where id=p_document_id and driver_id=v_driver_id and is_current=true and document_type in ('VEHICLE_PERMIT','VEHICLE_FITNESS','VEHICLE_INSURANCE','VEHICLE_PUC') for update;
  if v_doc.id is null then return jsonb_build_object('success',false,'error','Current compliance document not found'); end if;
  update public.driver_verification_documents set is_current=false,retired_at=now() where id=v_doc.id;
  if v_doc.document_type='VEHICLE_PERMIT' then update public.driver_verifications set vehicle_permit_status='MISSING',vehicle_permit_notes=null where driver_id=v_driver_id;
  elsif v_doc.document_type='VEHICLE_FITNESS' then update public.driver_verifications set vehicle_fitness_status='MISSING',vehicle_fitness_notes=null where driver_id=v_driver_id;
  elsif v_doc.document_type='VEHICLE_INSURANCE' then update public.driver_verifications set vehicle_insurance_status='MISSING',vehicle_insurance_notes=null where driver_id=v_driver_id;
  else update public.driver_verifications set vehicle_puc_status='MISSING',vehicle_puc_notes=null where driver_id=v_driver_id;
  end if;
  perform public.record_audit('driver_compliance_retire','driver_verification_documents',v_doc.id,to_jsonb(v_doc),jsonb_build_object('is_current',false),null);
  return jsonb_build_object('success',true,'document_type',v_doc.document_type);
end; $$;
create or replace function public.admin_list_driver_launch_compliance()
returns table(driver_id uuid,vehicle_classification text,vehicle_classification_status text,vehicle_permit_status text,vehicle_fitness_status text,vehicle_insurance_status text,vehicle_puc_status text,launch_compliant boolean)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_admin() then return; end if;
  return query select d.id,
    coalesce(v.vehicle_classification,'UNDECLARED'),coalesce(v.vehicle_classification_status,'MISSING'),
    coalesce(v.vehicle_permit_status,'MISSING'),coalesce(v.vehicle_fitness_status,'MISSING'),
    coalesce(v.vehicle_insurance_status,'MISSING'),coalesce(v.vehicle_puc_status,'MISSING'),
    public.is_driver_launch_compliant(d.id)
  from public.drivers d join public.profiles p on p.id=d.profile_id
  left join public.driver_verifications v on v.driver_id=d.id
  where d.is_active=true and not p.is_restricted order by d.display_name;
end; $$;

create or replace function public.admin_get_driver_launch_compliance(p_driver_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v public.driver_verifications; v_docs jsonb;
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  if not exists(select 1 from public.drivers where id=p_driver_id and is_active=true) then return jsonb_build_object('success',false,'error','Active Driver not found'); end if;
  select * into v from public.driver_verifications where driver_id=p_driver_id;
  select coalesce(jsonb_agg(jsonb_build_object('document_id',d.id,'document_type',d.document_type,'storage_path',d.storage_path,'original_name',d.original_name,'mime_type',d.mime_type,'file_size',d.file_size,'created_at',d.created_at) order by d.created_at desc),'[]'::jsonb)
    into v_docs from public.driver_verification_documents d where d.driver_id=p_driver_id and d.is_current=true and d.document_type in ('VEHICLE_PERMIT','VEHICLE_FITNESS','VEHICLE_INSURANCE','VEHICLE_PUC');
  return jsonb_build_object('success',true,'driver_id',p_driver_id,'vehicle_classification',coalesce(v.vehicle_classification,'UNDECLARED'),'vehicle_classification_status',coalesce(v.vehicle_classification_status,'MISSING'),'vehicle_classification_notes',v.vehicle_classification_notes,
    'vehicle_permit_status',coalesce(v.vehicle_permit_status,'MISSING'),'vehicle_permit_notes',v.vehicle_permit_notes,
    'vehicle_fitness_status',coalesce(v.vehicle_fitness_status,'MISSING'),'vehicle_fitness_notes',v.vehicle_fitness_notes,
    'vehicle_insurance_status',coalesce(v.vehicle_insurance_status,'MISSING'),'vehicle_insurance_notes',v.vehicle_insurance_notes,
    'vehicle_puc_status',coalesce(v.vehicle_puc_status,'MISSING'),'vehicle_puc_notes',v.vehicle_puc_notes,
    'launch_compliant',public.is_driver_launch_compliant(p_driver_id),'documents',v_docs);
end; $$;
create or replace function public.admin_set_driver_launch_compliance_status(p_driver_id uuid,p_item text,p_status text,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_item text:=upper(trim(coalesce(p_item,''))); v_status text:=upper(trim(coalesce(p_status,''))); v_doc_type text; v_count integer; v_before public.driver_verifications;
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  if v_status not in ('VERIFIED','REJECTED') then return jsonb_build_object('success',false,'error','Review status must be VERIFIED or REJECTED'); end if;
  if not exists(select 1 from public.drivers where id=p_driver_id and is_active=true) then return jsonb_build_object('success',false,'error','Active Driver not found'); end if;
  insert into public.driver_verifications(driver_id) values(p_driver_id) on conflict(driver_id) do nothing;
  select * into v_before from public.driver_verifications where driver_id=p_driver_id for update;

  if v_item='VEHICLE_CLASSIFICATION' then
    if v_before.vehicle_classification='UNDECLARED' then return jsonb_build_object('success',false,'error','Driver must declare the vehicle classification first'); end if;
    update public.driver_verifications set vehicle_classification_status=v_status,vehicle_classification_notes=nullif(trim(coalesce(p_notes,'')),'') where driver_id=p_driver_id;
  else
    v_doc_type:=case v_item when 'VEHICLE_PERMIT' then 'VEHICLE_PERMIT' when 'VEHICLE_FITNESS' then 'VEHICLE_FITNESS' when 'VEHICLE_INSURANCE' then 'VEHICLE_INSURANCE' when 'VEHICLE_PUC' then 'VEHICLE_PUC' else null end;
    if v_doc_type is null then return jsonb_build_object('success',false,'error','Invalid compliance item'); end if;
    select count(*) into v_count from public.driver_verification_documents where driver_id=p_driver_id and document_type=v_doc_type and is_current=true;
    if v_count<1 then return jsonb_build_object('success',false,'error','Upload a current document before review'); end if;
    if v_item='VEHICLE_PERMIT' then update public.driver_verifications set vehicle_permit_status=v_status,vehicle_permit_notes=nullif(trim(coalesce(p_notes,'')),'') where driver_id=p_driver_id;
    elsif v_item='VEHICLE_FITNESS' then update public.driver_verifications set vehicle_fitness_status=v_status,vehicle_fitness_notes=nullif(trim(coalesce(p_notes,'')),'') where driver_id=p_driver_id;
    elsif v_item='VEHICLE_INSURANCE' then update public.driver_verifications set vehicle_insurance_status=v_status,vehicle_insurance_notes=nullif(trim(coalesce(p_notes,'')),'') where driver_id=p_driver_id;
    else update public.driver_verifications set vehicle_puc_status=v_status,vehicle_puc_notes=nullif(trim(coalesce(p_notes,'')),'') where driver_id=p_driver_id;
    end if;
  end if;
  update public.driver_verifications set reviewed_by=auth.uid(),reviewed_at=now() where driver_id=p_driver_id;
  perform public.record_audit('admin_set_driver_launch_compliance_status','driver_verifications',p_driver_id,to_jsonb(v_before),jsonb_build_object('item',v_item,'status',v_status,'notes',nullif(trim(coalesce(p_notes,'')),'')),null);
  return jsonb_build_object('success',true,'item',v_item,'status',v_status,'launch_compliant',public.is_driver_launch_compliant(p_driver_id));
end; $$;
create or replace function public.enforce_driver_launch_compliance()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_driver_id uuid; v_requires_gate boolean:=false;
begin
  if v_uid is null then return new; end if;
  if tg_table_name='driver_queue' and tg_op='INSERT' then
    select id into v_driver_id from public.drivers where profile_id=v_uid and is_active=true;
    v_requires_gate:=true;
  elsif tg_table_name='outstation_quotes' then
    if tg_op='INSERT' or (tg_op='UPDATE' and new.status='OFFERED' and (
      new.total_price is distinct from old.total_price or new.includes_tolls is distinct from old.includes_tolls
      or new.includes_parking is distinct from old.includes_parking or new.driver_note is distinct from old.driver_note
    )) then v_driver_id:=new.driver_id; v_requires_gate:=true; end if;
  elsif tg_table_name='outstation_requests' and tg_op='UPDATE' and new.accepted_quote_id is not null and new.accepted_quote_id is distinct from old.accepted_quote_id then
    select q.driver_id into v_driver_id from public.outstation_quotes q where q.id=new.accepted_quote_id;
    v_requires_gate:=true;
  end if;
  if v_requires_gate and (v_driver_id is null or not public.is_driver_launch_compliant(v_driver_id)) then
    raise exception 'DRIVER_LAUNCH_COMPLIANCE_REQUIRED' using errcode='P0001';
  end if;
  return new;
end; $$;
revoke all on function public.enforce_driver_launch_compliance() from public,anon,authenticated;

drop trigger if exists driver_compliance_queue on public.driver_queue;
create trigger driver_compliance_queue before insert on public.driver_queue for each row execute function public.enforce_driver_launch_compliance();
drop trigger if exists driver_compliance_outstation_quotes on public.outstation_quotes;
create trigger driver_compliance_outstation_quotes before insert or update on public.outstation_quotes for each row execute function public.enforce_driver_launch_compliance();
drop trigger if exists driver_compliance_outstation_accept on public.outstation_requests;
create trigger driver_compliance_outstation_accept before update of accepted_quote_id on public.outstation_requests for each row execute function public.enforce_driver_launch_compliance();
revoke all on function public.get_my_driver_launch_compliance() from public,anon,service_role;
revoke all on function public.set_my_vehicle_classification(text) from public,anon,service_role;
revoke all on function public.register_driver_compliance_upload(text,text,text,text,integer) from public,anon,service_role;
revoke all on function public.retire_my_driver_compliance_document(uuid) from public,anon,service_role;
revoke all on function public.admin_list_driver_launch_compliance() from public,anon,service_role;
revoke all on function public.admin_get_driver_launch_compliance(uuid) from public,anon,service_role;
revoke all on function public.admin_set_driver_launch_compliance_status(uuid,text,text,text) from public,anon,service_role;

grant execute on function public.get_my_driver_launch_compliance() to authenticated;
grant execute on function public.set_my_vehicle_classification(text) to authenticated;
grant execute on function public.register_driver_compliance_upload(text,text,text,text,integer) to authenticated;
grant execute on function public.retire_my_driver_compliance_document(uuid) to authenticated;
grant execute on function public.admin_list_driver_launch_compliance() to authenticated;
grant execute on function public.admin_get_driver_launch_compliance(uuid) to authenticated;
grant execute on function public.admin_set_driver_launch_compliance_status(uuid,text,text,text) to authenticated;
