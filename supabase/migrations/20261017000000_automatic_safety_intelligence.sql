-- G&E ONE Safety Intelligence: per-project automatic weekly/monthly summaries.
-- RLS: project members with safety responsibilities read; only admin/safety_director configure.
create table if not exists public.safety_trend_settings (
 project_id uuid primary key references public.projects(id) on delete cascade,
 cadence text not null default 'weekly' check (cadence in ('weekly','monthly')),
 enabled boolean not null default true,
 next_run_at timestamptz not null default now(),
 last_run_at timestamptz,
 updated_at timestamptz not null default now()
);
create table if not exists public.safety_trend_results (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 cadence text not null check (cadence in ('weekly','monthly')),
 period_start timestamptz not null,
 period_end timestamptz not null,
 computed_at timestamptz not null default now(),
 metrics jsonb not null default '{}'::jsonb,
 insights jsonb not null default '[]'::jsonb,
 ai_status text not null check (ai_status in ('complete','unavailable','insufficient')),
 constraint trend_result_window_order check (period_end > period_start)
);
create index if not exists idx_safety_trend_results_recent on public.safety_trend_results(project_id,computed_at desc);
create index if not exists idx_safety_trend_settings_due on public.safety_trend_settings(next_run_at) where enabled;
alter table public.safety_trend_settings enable row level security;
alter table public.safety_trend_results enable row level security;
create policy "authorized safety team reads trend settings" on public.safety_trend_settings for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and (p.role='admin' or (p.role in ('safety_director','safety','superintendent','supervisor') and exists(select 1 from public.project_members m where m.user_id=p.id and m.project_id=public.safety_trend_settings.project_id))))
);
create policy "admin and director update trend cadence" on public.safety_trend_settings for update to authenticated
 using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and (p.role='admin' or (p.role='safety_director' and exists(select 1 from public.project_members m where m.user_id=p.id and m.project_id=public.safety_trend_settings.project_id)))))
 with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and (p.role='admin' or (p.role='safety_director' and exists(select 1 from public.project_members m where m.user_id=p.id and m.project_id=public.safety_trend_settings.project_id)))));
create policy "authorized safety team reads trend results" on public.safety_trend_results for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and (p.role='admin' or (p.role in ('safety_director','safety','superintendent','supervisor') and exists(select 1 from public.project_members m where m.user_id=p.id and m.project_id=public.safety_trend_results.project_id))))
);
-- No browser insert/delete on trend settings/results. Only the service role generates results.
revoke all on public.safety_trend_settings from anon,authenticated;
revoke all on public.safety_trend_results from anon,authenticated;
grant select on public.safety_trend_settings,public.safety_trend_results to authenticated;
grant update(cadence,enabled,next_run_at,updated_at) on public.safety_trend_settings to authenticated;
insert into public.safety_trend_settings(project_id)
select id from public.projects where status='active'
on conflict(project_id) do nothing;
create or replace function public.initialize_project_safety_trends()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='active' then
  insert into public.safety_trend_settings(project_id) values (new.id) on conflict do nothing;
 end if;
 return new;
end;
$$;
revoke all on function public.initialize_project_safety_trends() from public;
drop trigger if exists initialize_project_safety_trends on public.projects;
create trigger initialize_project_safety_trends after insert on public.projects for each row execute function public.initialize_project_safety_trends();
-- Verify a secret passed by Supabase Cron to the Edge Function. No key is placed in app code.
create or replace function public.verify_safety_trend_job_token(p_token text)
returns boolean language sql security definer set search_path='' as $$
 select coalesce(length(p_token)>=32 and exists(
  select 1 from vault.decrypted_secrets where name='ge_safety_trends_job_token' and decrypted_secret=p_token
 ),false);
$$;
revoke all on function public.verify_safety_trend_job_token(text) from public,anon,authenticated;
grant execute on function public.verify_safety_trend_job_token(text) to service_role;
