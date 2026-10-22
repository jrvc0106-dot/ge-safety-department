-- G&E ONE: global sticker-number verification for authorized Safety staff.
-- Never expose complete orientation, contact, certificate, signature, or discipline records.
-- The original jobsite-scoped RLS rules remain intact.
create schema if not exists ge_private;
grant usage on schema ge_private to authenticated;

create or replace function ge_private.lookup_safety_sticker(p_sticker_number text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
 select case
  when (select auth.uid()) is null
    or (select private.my_role()) not in ('admin','safety_director','safety')
    or p_sticker_number is null
    or length(pg_catalog.btrim(p_sticker_number)) not between 1 and 64
  then '[]'::jsonb
  else coalesce((
   select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
     'project_id',r.project_id,
     'project_name',r.project_name,
     'source_type',r.source_type,
     'sticker_number',r.sticker_number,
     'employee_name',r.employee_name,
     'employee_trade',r.employee_trade,
     'employee_company',r.employee_company
    ) order by r.recorded_at desc nulls last, r.project_name, r.source_type
   )
   from (
    select x.project_id,x.project_name,x.source_type,x.sticker_number,
           x.employee_name,x.employee_trade,x.employee_company,x.recorded_at
    from (
     select o.project_id,p.name as project_name,'standard'::text as source_type,
       o.sticker_number,o.employee_name,o.employee_position as employee_trade,
       o.employee_company,o.orientation_date::timestamptz as recorded_at
     from public.safety_orientations o join public.projects p on p.id=o.project_id
     where pg_catalog.upper(pg_catalog.btrim(o.sticker_number))=pg_catalog.upper(pg_catalog.btrim(p_sticker_number))
     union all
     select q.project_id,p.name,'quick'::text,
       q.sticker_number,q.employee_name,q.employee_trade,
       q.employee_company,q.orientation_at
     from public.quick_safety_orientations q join public.projects p on p.id=q.project_id
     where q.status='final'
       and pg_catalog.upper(pg_catalog.btrim(q.sticker_number))=pg_catalog.upper(pg_catalog.btrim(p_sticker_number))
    ) x
    order by x.recorded_at desc nulls last, x.project_name
    limit 30
   ) r
  ),'[]'::jsonb)
 end;
$function$;

revoke all on function ge_private.lookup_safety_sticker(text) from public,anon,authenticated;
grant execute on function ge_private.lookup_safety_sticker(text) to authenticated;

create or replace function public.verify_safety_sticker_global(p_sticker_number text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
 select ge_private.lookup_safety_sticker(p_sticker_number);
$function$;

revoke all on function public.verify_safety_sticker_global(text) from public,anon;
grant execute on function public.verify_safety_sticker_global(text) to authenticated;
