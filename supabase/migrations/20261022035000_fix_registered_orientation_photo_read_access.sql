-- Full Safety Orientation PDF: allow a member of the orientation's jobsite,
-- or an Admin, to read only the evidence paths attached to that orientation.
-- Keep the bucket private and retain the existing upload/delete policies.
alter policy "members read orientation photos"
on storage.objects
using (
  bucket_id = 'orientation-photos'
  and exists (
    select 1 from public.safety_orientations so
    where (
      so.orientation_photo_path = storage.objects.name
      or so.sticker_photo_path = storage.objects.name
      or so.orientation_document_photo_path = storage.objects.name
      or storage.objects.name = any(coalesce(so.certificate_photo_paths, '{}'::text[]))
    )
    and (
      exists (
        select 1 from public.project_members pm
        where pm.project_id = so.project_id
          and pm.user_id = (select auth.uid())
      )
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid())
          and p.role = 'admin'
      )
    )
  )
);
