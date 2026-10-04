-- Additive tools. Saved source records are immutable; PDF exports are versioned.
create table public.safety_tool_records (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id),
 created_by uuid not null references public.profiles(id),
 kind text not null check (kind in ('toolbox','training','safety_net','emergency','director','qr','hazard')),
 report_number text not null unique,
 payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object' and octet_length(payload::text)<2000000),
 photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos)='array' and jsonb_array_length(photos)<=12),
 created_at timestamptz not null default now()
);
create index safety_tool_records_project_kind_date on public.safety_tool_records(project_id,kind,created_at desc);
create index safety_tool_records_creator on public.safety_tool_records(created_by);
alter table public.safety_tool_records enable row level security;
revoke all on public.safety_tool_records from anon,authenticated;
grant select,insert on public.safety_tool_records to authenticated;
create policy "tools read project and role" on public.safety_tool_records for select to authenticated using (
 private.is_project_member(project_id)
 and (kind<>'director' or private.my_role() in ('admin','safety_director'))
 and (kind<>'qr' or private.my_role() in ('admin','safety_director','safety','supervisor'))
);
create policy "tools create project and role" on public.safety_tool_records for insert to authenticated with check (
 created_by=(select auth.uid()) and private.is_project_member(project_id)
 and not exists(select 1 from jsonb_array_elements(photos) photo where
   photo->>'path' is null or not starts_with(photo->>'path',project_id::text||'/'||created_by::text||'/'||id::text||'/'))
 and case kind
 when 'director' then private.my_role() in ('admin','safety_director')
 when 'emergency' then private.my_role() in ('admin','safety_director','safety')
 when 'hazard' then private.my_role() in ('admin','safety_director','safety','supervisor','worker')
 else private.my_role() in ('admin','safety_director','safety','supervisor') end
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('safety-tool-evidence','safety-tool-evidence',false,10485760,array['image/jpeg','image/png','image/webp']);
create policy "tools evidence upload own" on storage.objects for insert to authenticated with check (
 bucket_id='safety-tool-evidence' and (storage.foldername(name))[2]=(select auth.uid())::text
 and private.is_project_member(((storage.foldername(name))[1])::uuid)
);
create policy "tools evidence view authorized record" on storage.objects for select to authenticated using (
 bucket_id='safety-tool-evidence' and (
 ((storage.foldername(name))[2]=(select auth.uid())::text and private.is_project_member(((storage.foldername(name))[1])::uuid))
 or exists(select 1 from public.safety_tool_records r where r.photos @> jsonb_build_array(jsonb_build_object('path',objects.name)))
 )
);
create policy "tools evidence cleanup uncommitted" on storage.objects for delete to authenticated using (
 bucket_id='safety-tool-evidence' and (storage.foldername(name))[2]=(select auth.uid())::text
 and not exists(select 1 from public.safety_tool_records r where r.photos @> jsonb_build_array(jsonb_build_object('path',objects.name)))
);
alter table public.report_documents drop constraint report_documents_report_type_check;
alter table public.report_documents add constraint report_documents_report_type_check check (report_type in (
 'daily_report','daily_safety_walk','observation','correction','disciplinary_action','incident','near_miss','jha','toolbox','equipment_inspection','training','inventory',
 'tool_toolbox','tool_training','tool_safety_net','tool_emergency','tool_director','tool_qr','tool_hazard'
));
create policy "new tool report role restriction" on public.report_documents as restrictive for all to authenticated using (
 (report_type<>'tool_director' or private.my_role() in ('admin','safety_director'))
 and (report_type<>'tool_qr' or private.my_role() in ('admin','safety_director','safety','supervisor'))
) with check (
 (report_type<>'tool_director' or private.my_role() in ('admin','safety_director'))
 and (report_type<>'tool_qr' or private.my_role() in ('admin','safety_director','safety','supervisor'))
);
create policy "new tool pdf role restriction" on storage.objects as restrictive for all to authenticated using (
 bucket_id<>'final-reports' or (
 ((storage.foldername(name))[2]<>'tool_director' or private.my_role() in ('admin','safety_director'))
 and ((storage.foldername(name))[2]<>'tool_qr' or private.my_role() in ('admin','safety_director','safety','supervisor'))
 )
) with check (
 bucket_id<>'final-reports' or (
 ((storage.foldername(name))[2]<>'tool_director' or private.my_role() in ('admin','safety_director'))
 and ((storage.foldername(name))[2]<>'tool_qr' or private.my_role() in ('admin','safety_director','safety','supervisor'))
 )
);
