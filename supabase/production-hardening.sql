-- Production hardening and schema synchronization patch.
-- Safe to apply after supabase/schema.sql / historical project migrations.

alter table public.profiles add column if not exists position text, add column if not exists avatar_path text, add column if not exists first_name text, add column if not exists last_name text, add column if not exists jobsite_id uuid references public.projects(id) on delete set null, add column if not exists updated_at timestamptz not null default now(), add column if not exists bio text;
alter table public.safety_discipline add column if not exists incident_location text, add column if not exists company_rule text, add column if not exists osha_reference text, add column if not exists hazard_observed text, add column if not exists immediate_action text, add column if not exists follow_up_required boolean not null default false, add column if not exists follow_up_notes text, add column if not exists supervisor_name text, add column if not exists employee_acknowledged boolean not null default false;

create table if not exists public.user_app_presence(user_id uuid primary key references public.profiles(id) on delete cascade,last_seen_at timestamptz not null default now(),latitude double precision,longitude double precision,location_accuracy_m double precision,location_updated_at timestamptz,updated_at timestamptz not null default now());
alter table public.user_app_presence enable row level security;
grant select,insert,update,delete on public.user_app_presence to authenticated;
drop policy if exists "users manage own app presence" on public.user_app_presence;
drop policy if exists "admins read team app presence" on public.user_app_presence;
drop policy if exists "users insert own app presence" on public.user_app_presence;
drop policy if exists "users update own app presence" on public.user_app_presence;
drop policy if exists "users delete own app presence" on public.user_app_presence;
drop policy if exists "authorized read app presence" on public.user_app_presence;
create policy "users insert own app presence" on public.user_app_presence for insert to authenticated with check(user_id=(select auth.uid()));
create policy "users update own app presence" on public.user_app_presence for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "users delete own app presence" on public.user_app_presence for delete to authenticated using(user_id=(select auth.uid()));
create policy "authorized read app presence" on public.user_app_presence for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

drop policy if exists "authorized users create safety walks" on public.daily_safety_walks;
create policy "authorized users create safety walks" on public.daily_safety_walks for insert to authenticated with check(created_by=(select auth.uid()) and private.is_project_member(project_id) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','safety_director','safety','supervisor')));
drop policy if exists "project members view safety walks" on public.daily_safety_walks;
create policy "project members view safety walks" on public.daily_safety_walks for select to authenticated using(private.is_project_member(project_id));
drop policy if exists "project members view safety walk items" on public.daily_safety_walk_items;
create policy "project members view safety walk items" on public.daily_safety_walk_items for select to authenticated using(exists(select 1 from public.daily_safety_walks w where w.id=walk_id and private.is_project_member(w.project_id)));
drop policy if exists "project members view safety walk photos" on public.daily_safety_walk_photos;
create policy "project members view safety walk photos" on public.daily_safety_walk_photos for select to authenticated using(exists(select 1 from public.daily_safety_walk_items i join public.daily_safety_walks w on w.id=i.walk_id where i.id=item_id and private.is_project_member(w.project_id)));
drop policy if exists "walk creator deletes failed walk" on public.daily_safety_walks;
create policy "walk creator deletes failed walk" on public.daily_safety_walks for delete to authenticated using(created_by=(select auth.uid()));

drop policy if exists "discipline_insert_safety" on public.safety_discipline;
create policy "discipline_insert_safety" on public.safety_discipline for insert to authenticated with check(created_by=(select auth.uid()) and private.is_project_member(project_id) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','safety_director','safety')));
drop policy if exists "discipline_select_authorized" on public.safety_discipline;
create policy "discipline_select_authorized" on public.safety_discipline for select to authenticated using(employee_id=(select auth.uid()) or created_by=(select auth.uid()) or (private.is_project_member(project_id) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','safety_director','safety'))));
drop policy if exists "discipline_update_safety" on public.safety_discipline;
create policy "discipline_update_safety" on public.safety_discipline for update to authenticated using(private.is_project_member(project_id) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','safety_director','safety'))) with check(private.is_project_member(project_id) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','safety_director','safety')));
drop policy if exists "discipline creator deletes failed record" on public.safety_discipline;
create policy "discipline creator deletes failed record" on public.safety_discipline for delete to authenticated using(created_by=(select auth.uid()));

drop policy if exists "creator deletes incomplete observation" on public.observations;
create policy "creator deletes incomplete observation" on public.observations for delete to authenticated using(created_by=(select auth.uid()) and status='open' and not exists(select 1 from public.corrective_actions a where a.observation_id=observations.id));
drop policy if exists "uploader deletes own observation photo" on public.observation_photos;
create policy "uploader deletes own observation photo" on public.observation_photos for delete to authenticated using(uploaded_by=(select auth.uid()) and exists(select 1 from public.observations o where o.id=observation_id and o.status='open'));
drop policy if exists "author deletes own open correction" on public.corrective_actions;
create policy "author deletes own open correction" on public.corrective_actions for delete to authenticated using(created_by=(select auth.uid()) and exists(select 1 from public.observations o where o.id=observation_id and o.status='open'));

drop policy if exists "users log report events" on public.report_document_events;
create policy "users log report events" on public.report_document_events for insert to authenticated with check(actor_id=(select auth.uid()) and exists(select 1 from public.report_documents d where d.id=report_document_id and private.is_project_member(d.project_id)));
drop policy if exists "safety roles update nonfinal reports" on public.report_documents;
create policy "safety roles update nonfinal reports" on public.report_documents for update to authenticated using(document_status<>'final' and private.is_project_member(project_id) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','safety_director','safety'))) with check(private.is_project_member(project_id) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','safety_director','safety')));

drop policy if exists "uploader deletes own observation object" on storage.objects;
create policy "uploader deletes own observation object" on storage.objects for delete to authenticated using(bucket_id='observation-photos' and owner_id=((select auth.uid()))::text);
drop policy if exists "creator deletes own walk image" on storage.objects;
create policy "creator deletes own walk image" on storage.objects for delete to authenticated using(bucket_id='daily-safety-walks' and owner_id=((select auth.uid()))::text);
drop policy if exists "creator deletes own discipline evidence" on storage.objects;
create policy "creator deletes own discipline evidence" on storage.objects for delete to authenticated using(bucket_id='discipline-evidence' and owner_id=((select auth.uid()))::text);
drop policy if exists "project members view final reports" on storage.objects;
create policy "project members view final reports" on storage.objects for select to authenticated using(bucket_id='final-reports' and private.is_project_member((storage.foldername(name))[1]::uuid));
drop policy if exists "authorized upload final reports" on storage.objects;
create policy "authorized upload final reports" on storage.objects for insert to authenticated with check(bucket_id='final-reports' and private.is_project_member((storage.foldername(name))[1]::uuid));
drop policy if exists "authorized delete own failed final reports" on storage.objects;
create policy "authorized delete own failed final reports" on storage.objects for delete to authenticated using(bucket_id='final-reports' and owner_id=((select auth.uid()))::text);
