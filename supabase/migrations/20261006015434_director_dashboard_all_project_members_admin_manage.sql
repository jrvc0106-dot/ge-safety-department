drop policy if exists "tools read project and role" on public.safety_tool_records;
create policy "tools read project and role" on public.safety_tool_records
 for select to authenticated
 using (
  private.is_project_member(project_id)
  and (
   kind <> 'qr'
   or (select private.my_role()) in ('admin','safety_director','safety','supervisor')
  )
 );

drop policy if exists "tools create project and role" on public.safety_tool_records;
create policy "tools create project and role" on public.safety_tool_records
 for insert to authenticated
 with check (
  created_by=(select auth.uid())
  and private.is_project_member(project_id)
  and not exists (
   select 1 from jsonb_array_elements(safety_tool_records.photos) photo
   where photo.value->>'path' is null
      or not starts_with(
       photo.value->>'path',
       project_id::text || '/' || created_by::text || '/' || id::text || '/'
      )
  )
  and case kind
   when 'director' then (select private.my_role())='admin'
   when 'emergency' then (select private.my_role()) in ('admin','safety_director','safety')
   when 'hazard' then (select private.my_role()) in ('admin','safety_director','safety','supervisor','worker')
   else (select private.my_role()) in ('admin','safety_director','safety','supervisor')
  end
 );