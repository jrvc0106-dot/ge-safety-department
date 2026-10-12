-- Link each disciplinary action to the exact Safety Orientation sticker record.
-- Existing rows remain NULL so historical warnings are not assigned by name alone.
alter table public.safety_discipline
  add column if not exists employee_orientation_id uuid,
  add column if not exists employee_sticker_number text;

create unique index if not exists safety_orientations_id_project_id_unique
  on public.safety_orientations (id, project_id);

alter table public.safety_discipline
  drop constraint if exists safety_discipline_employee_orientation_id_fkey;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'safety_discipline_employee_orientation_project_fkey'
      and conrelid = 'public.safety_discipline'::regclass
  ) then
    alter table public.safety_discipline
      add constraint safety_discipline_employee_orientation_project_fkey
      foreign key (employee_orientation_id, project_id)
      references public.safety_orientations(id, project_id)
      on delete set null (employee_orientation_id);
  end if;
end $$;

drop index if exists public.safety_discipline_employee_orientation_id_idx;
create index if not exists safety_discipline_project_orientation_id_idx
  on public.safety_discipline (project_id, employee_orientation_id);
