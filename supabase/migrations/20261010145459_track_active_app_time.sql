alter table public.app_performance_events drop constraint app_performance_events_metric_check;
alter table public.app_performance_events add constraint app_performance_events_metric_check
 check (metric = any (array['lcp','inp','cls','fcp','load','pdf_action','pdf_failure','pdf_cancelled','active_time']::text[]));

create index if not exists app_performance_active_totals_idx
 on public.app_performance_events(project_id,user_id,device_category) where metric='active_time';

create or replace function public.app_active_time_totals(p_project_id uuid)
returns table(user_id uuid,device_category text,total_ms double precision)
language sql stable security invoker set search_path = ''
as $$
 select e.user_id,e.device_category,sum(e.metric_value)::double precision
 from public.app_performance_events e
 where e.project_id=p_project_id and e.metric='active_time' and (select auth.uid()) is not null
 group by e.user_id,e.device_category;
$$;
revoke all on function public.app_active_time_totals(uuid) from public,anon;
grant execute on function public.app_active_time_totals(uuid) to authenticated;
comment on function public.app_active_time_totals(uuid) is
 'Totals of foreground active-use intervals since instrumentation began, scoped by existing project RLS. Not elapsed login or payroll time.';
