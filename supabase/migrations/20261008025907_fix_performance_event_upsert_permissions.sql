-- Allow authenticated jobsite members to replace their own idempotent performance metrics.
-- Keep access scoped to the signed-in user and a project they can access.
grant update on table public.app_performance_events to authenticated;

create policy "users read own performance events"
on public.app_performance_events
for select
to authenticated
using (
  user_id = (select auth.uid())
  and private.is_project_member(project_id)
);

create policy "users update own performance events"
on public.app_performance_events
for update
to authenticated
using (
  user_id = (select auth.uid())
  and private.is_project_member(project_id)
)
with check (
  user_id = (select auth.uid())
  and private.is_project_member(project_id)
);
