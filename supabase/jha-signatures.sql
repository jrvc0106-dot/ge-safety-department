alter table public.daily_safety_walks add column if not exists approvals jsonb;
comment on column public.daily_safety_walks.approvals is 'JHA assigned Safety and jobsite Superintendent: editable names and normalized handwritten signature strokes captured when completing the report.';
notify pgrst, 'reload schema';
