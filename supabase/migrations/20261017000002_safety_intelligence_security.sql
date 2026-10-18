-- Fix inherited default EXECUTE grants flagged by Supabase Security Advisor.
revoke execute on function public.initialize_project_safety_trends() from public,anon,authenticated;
-- Automatically enroll a previously inactive jobsite when the Admin activates it.
drop trigger if exists initialize_project_safety_trends on public.projects;
create trigger initialize_project_safety_trends
 after insert or update of status on public.projects
 for each row execute function public.initialize_project_safety_trends();
