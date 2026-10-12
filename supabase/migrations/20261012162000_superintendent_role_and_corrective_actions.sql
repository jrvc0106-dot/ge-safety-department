-- Add a distinct Superintendent role and grant it operational corrective-action access.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin','safety_director','safety','superintendent','supervisor','worker'));

create or replace function private.can_submit_correction(o uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.observations
    where id = o
      and private.is_project_member(project_id)
      and status <> 'closed'
      and (
        assigned_to = auth.uid()
        or private.my_role() in ('admin','safety_director','safety','supervisor','superintendent')
      )
  )
$function$;
revoke all on function private.can_submit_correction(uuid) from public, anon;
grant execute on function private.can_submit_correction(uuid) to authenticated;

create or replace function private.admin_update_member_profile(
  p_member_id uuid,
  p_name text,
  p_position text,
  p_role text
)
returns table(id uuid, name text, "position" text, role text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  clean_name text := regexp_replace(trim(coalesce(p_name,'')), '[[:space:]]+', ' ', 'g');
  clean_position text := trim(coalesce(p_position,''));
  clean_role text := trim(coalesce(p_role,''));
  existing_role text;
begin
  if auth.uid() is null or private.my_role() is distinct from 'admin' then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  if clean_name='' or length(clean_name)>120 or length(clean_position)>120 then
    raise exception 'Name is required; name and position must be 120 characters or fewer' using errcode='22023';
  end if;
  if clean_role not in ('admin','safety_director','safety','superintendent','supervisor','worker') then
    raise exception 'A valid team role is required' using errcode='22023';
  end if;

  select p.role into existing_role
  from public.profiles p
  where p.id=p_member_id
  for update;
  if not found then
    raise exception 'Member not found' using errcode='P0002';
  end if;
  if (existing_role='admin') is distinct from (clean_role='admin') then
    raise exception 'Administrator role changes require a separate protected process' using errcode='42501';
  end if;
  if p_member_id=auth.uid() and clean_role is distinct from existing_role then
    raise exception 'Administrators cannot change their own role' using errcode='42501';
  end if;

  return query
  update public.profiles p
  set name=clean_name,
      first_name=split_part(clean_name,' ',1),
      last_name=case when strpos(clean_name,' ')>0 then substr(clean_name,strpos(clean_name,' ')+1) else '' end,
      position=nullif(clean_position,''),
      role=clean_role,
      updated_at=now()
  where p.id=p_member_id
  returning p.id,p.name,p.position,p.role;
end
$function$;
revoke all on function private.admin_update_member_profile(uuid,text,text,text) from public, anon;
grant execute on function private.admin_update_member_profile(uuid,text,text,text) to authenticated;

create or replace function public.admin_update_member_profile(
  p_member_id uuid,
  p_name text,
  p_position text,
  p_role text
)
returns table(id uuid, name text, "position" text, role text)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.admin_update_member_profile($1,$2,$3,$4)
$function$;
revoke all on function public.admin_update_member_profile(uuid,text,text,text) from public, anon;
grant execute on function public.admin_update_member_profile(uuid,text,text,text) to authenticated;
