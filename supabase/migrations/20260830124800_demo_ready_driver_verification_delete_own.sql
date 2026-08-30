-- Drivers may delete only verification objects inside their own private folder.
-- This supports privacy cleanup after replace/remove; passengers receive no delete access.
drop policy if exists "Raahi driver verification delete own" on storage.objects;
create policy "Raahi driver verification delete own"
on storage.objects for delete to authenticated
using (
  bucket_id='driver-verification'
  and public.can_upload_driver_verification_object(name)
);
