-- Apply the same relationship guard to trust badges and verified car-photo listings.
create or replace function public.get_driver_trust_badge(p_driver_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_driver public.drivers; v_vehicle public.vehicles; v_verify public.driver_verifications;
begin
  if not public.can_view_driver_trust(p_driver_id) then return jsonb_build_object('success',false,'error','Driver trust access required'); end if;
  select d.* into v_driver from public.drivers d join public.profiles p on p.id=d.profile_id
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
    'vehicle_number',v_vehicle.registration_number,'vehicle_type',v_vehicle.vehicle_type,
    'vehicle_model',v_vehicle.vehicle_model,'capacity',v_vehicle.capacity
  );
end;
$function$;

create or replace function public.get_driver_verified_car_photos(p_driver_id uuid)
returns table(document_id uuid,storage_path text,original_name text,mime_type text)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.can_view_driver_trust(p_driver_id) then return; end if;
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
