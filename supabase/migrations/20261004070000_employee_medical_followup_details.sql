-- Expand confidential follow-ups so the module can be used directly by employee.
-- Keep each saved event append-only and retain optional linkage to an incident.
alter table public.employee_medical_followups
 add column employee_name text,
 add column last_appointment_date date,
 add column next_appointment_date date,
 add column current_condition_summary text,
 add column reported_medications text;

update public.employee_medical_followups followup
set employee_name = incident.employee_name
from public.incident_reports incident
where followup.incident_id = incident.id
 and followup.employee_name is null;

alter table public.employee_medical_followups
 alter column incident_id drop not null,
 alter column employee_name set not null,
 add constraint employee_medical_followups_employee_name_nonblank
  check (nullif(btrim(employee_name), '') is not null and char_length(employee_name) <= 150),
 add constraint employee_medical_followups_condition_length
  check (current_condition_summary is null or char_length(current_condition_summary) <= 1000),
 add constraint employee_medical_followups_medications_length
  check (reported_medications is null or char_length(reported_medications) <= 500);

create index employee_medical_followups_employee_timeline_idx
 on public.employee_medical_followups(project_id, employee_name, event_date, created_at);

drop policy "medical followups restricted append" on public.employee_medical_followups;
create policy "medical followups restricted append" on public.employee_medical_followups
 for insert to authenticated
 with check (
  created_by = (select auth.uid())
  and private.is_project_member(project_id)
  and (select private.my_role()) in ('admin', 'safety_director')
  and nullif(btrim(employee_name), '') is not null
  and (
   incident_id is null
   or exists (
    select 1
    from public.incident_reports incident
    where incident.id = employee_medical_followups.incident_id
     and incident.project_id = employee_medical_followups.project_id
     and incident.incident_type in ('injury', 'illness')
     and nullif(btrim(incident.employee_name), '') is not null
     and lower(btrim(incident.employee_name)) = lower(btrim(employee_medical_followups.employee_name))
   )
  )
 );
