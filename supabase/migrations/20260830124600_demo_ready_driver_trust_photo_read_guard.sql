-- A verified car photo is readable only when the viewer may see this Driver's trust profile.
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
      and public.can_view_driver_trust(doc.driver_id)
  );
end;
$function$;
