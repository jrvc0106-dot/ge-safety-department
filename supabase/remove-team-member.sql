-- Keep historical authorship while permanently removing team access.
alter table public.profiles add column if not exists removed_at timestamptz;
create or replace function private.my_role() returns text
language sql stable security definer set search_path='' as $$
 select role from public.profiles where id=auth.uid() and removed_at is null
$$;
create or replace function private.remove_team_member(p_actor uuid,p_member uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.profiles where id=p_actor and role='admin' and removed_at is null for update;
 if not found then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_actor=p_member then raise exception 'You cannot remove your own account'; end if;
 perform 1 from public.profiles where id=p_member for update;
 if not found then raise exception 'Member not found'; end if;
 if exists(select 1 from public.profiles where id=p_member and role='admin') then
  raise exception 'Administrator accounts cannot be removed from Team';
 end if;
 update public.profiles set removed_at=coalesce(removed_at,now()),
 email=p_member::text||'@removed.invalid',role='worker',jobsite_id=null,
 notify_email=false,notify_sms=false,notify_app=false where id=p_member;
 delete from public.project_members where user_id=p_member;
 delete from public.user_app_presence where user_id=p_member;
 -- Revoke refresh sessions and block new logins before final Auth removal.
 update auth.users set banned_until='infinity'::timestamptz where id=p_member;
 delete from auth.sessions where user_id=p_member;
end $$;
revoke all on function private.remove_team_member(uuid,uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.remove_team_member(uuid,uuid) to service_role;
create or replace function public.remove_team_member(p_actor uuid,p_member uuid)
returns void language sql security invoker set search_path='' as $$
 select private.remove_team_member(p_actor,p_member)
$$;
revoke all on function public.remove_team_member(uuid,uuid) from public,anon,authenticated;
grant execute on function public.remove_team_member(uuid,uuid) to service_role;
