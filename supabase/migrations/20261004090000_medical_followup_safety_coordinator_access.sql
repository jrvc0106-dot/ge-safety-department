-- Give project-assigned Safety Coordinators (role `safety`) access to medical
-- follow-ups and their private photos, retaining strict project membership.
drop policy "medical followups restricted read" on public.employee_medical_followups;
create policy "medical followups restricted read"
 on public.employee_medical_followups for select to authenticated
 using (
  private.is_project_member(project_id)
  and (select private.my_role()) in ('admin','safety_director','safety')
 );

drop policy "medical followups restricted append" on public.employee_medical_followups;
create policy "medical followups restricted append"
 on public.employee_medical_followups for insert to authenticated
 with check (
  created_by=(select auth.uid())
  and private.is_project_member(project_id)
  and (select private.my_role()) in ('admin','safety_director','safety')
  and nullif(btrim(employee_name),'') is not null
  and (
   incident_id is null
   or exists (
    select 1 from public.incident_reports incident
    where incident.id=employee_medical_followups.incident_id
     and incident.project_id=employee_medical_followups.project_id
     and incident.incident_type in ('injury','illness')
     and nullif(btrim(incident.employee_name),'') is not null
     and lower(btrim(incident.employee_name))=lower(btrim(employee_medical_followups.employee_name))
   )
  )
 );

drop policy "medical documents restricted read" on public.employee_medical_followup_documents;
create policy "medical documents restricted read"
 on public.employee_medical_followup_documents for select to authenticated
 using (
  private.is_project_member(project_id)
  and (select private.my_role()) in ('admin','safety_director','safety')
  and exists (
   select 1 from public.employee_medical_followups f
   where f.id=employee_medical_followup_documents.followup_id
    and f.project_id=employee_medical_followup_documents.project_id
  )
 );

drop policy "medical documents restricted append" on public.employee_medical_followup_documents;
create policy "medical documents restricted append"
 on public.employee_medical_followup_documents for insert to authenticated
 with check (
  uploaded_by=(select auth.uid())
  and private.is_project_member(project_id)
  and (select private.my_role()) in ('admin','safety_director','safety')
  and exists (
   select 1 from public.employee_medical_followups f
   where f.id=employee_medical_followup_documents.followup_id
    and f.project_id=employee_medical_followup_documents.project_id
    and f.created_by=(select auth.uid())
  )
 );

drop policy "medical document photos upload authorized" on storage.objects;
create policy "medical document photos upload authorized"
 on storage.objects for insert to authenticated
 with check (
  bucket_id='employee-medical-documents'
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and (select private.my_role()) in ('admin','safety_director','safety')
  and exists (
   select 1 from public.employee_medical_followups f
   where f.id::text=(storage.foldername(name))[3]
    and f.project_id::text=(storage.foldername(name))[1]
    and f.created_by=(select auth.uid())
    and private.is_project_member(f.project_id)
  )
 );

drop policy "medical document photos view authorized" on storage.objects;
create policy "medical document photos view authorized"
 on storage.objects for select to authenticated
 using (
  bucket_id='employee-medical-documents'
  and (select private.my_role()) in ('admin','safety_director','safety')
  and exists (
   select 1 from public.employee_medical_followup_documents d
   join public.employee_medical_followups f on f.id=d.followup_id and f.project_id=d.project_id
   where d.storage_path=storage.objects.name
    and f.project_id::text=(storage.foldername(name))[1]
    and private.is_project_member(f.project_id)
  )
 );

drop policy "medical document photos cleanup unlinked uploads" on storage.objects;
create policy "medical document photos cleanup unlinked uploads"
 on storage.objects for delete to authenticated
 using (
  bucket_id='employee-medical-documents'
  and owner_id=(select auth.uid())::text
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and (select private.my_role()) in ('admin','safety_director','safety')
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
