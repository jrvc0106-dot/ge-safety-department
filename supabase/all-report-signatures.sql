alter table public.observations add column if not exists approvals jsonb;
alter table public.corrective_actions add column if not exists approvals jsonb;
alter table public.safety_discipline add column if not exists approvals jsonb;
alter table public.equipment_inspections add column if not exists approvals jsonb;
alter table public.incident_reports add column if not exists approvals jsonb;
alter table public.inventory_items add column if not exists approvals jsonb;
alter table public.safety_orientations add column if not exists approvals jsonb;
create table if not exists public.aggregate_report_signatures (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 created_by uuid not null references public.profiles(id),
 report_kind text not null check (report_kind in ('daily','inventory')),
 snapshot_key text not null check (length(snapshot_key)=64),
 approvals jsonb not null default '{}'::jsonb check (jsonb_typeof(approvals)='object'),
 updated_at timestamptz not null default now(),
 unique(project_id,created_by,report_kind,snapshot_key)
);
alter table public.aggregate_report_signatures enable row level security;
grant select,insert,update on public.aggregate_report_signatures to authenticated;
create policy "members read aggregate signatures" on public.aggregate_report_signatures for select to authenticated using (private.is_project_member(project_id));
create policy "safety roles create own aggregate signatures" on public.aggregate_report_signatures for insert to authenticated with check (created_by=(select auth.uid()) and private.is_project_member(project_id) and private.my_role() in ('admin','safety_director','safety','supervisor'));
create policy "safety roles update own aggregate signatures" on public.aggregate_report_signatures for update to authenticated using (created_by=(select auth.uid()) and private.is_project_member(project_id) and private.my_role() in ('admin','safety_director','safety','supervisor')) with check (created_by=(select auth.uid()) and private.is_project_member(project_id) and private.my_role() in ('admin','safety_director','safety','supervisor'));
create index aggregate_report_signatures_creator_idx on public.aggregate_report_signatures(created_by);
notify pgrst, 'reload schema';
