-- Persist one employee Face ID outside the four jobsite evidence photos.
-- Historical Quick Orientation records retain NULL until a face photo is collected.
alter table public.quick_safety_orientations
  add column if not exists face_photo_path text;

-- Quick Face ID images live in the existing private orientation bucket. They
-- can only be read by authorized project members after linking to the record.
drop policy if exists "project members view quick orientation photos" on storage.objects;
create policy "project members view quick orientation photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'quick-orientation-photos'
  and exists (
    select 1 from public.quick_safety_orientations q
    where q.project_id = (storage.foldername(name))[1]::uuid
      and q.id = (storage.foldername(name))[3]::uuid
      and (q.photo_paths @> array[name] or q.face_photo_path = name)
      and private.is_project_member(q.project_id)
  )
);
