-- Link each disciplinary action to the exact Safety Orientation sticker record.
-- Existing rows remain NULL so historical warnings are not assigned by name alone.
alter table public.safety_discipline
  add column if not exists employee_orientation_id uuid,
  add column if not exists employee_sticker_number text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'safety_discipline_employee_orientation_id_fkey'
      and conrelid = 'public.safety_discipline'::regclass
  ) then
    alter table public.safety_discipline
      add constraint safety_discipline_employee_orientation_id_fkey
      foreign key (employee_orientation_id)
      references public.safety_orientations(id)
      on delete set null;
  end if;
end $$;

create index if not exists safety_discipline_employee_orientation_id_idx
  on public.safety_discipline (employee_orientation_id);
