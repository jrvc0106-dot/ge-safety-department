alter table public.observations
 add column if not exists due_date date;

create index if not exists observations_open_due_date_idx
 on public.observations(project_id,due_date)
 where status <> 'closed' and due_date is not null;

comment on column public.observations.due_date is
 'Optional action deadline for a safety observation; when assigned_to is set, the app requires this date before submission.';
