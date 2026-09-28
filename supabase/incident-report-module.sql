-- Incident / Accident Investigation module — OSHA-aligned internal reporting
create table if not exists public.incident_reports(
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
 created_by uuid not null references public.profiles(id), report_number text not null unique,
 incident_type text not null check(incident_type in ('injury','illness','near_miss','property_damage','environmental')),
 severity text not null check(severity in ('low','moderate','serious','critical')), incident_at timestamptz not null, exact_location text not null,
 employee_name text,employee_job_title text,employee_company text,employee_address text,employee_dob date,date_hired date,supervisor_name text,
 what_happened text not null,activity_before text,injury_illness_description text,body_part text,object_substance text,medical_treatment text,treatment_facility text,
 emergency_room boolean not null default false,hospitalized_overnight boolean not null default false,death boolean not null default false,amputation boolean not null default false,
 loss_of_eye boolean not null default false,inpatient_hospitalization boolean not null default false,days_away boolean not null default false,restricted_work boolean not null default false,
 job_transfer boolean not null default false,medical_beyond_first_aid boolean not null default false,loss_of_consciousness boolean not null default false,significant_diagnosis boolean not null default false,
 work_related_review text not null default 'pending' check(work_related_review in ('pending','yes','no')),new_case_review text not null default 'pending' check(new_case_review in ('pending','yes','no')),
 recordability_review text not null default 'pending' check(recordability_review in ('pending','recordable','not_recordable')),severe_event_report_required boolean not null default false,
 severe_event_reported_at timestamptz,osha_case_number text,witnesses jsonb not null default '[]'::jsonb,immediate_actions text,root_causes text,contributing_factors text,
 corrective_actions text,employee_statement text,investigator_name text,status text not null default 'final' check(status in ('draft','final','closed')),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.incident_report_photos(id uuid primary key default gen_random_uuid(),incident_id uuid not null references public.incident_reports(id) on delete cascade,path text not null unique,caption text,uploaded_by uuid not null references public.profiles(id),created_at timestamptz not null default now());
create index if not exists incident_reports_project_id_idx on public.incident_reports(project_id);
create index if not exists incident_reports_created_by_idx on public.incident_reports(created_by);
create index if not exists incident_report_photos_incident_id_idx on public.incident_report_photos(incident_id);
create index if not exists incident_report_photos_uploaded_by_idx on public.incident_report_photos(uploaded_by);
alter table public.incident_reports enable row level security;alter table public.incident_report_photos enable row level security;
revoke all on public.incident_reports,public.incident_report_photos from anon,authenticated;
grant select,insert,update,delete on public.incident_reports to authenticated;grant select,insert,delete on public.incident_report_photos to authenticated;
create policy "incident project members view" on public.incident_reports for select to authenticated using(private.is_project_member(project_id));
create policy "safety roles create incidents" on public.incident_reports for insert to authenticated with check(created_by=(select auth.uid()) and private.is_project_member(project_id) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','safety_director','safety','supervisor')));
create policy "safety roles update incidents" on public.incident_reports for update to authenticated using(private.is_project_member(project_id) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','safety_director','safety'))) with check(private.is_project_member(project_id) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','safety_director','safety')));
create policy "creator deletes failed incident draft" on public.incident_reports for delete to authenticated using(created_by=(select auth.uid()) and status='draft');
create policy "incident photos view" on public.incident_report_photos for select to authenticated using(exists(select 1 from public.incident_reports r where r.id=incident_id and private.is_project_member(r.project_id)));
create policy "incident photos insert" on public.incident_report_photos for insert to authenticated with check(uploaded_by=(select auth.uid()) and exists(select 1 from public.incident_reports r where r.id=incident_id and r.created_by=(select auth.uid())));
create policy "incident photos delete own" on public.incident_report_photos for delete to authenticated using(uploaded_by=(select auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('incident-evidence','incident-evidence',false,10485760,array['image/jpeg','image/png','image/webp','image/heic','image/heif']) on conflict(id) do nothing;
create policy "incident evidence view" on storage.objects for select to authenticated using(bucket_id='incident-evidence' and exists(select 1 from public.incident_report_photos p join public.incident_reports r on r.id=p.incident_id where p.path=storage.objects.name and private.is_project_member(r.project_id)));
create policy "incident evidence upload" on storage.objects for insert to authenticated with check(bucket_id='incident-evidence' and exists(select 1 from public.incident_reports r where r.id=(split_part(storage.objects.name,'/',1))::uuid and r.created_by=(select auth.uid())));
create policy "incident evidence delete own" on storage.objects for delete to authenticated using(bucket_id='incident-evidence' and owner_id=((select auth.uid()))::text);
