-- Add covering indexes for foreign keys introduced by reliability features.
create index if not exists corrective_actions_reviewed_by_idx
  on public.corrective_actions(reviewed_by)
  where reviewed_by is not null;

create index if not exists employee_medical_pdf_events_actor_id_idx
  on public.employee_medical_pdf_events(actor_id);

create index if not exists employee_medical_pdf_events_followup_id_idx
  on public.employee_medical_pdf_events(followup_id);

create index if not exists app_performance_events_user_id_idx
  on public.app_performance_events(user_id);
