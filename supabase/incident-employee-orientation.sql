alter table public.incident_reports
  add column if not exists employee_orientation_snapshot jsonb;
comment on column public.incident_reports.employee_orientation_snapshot is
  'Safety Orientation employee record snapshot selected by sticker when documenting the incident.';
