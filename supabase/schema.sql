-- Run in Supabase SQL Editor. Add the first admin profile manually after creating its auth user.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, email text unique not null, name text not null, role text not null check(role in ('admin','safety_director','safety','supervisor','worker')));
create table public.projects (id uuid primary key default gen_random_uuid(), name text not null, address text, general_contractor text, status text not null default 'active' check(status in ('active','inactive')), created_at timestamptz not null default now());
create table public.project_members (project_id uuid not null references public.projects(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, primary key(project_id,user_id));
create table public.observations (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id), area text not null, category text not null, description text not null, priority text not null check(priority in ('low','medium','high')), status text not null default 'open' check(status in ('open','pending_verification','closed')), assigned_to uuid references public.profiles(id), created_by uuid not null references public.profiles(id), verified_by uuid references public.profiles(id), closed_at timestamptz, created_at timestamptz not null default now());
create table public.observation_photos (id uuid primary key default gen_random_uuid(), observation_id uuid not null references public.observations(id) on delete cascade, kind text not null check(kind in ('before','after')), path text unique not null, uploaded_by uuid not null references public.profiles(id), created_at timestamptz not null default now());
create table public.observation_views (observation_id uuid not null references public.observations(id) on delete cascade, user_id uuid not null references public.profiles(id), last_viewed_at timestamptz not null default now(), primary key(observation_id,user_id));
create table public.corrective_actions (id uuid primary key default gen_random_uuid(), observation_id uuid not null references public.observations(id) on delete cascade, comment text not null, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now());
create function private.new_user_profile() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.email is null or lower(split_part(new.email,'@',2)) <> 'geflcontractors.com' then raise exception 'Company email required'; end if;
 insert into public.profiles(id,email,name,role) values(new.id,new.email,coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(new.email,'@',1)),'worker');
 return new; end$$;
create trigger create_profile_after_signup after insert on auth.users for each row execute function private.new_user_profile();
create function private.my_role() returns text language sql stable security definer set search_path='' as $$select role from public.profiles where id=auth.uid()$$;
create function private.is_project_member(p uuid) returns boolean language sql stable security definer set search_path='' as $$select private.my_role()='admin' or exists(select 1 from public.project_members where project_id=p and user_id=auth.uid())$$;
create function private.is_teammate(other_id uuid) returns boolean language sql stable security definer set search_path='' as $$select private.my_role()='admin' or other_id=auth.uid() or exists(select 1 from public.project_members a join public.project_members b on a.project_id=b.project_id where a.user_id=auth.uid() and b.user_id=other_id)$$;
create function private.can_see_observation(o uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.observations where id=o and private.is_project_member(project_id))$$;
create function private.can_submit_correction(o uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.observations where id=o and private.is_project_member(project_id) and status<>'closed' and (assigned_to=auth.uid() or private.my_role() in ('admin','safety_director','safety','supervisor')))$$;
create function private.guard_observation_update() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (new.id,new.project_id,new.area,new.category,new.description,new.priority,new.assigned_to,new.created_by,new.created_at) is distinct from (old.id,old.project_id,old.area,old.category,old.description,old.priority,old.assigned_to,old.created_by,old.created_at) then raise exception 'Only status and verification fields may change'; end if;
 if old.status='closed' then raise exception 'Closed observations are immutable'; end if;
 if new.status='pending_verification' and old.status='open' and private.can_submit_correction(old.id) and new.verified_by is null and new.closed_at is null and exists(select 1 from public.observation_photos where observation_id=old.id and kind='after') then return new; end if;
 if new.status='closed' and old.status='pending_verification' and private.my_role() in ('admin','safety_director','safety') and new.verified_by=auth.uid() and new.closed_at is not null and exists(select 1 from public.observation_photos where observation_id=old.id and kind='after') then return new; end if;
 raise exception 'Invalid observation status transition'; end$$;
create trigger observation_update_guard before update on public.observations for each row execute function private.guard_observation_update();
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.observations enable row level security;
alter table public.observation_photos enable row level security;
alter table public.observation_views enable row level security;
alter table public.corrective_actions enable row level security;
-- Internal helpers can be used by RLS but cannot be called over the exposed Data API.
revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.my_role(), private.is_project_member(uuid), private.is_teammate(uuid), private.can_see_observation(uuid), private.can_submit_correction(uuid) to authenticated;

-- New projects may require explicit table privileges in addition to RLS.
grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.projects to authenticated;
grant select, insert, delete on public.project_members to authenticated;
grant select, insert, update on public.observations to authenticated;
grant select, insert on public.observation_photos to authenticated;
grant select, insert, update on public.observation_views to authenticated;
grant select, insert on public.corrective_actions to authenticated;

create policy "team profiles" on public.profiles for select to authenticated using (private.is_teammate(id));
create policy "member projects" on public.projects for select to authenticated using(private.is_project_member(id));
create policy "admin creates projects" on public.projects for insert to authenticated with check(private.my_role()='admin');
create policy "admin manages projects" on public.projects for update to authenticated using(private.my_role()='admin') with check(private.my_role()='admin');
create policy "memberships visible" on public.project_members for select to authenticated using(private.is_project_member(project_id));
create policy "admin assigns members" on public.project_members for insert to authenticated with check(private.my_role()='admin');
create policy "admin removes members" on public.project_members for delete to authenticated using(private.my_role()='admin');
create policy "project observations" on public.observations for select to authenticated using(private.is_project_member(project_id));
create policy "create observation" on public.observations for insert to authenticated with check(private.is_project_member(project_id) and created_by=auth.uid() and status='open' and verified_by is null and closed_at is null and (assigned_to is null or exists(select 1 from public.project_members where project_id=observations.project_id and user_id=assigned_to)));
create policy "advance observation" on public.observations for update to authenticated using(private.is_project_member(project_id)) with check(private.is_project_member(project_id));
create policy "view photos" on public.observation_photos for select to authenticated using(private.can_see_observation(observation_id));
create policy "upload photos" on public.observation_photos for insert to authenticated with check(uploaded_by=auth.uid() and ((kind='before' and exists(select 1 from public.observations where id=observation_id and created_by=auth.uid() and status='open')) or (kind='after' and private.can_submit_correction(observation_id))));
create policy "view receipts" on public.observation_views for select to authenticated using(private.can_see_observation(observation_id));
create policy "mark viewed" on public.observation_views for insert to authenticated with check(user_id=auth.uid() and private.can_see_observation(observation_id));
create policy "update view receipt" on public.observation_views for update to authenticated using(user_id=auth.uid() and private.can_see_observation(observation_id)) with check(user_id=auth.uid() and private.can_see_observation(observation_id));
create policy "read actions" on public.corrective_actions for select to authenticated using(private.can_see_observation(observation_id));
create policy "add actions" on public.corrective_actions for insert to authenticated with check(created_by=auth.uid() and private.can_submit_correction(observation_id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('observation-photos','observation-photos',false,10485760,array['image/jpeg','image/png','image/webp','image/heic']) on conflict(id) do nothing;
create policy "member downloads" on storage.objects for select to authenticated using(bucket_id='observation-photos' and private.can_see_observation(split_part(name,'/',1)::uuid));
create policy "member uploads" on storage.objects for insert to authenticated with check(bucket_id='observation-photos' and private.can_submit_correction(split_part(name,'/',1)::uuid) or bucket_id='observation-photos' and exists(select 1 from public.observations where id=split_part(name,'/',1)::uuid and created_by=auth.uid() and status='open'));
