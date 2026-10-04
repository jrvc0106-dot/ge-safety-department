-- Private photo evidence for authorized employee medical follow-ups.
-- Documents are append-only, private objects; no public URLs or broad sharing.
create table public.employee_medical_followup_documents (
 id uuid primary key default gen_random_uuid(),
 followup_id uuid not null references public.employee_medical_followups(id) on delete cascade,
 project_id uuid not null references public.projects(id) on delete cascade,
 uploaded_by uuid not null references public.profiles(id),
 storage_path text not null unique,
 document_number smallint not null check (document_number between 1 and 12),
 mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
 size_bytes integer not null check (size_bytes between 1 and 10485760),
 created_at timestamptz not null default now(),
 constraint medical_document_path_matches_owner check (
  storage_path like project_id::text || '/' || uploaded_by::text || '/' || followup_id::text || '/%'
 )
);

create index employee_medical_followup_documents_record_idx
 on public.employee_medical_followup_documents(followup_id, document_number);

alter table public.employee_medical_followup_documents enable row level security;
revoke all on public.employee_medical_followup_documents from anon, authenticated;
grant select, insert on public.employee_medical_followup_documents to authenticated;

create policy "medical documents restricted read"
 on public.employee_medical_followup_documents for select to authenticated
 using (
  private.is_project_member(project_id)
  and (select private.my_role()) in ('admin','safety_director')
  and exists (
   select 1 from public.employee_medical_followups f
   where f.id=employee_medical_followup_documents.followup_id
    and f.project_id=employee_medical_followup_documents.project_id
  )
 );

create policy "medical documents restricted append"
 on public.employee_medical_followup_documents for insert to authenticated
 with check (
  uploaded_by=(select auth.uid())
  and private.is_project_member(project_id)
  and (select private.my_role()) in ('admin','safety_director')
  and exists (
   select 1 from public.employee_medical_followups f
   where f.id=employee_medical_followup_documents.followup_id
    and f.project_id=employee_medical_followup_documents.project_id
    and f.created_by=(select auth.uid())
  )
 );

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('employee-medical-documents','employee-medical-documents',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy "medical document photos upload authorized"
 on storage.objects for insert to authenticated
 with check (
  bucket_id='employee-medical-documents'
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and (select private.my_role()) in ('admin','safety_director')
  and exists (
   select 1 from public.employee_medical_followups f
   where f.id::text=(storage.foldername(name))[3]
    and f.project_id::text=(storage.foldername(name))[1]
    and f.created_by=(select auth.uid())
    and private.is_project_member(f.project_id)
  )
 );

create policy "medical document photos view authorized"
 on storage.objects for select to authenticated
 using (
  bucket_id='employee-medical-documents'
  and (select private.my_role()) in ('admin','safety_director')
  and exists (
   select 1 from public.employee_medical_followup_documents d
   join public.employee_medical_followups f on f.id=d.followup_id and f.project_id=d.project_id
   where d.storage_path=storage.objects.name
    and f.project_id::text=(storage.foldername(name))[1]
    and private.is_project_member(f.project_id)
  )
 );

create policy "medical document photos cleanup unlinked uploads"
 on storage.objects for delete to authenticated
 using (
  bucket_id='employee-medical-documents'
  and owner_id=(select auth.uid())::text
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and (select private.my_role()) in ('admin','safety_director')
  and exists (
   select 1 from public.employee_medical_followups f
   where f.id::text=(storage.foldername(name))[3]
    and f.project_id::text=(storage.foldername(name))[1]
    and f.created_by=(select auth.uid())
    and private.is_project_member(f.project_id)
  )
  and not exists (
   select 1 from public.employee_medical_followup_documents d
   where d.storage_path=storage.objects.name
  )
 );
