create policy "backup admin restriction" on public.cloud_backups as restrictive for all to authenticated
using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'))
with check (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy "backup files admin restriction" on storage.objects as restrictive for all to authenticated
using (bucket_id <> 'cloud-backups' or exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'))
with check (bucket_id <> 'cloud-backups' or exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));