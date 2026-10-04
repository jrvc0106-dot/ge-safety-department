-- Let Admin and Safety Director manage project memberships without extending
-- their report access beyond the projects they are assigned to themselves.
alter table public.profiles add column if not exists removed_at timestamptz;

create or replace function private.can_manage_project_access()
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select exists(
  select 1 from public.profiles p
  where p.id=(select auth.uid())
    and p.role in ('admin','safety_director')
    and p.removed_at is null
 )
$$;

revoke all on function private.can_manage_project_access() from public, anon;
grant execute on function private.can_manage_project_access() to authenticated;

drop policy if exists "admin assigns members" on public.project_members;
drop policy if exists "admin removes members" on public.project_members;
revoke insert, update, delete on public.project_members from authenticated;

create table if not exists public.project_access_audit (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references public.profiles(id) on delete set null,
 member_id uuid references public.profiles(id) on delete set null,
 previous_project_ids uuid[] not null default '{}'::uuid[],
 new_project_ids uuid[] not null default '{}'::uuid[],
 changed_at timestamptz not null default now()
);
create index if not exists project_access_audit_member_changed_idx
 on public.project_access_audit(member_id,changed_at desc);
alter table public.project_access_audit enable row level security;
revoke all on public.project_access_audit from public,anon,authenticated;
grant select on public.project_access_audit to authenticated;
drop policy if exists "project access managers view access history" on public.project_access_audit;
create policy "project access managers view access history"
 on public.project_access_audit for select to authenticated
 using(private.can_manage_project_access());

create or replace function public.get_project_access_data()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
 if not private.can_manage_project_access() then
  raise exception 'Project access management is restricted to Admin and Safety Director.' using errcode='42501';
 end if;
 return jsonb_build_object(
  'projects',coalesce((
   select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'status',p.status) order by p.name)
   from public.projects p
  ),'[]'::jsonb),
  'members',coalesce((
   select jsonb_agg(jsonb_build_object('id',p.id,'email',p.email,'name',p.name,'role',p.role,'position',p.position) order by p.name)
   from public.profiles p where p.removed_at is null
  ),'[]'::jsonb),
  'memberships',coalesce((
   select jsonb_agg(jsonb_build_object('user_id',m.user_id,'project_id',m.project_id) order by m.project_id,m.user_id)
   from public.project_members m
  ),'[]'::jsonb)
 );
end;
$$;
revoke all on function public.get_project_access_data() from public,anon;
grant execute on function public.get_project_access_data() to authenticated;

create or replace function public.set_member_project_access(p_member_id uuid,p_project_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 v_actor uuid := (select auth.uid());
 v_actor_role text;
 v_member_role text;
 v_old_ids uuid[];
 v_new_ids uuid[];
begin
 if not private.can_manage_project_access() then
  raise exception 'Project access management is restricted to Admin and Safety Director.' using errcode='42501';
 end if;

 select p.role into v_actor_role
 from public.profiles p where p.id=v_actor;

 select p.role into v_member_role
 from public.profiles p
 where p.id=p_member_id and p.removed_at is null
 for update;
 if not found then raise exception 'The team member is unavailable.' using errcode='P0002'; end if;
 if v_member_role='admin' and v_actor_role<>'admin' then
  raise exception 'Only an Admin can change another Admin account.' using errcode='42501';
 end if;

 if exists(
  select 1
  from unnest(coalesce(p_project_ids,'{}'::uuid[])) requested(project_id)
  left join public.projects project on project.id=requested.project_id
  where project.id is null
 ) then raise exception 'One or more selected projects are unavailable.' using errcode='22023'; end if;

 select coalesce(array_agg(m.project_id order by m.project_id),'{}'::uuid[])
 into v_old_ids from public.project_members m where m.user_id=p_member_id;
 select coalesce(array_agg(distinct requested.project_id order by requested.project_id),'{}'::uuid[])
 into v_new_ids from unnest(coalesce(p_project_ids,'{}'::uuid[])) requested(project_id);

 if v_old_ids=v_new_ids then
  return jsonb_build_object('ok',true,'changed',false,'member_id',p_member_id,'project_ids',v_new_ids);
 end if;

 delete from public.project_members where user_id=p_member_id;
 insert into public.project_members(project_id,user_id)
 select project_id,p_member_id from unnest(v_new_ids) selected(project_id);
 insert into public.project_access_audit(actor_id,member_id,previous_project_ids,new_project_ids)
 values(v_actor,p_member_id,v_old_ids,v_new_ids);

 return jsonb_build_object('ok',true,'changed',true,'member_id',p_member_id,'project_ids',v_new_ids);
end;
$$;

revoke all on function public.set_member_project_access(uuid,uuid[]) from public,anon;
grant execute on function public.set_member_project_access(uuid,uuid[]) to authenticated;
