-- Restrict the administrator-only Director Dashboard at the database and file layers.
drop policy if exists "admin only director tool records" on public.safety_tool_records;
create policy "admin only director tool records"
 on public.safety_tool_records as restrictive for all to authenticated
 using (kind <> 'director' or (select private.my_role()) = 'admin')
 with check (kind <> 'director' or (select private.my_role()) = 'admin');

drop policy if exists "admin only director tool reports" on public.report_documents;
create policy "admin only director tool reports"
 on public.report_documents as restrictive for all to authenticated
 using (report_type <> 'tool_director' or (select private.my_role()) = 'admin')
 with check (report_type <> 'tool_director' or (select private.my_role()) = 'admin');

drop policy if exists "admin only director report files" on storage.objects;
create policy "admin only director report files"
 on storage.objects as restrictive for all to authenticated
 using (
  bucket_id <> 'final-reports'
  or (storage.foldername(name))[2] <> 'tool_director'
  or (select private.my_role()) = 'admin'
 )
 with check (
  bucket_id <> 'final-reports'
  or (storage.foldername(name))[2] <> 'tool_director'
  or (select private.my_role()) = 'admin'
 );
