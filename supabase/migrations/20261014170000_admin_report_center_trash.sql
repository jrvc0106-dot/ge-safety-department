-- G&E ONE report center: admin-only trash and permanent removal FROM THE CENTER.
-- Original safety records, signatures and storage objects remain preserved.
create table if not exists public.report_center_trash (
 project_id uuid not null references public.projects(id) on delete cascade,
 report_kind text not null check (report_kind in ('daily','walk','discipline','correction','observation','incident','equipment','inventory','document')),
 report_id text not null check (length(report_id) between 1 and 150),
 report_title text not null default '' check (length(report_title)<=240),
 state text not null default 'trashed' check (state in ('trashed','active','permanent')),
 deleted_by uuid not null references auth.users(id),
 deleted_at timestamptz not null default now(),
 restored_by uuid references auth.users(id),
 restored_at timestamptz,
 permanently_removed_by uuid references auth.users(id),
 permanently_removed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key (project_id,report_kind,report_id)
);
create index if not exists report_center_trash_active_idx
 on public.report_center_trash(project_id,state,updated_at desc);
alter table public.report_center_trash enable row level security;
revoke all on public.report_center_trash from public,anon,authenticated;
grant select,insert,update on public.report_center_trash to authenticated;

create policy "project members view report center removal state" on public.report_center_trash
 for select to authenticated
 using (private.is_project_member(project_id) or private.my_role()='admin');
create policy "only active administrators mark reports in report center" on public.report_center_trash
 for insert to authenticated
 with check (private.my_role()='admin');
create policy "only active administrators manage center trash" on public.report_center_trash
 for update to authenticated
 using (private.my_role()='admin')
 with check (private.my_role()='admin');

create table if not exists public.report_center_trash_audit (
 id bigint generated always as identity primary key,
 project_id uuid not null,
 report_kind text not null,
 report_id text not null,
 report_title text not null,
 action text not null check(action in ('trashed','restored','permanent')),
 actor_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists report_center_trash_audit_project_idx
 on public.report_center_trash_audit(project_id,created_at desc);
alter table public.report_center_trash_audit enable row level security;
revoke all on public.report_center_trash_audit from public,anon,authenticated;
grant select on public.report_center_trash_audit to authenticated;
create policy "admin reads report center trash audit" on public.report_center_trash_audit
 for select to authenticated using (private.my_role()='admin');

create or replace function private.guard_report_center_trash()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or (select private.my_role()) is distinct from 'admin' then
  raise exception 'Only the G&E administrator may manage the report center trash' using errcode='42501';
 end if;
 if tg_op='INSERT' then
  if new.state<>'trashed' then raise exception 'A report must enter the trash before any other action';end if;
  new.deleted_by:=actor;
  new.deleted_at:=now();
  new.restored_by:=null;new.restored_at:=null;
  new.permanently_removed_by:=null;new.permanently_removed_at:=null;
 else
  if old.state='permanent' then raise exception 'A permanently removed report cannot be restored';end if;
  if new.project_id is distinct from old.project_id or new.report_kind is distinct from old.report_kind or new.report_id is distinct from old.report_id then
   raise exception 'A report identifier cannot be changed';
  end if;
  if new.state=old.state then raise exception 'No state change requested';end if;
  if new.state='trashed' then
   new.deleted_by:=actor;new.deleted_at:=now();
  elsif new.state='active' then
   if old.state<>'trashed' then raise exception 'Only trashed reports can be restored';end if;
   new.restored_by:=actor;new.restored_at:=now();
  elsif new.state='permanent' then
   if old.state<>'trashed' then raise exception 'Only trashed reports can be permanently removed';end if;
   new.permanently_removed_by:=actor;new.permanently_removed_at:=now();
  end if;
  new.report_title:=old.report_title;
 end if;
 new.updated_at:=now();
 return new;
end $$;

create or replace function private.audit_report_center_trash()
returns trigger
language plpgsql security definer set search_path=''
as $$
begin
 insert into public.report_center_trash_audit(project_id,report_kind,report_id,report_title,action,actor_id)
 values(new.project_id,new.report_kind,new.report_id,new.report_title,
  case when new.state='active' then 'restored' else new.state end,auth.uid());
 return new;
end $$;
drop trigger if exists ge_guard_report_center_trash on public.report_center_trash;
create trigger ge_guard_report_center_trash
 before insert or update on public.report_center_trash
 for each row execute function private.guard_report_center_trash();
drop trigger if exists ge_audit_report_center_trash on public.report_center_trash;
create trigger ge_audit_report_center_trash
 after insert or update on public.report_center_trash
 for each row execute function private.audit_report_center_trash();

revoke execute on function private.guard_report_center_trash() from public,anon,authenticated;
revoke execute on function private.audit_report_center_trash() from public,anon,authenticated;
