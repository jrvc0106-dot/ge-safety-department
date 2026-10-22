-- G&E ONE: AI Findings are confidential. Aggregated counts stay visible
-- to existing Safety roles; only Admin and Safety Director can read insights.
-- Protect the JSON field at the SQL privileges layer, not merely in UI.
revoke select on public.safety_trend_results from public, anon, authenticated;
grant select (id, project_id, cadence, period_start, period_end, computed_at, metrics, ai_status)
 on public.safety_trend_results to authenticated;

-- Keep the privileged lookup outside schemas exposed by the Data API.
create schema if not exists ge_private;
revoke all on schema ge_private from public, anon, authenticated;
grant usage on schema ge_private to authenticated;

create or replace function ge_private.read_authorized_safety_ai_findings(p_result_id uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
 select r.insights
 from public.safety_trend_results r
 where r.id = p_result_id
   and (select auth.uid()) is not null
   and exists (
     select 1 from public.profiles p
     where p.id = (select auth.uid())
       and (
         p.role = 'admin'
         or (
           p.role = 'safety_director'
           and exists (
             select 1 from public.project_members m
             where m.user_id = p.id and m.project_id = r.project_id
           )
         )
       )
   )
 limit 1;
$$;
revoke all on function ge_private.read_authorized_safety_ai_findings(uuid)
 from public, anon, authenticated;
grant execute on function ge_private.read_authorized_safety_ai_findings(uuid) to authenticated;

-- Public endpoint runs as caller. It cannot circumvent the checks above.
create or replace function public.get_safety_ai_findings(p_result_id uuid)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
 select ge_private.read_authorized_safety_ai_findings(p_result_id);
$$;
revoke all on function public.get_safety_ai_findings(uuid) from public, anon;
grant execute on function public.get_safety_ai_findings(uuid) to authenticated;
