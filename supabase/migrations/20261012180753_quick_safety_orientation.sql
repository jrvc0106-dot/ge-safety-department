-- Separate, compact Safety Orientation records. The existing safety_orientations
-- registry and its evidence workflow remain unchanged.
create table if not exists public.quick_safety_orientations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  employee_name text not null check (length(btrim(employee_name)) between 1 and 120),
  sticker_number text not null check (length(btrim(sticker_number)) between 1 and 64),
  employee_trade text not null check (length(btrim(employee_trade)) between 1 and 120),
  employee_company text not null check (length(btrim(employee_company)) between 1 and 120),
  orientation_at timestamptz not null default now(),
  hazards jsonb not null default '[]'::jsonb check (jsonb_typeof(hazards) = 'array'),
  acknowledged boolean not null default false check (acknowledged),
  acknowledgment_text text not null,
  approvals jsonb not null default '{}'::jsonb,
  photo_paths text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','final')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quick_safety_orientations_photo_limit check (cardinality(photo_paths) <= 4)
);

create index if not exists quick_safety_orientations_project_created_idx
  on public.quick_safety_orientations (project_id, created_at desc);
create index if not exists quick_safety_orientations_sticker_idx
  on public.quick_safety_orientations (project_id, upper(sticker_number));

alter table public.quick_safety_orientations enable row level security;
revoke all on public.quick_safety_orientations from anon, authenticated;
grant select, insert, update, delete on public.quick_safety_orientations to authenticated;

create policy "project members view quick safety orientations"
  on public.quick_safety_orientations for select to authenticated
  using (private.is_project_member(project_id));

create policy "safety roles create quick safety orientations"
  on public.quick_safety_orientations for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.is_project_member(project_id)
    and private.my_role() in ('admin','safety_director','safety','supervisor')
  );

create policy "creator completes quick safety orientation draft"
  on public.quick_safety_orientations for update to authenticated
  using (
    created_by = (select auth.uid()) and status = 'draft'
    and private.is_project_member(project_id)
    and private.my_role() in ('admin','safety_director','safety','supervisor')
  )
  with check (
    created_by = (select auth.uid()) and status = 'final'
    and acknowledged and cardinality(photo_paths) <= 4
    and private.is_project_member(project_id)
    and private.my_role() in ('admin','safety_director','safety','supervisor')
  );

create policy "creator removes incomplete quick orientation draft"
  on public.quick_safety_orientations for delete to authenticated
  using (created_by = (select auth.uid()) and status = 'draft');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quick-orientation-photos','quick-orientation-photos',false,10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

create policy "project safety roles upload quick orientation photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'quick-orientation-photos'
    and exists (
      select 1 from public.quick_safety_orientations q
      where q.id = (storage.foldername(name))[3]::uuid
        and q.project_id = (storage.foldername(name))[1]::uuid
        and q.created_by = (select auth.uid())
        and q.status = 'draft'
        and private.is_project_member(q.project_id)
        and private.my_role() in ('admin','safety_director','safety','supervisor')
    )
  );

create policy "project members view quick orientation photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'quick-orientation-photos'
    and exists (
      select 1 from public.quick_safety_orientations q
      where q.project_id = (storage.foldername(name))[1]::uuid
        and q.id = (storage.foldername(name))[3]::uuid
        and q.photo_paths @> array[name]
        and private.is_project_member(q.project_id)
    )
  );

create policy "creator deletes quick orientation photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'quick-orientation-photos'
    and owner_id = ((select auth.uid()))::text
  );
