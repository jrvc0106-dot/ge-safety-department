-- Cover high-volume project and uploader lookups for confidential medical documents.
create index if not exists employee_medical_followup_documents_project_id_idx
  on public.employee_medical_followup_documents(project_id);

create index if not exists employee_medical_followup_documents_uploaded_by_idx
  on public.employee_medical_followup_documents(uploaded_by);
