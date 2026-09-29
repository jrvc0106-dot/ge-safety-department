create or replace function private.admin_update_member_profile(p_member_id uuid,p_name text,p_position text)
returns table(id uuid,name text,"position" text)
language plpgsql security definer set search_path='' as $$
declare clean_name text:=regexp_replace(trim(coalesce(p_name,'')),'[[:space:]]+',' ','g');
declare clean_position text:=trim(coalesce(p_position,''));
begin
 if auth.uid() is null or private.my_role() is distinct from 'admin' then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 if clean_name='' or length(clean_name)>120 or length(clean_position)>120 then
  raise exception 'Name is required; name and position must be 120 characters or fewer' using errcode='22023';
 end if;
 return query update public.profiles p
 set name=clean_name,first_name=split_part(clean_name,' ',1),
 last_name=case when strpos(clean_name,' ')>0 then substr(clean_name,strpos(clean_name,' ')+1) else '' end,
 position=nullif(clean_position,''),updated_at=now()
 where p.id=p_member_id returning p.id,p.name,p.position;
 if not found then raise exception 'Member not found' using errcode='P0002'; end if;
end $$;
revoke all on function private.admin_update_member_profile(uuid,text,text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.admin_update_member_profile(uuid,text,text) to authenticated;
create or replace function public.admin_update_member_profile(p_member_id uuid,p_name text,p_position text)
returns table(id uuid,name text,"position" text)
language sql security invoker set search_path='' as $$
 select * from private.admin_update_member_profile(p_member_id,p_name,p_position)
$$;
revoke all on function public.admin_update_member_profile(uuid,text,text) from public,anon;
grant execute on function public.admin_update_member_profile(uuid,text,text) to authenticated;
