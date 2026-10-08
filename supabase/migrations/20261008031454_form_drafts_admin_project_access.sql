-- Keep draft access aligned with project access: administrators may work across projects,
-- while every draft must still belong to the signed-in user.
drop policy if exists "users insert own drafts" on public.form_drafts;
create policy "users insert own drafts"
on public.form_drafts
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_project_member(project_id)
);

drop policy if exists "users update own drafts" on public.form_drafts;
create policy "users update own drafts"
on public.form_drafts
for update
to authenticated
using (
  (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) = user_id
  and private.is_project_member(project_id)
);
