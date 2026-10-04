-- Restricted, append-only jobsite medical follow-up tracking.
-- Do not store diagnoses, clinical notes, prescriptions, or medical documents here.
create table public.employee_medical_followups (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 incident_id uuid not null references public.incident_reports(id) on delete restrict,
 created_by uuid not null references public.profiles(id),
 followup_number text not null unique,
 event_type text not null check (event_type in (
  'employee_contact','appointment_scheduled','work_status_received','restrictions_reviewed',
  'return_to_work_review','unable_to_reach','case_closed'
 )),
 event_date date not null,
 case_status text not null check (case_status in (
  'open','appointment_scheduled','awaiting_guidance','restrictions_active',
  'return_to_work_review','closed'
 )),
 work_status text not null check (work_status in (
  'pending','full_duty','temporary_restrictions','off_work','alternate_duties'
 )),
 next_followup_date date,
 clearance_received boolean not null default false,
 work_restrictions_summary text check (
  work_restrictions_summary is null or char_length(work_restrictions_summary)<=1000
 ),
 created_at timestamptz not null default now(),
 constraint medical_followup_restrictions_required check (
  work_status<>'temporary_restrictions' or nullif(btrim(work_restrictions_summary),'') is not null
 ),
 constraint medical_followup_closed_has_no_next_date check (
  case_status<>'closed' or next_followup_date is null
 ),
 constraint medical_followup_closed_event_matches_status check (
  (event_type='case_closed')=(case_status='closed')
 )
);

create index employee_medical_followups_project_created_idx
 on public.employee_medical_followups(project_id,created_at desc);
create index employee_medical_followups_incident_event_idx
 on public.employee_medical_followups(incident_id,event_date,created_at);
create index employee_medical_followups_created_by_idx
 on public.employee_medical_followups(created_by);

alter table public.employee_medical_followups enable row level security;
revoke all on public.employee_medical_followups from anon,authenticated;
grant select,insert on public.employee_medical_followups to authenticated;

create policy "medical followups restricted read" on public.employee_medical_followups
 for select to authenticated
 using (
  private.is_project_member(project_id)
  and (select private.my_role()) in ('admin','safety_director')
 );

create policy "medical followups restricted append" on public.employee_medical_followups
 for insert to authenticated
 with check (
  created_by=(select auth.uid())
  and private.is_project_member(project_id)
  and (select private.my_role()) in ('admin','safety_director')
  and exists (
   select 1 from public.incident_reports incident
   where incident.id=employee_medical_followups.incident_id
    and incident.project_id=employee_medical_followups.project_id
    and incident.incident_type in ('injury','illness')
    and nullif(btrim(incident.employee_name),'') is not null
  )
 );
