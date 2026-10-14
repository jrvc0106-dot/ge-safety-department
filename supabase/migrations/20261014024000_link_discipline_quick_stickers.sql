-- Link disciplinary actions to completed Quick Orientation registrations without
-- altering existing links to traditional Safety Orientations.
alter table public.quick_safety_orientations
  add constraint quick_safety_orientations_id_project_unique unique (id,project_id);
alter table public.safety_discipline
  add column if not exists employee_quick_orientation_id uuid;
alter table public.safety_discipline
  add constraint safety_discipline_quick_orientation_project_fkey
    foreign key (employee_quick_orientation_id,project_id)
    references public.quick_safety_orientations(id,project_id)
    on delete set null (employee_quick_orientation_id);
alter table public.safety_discipline
  add constraint safety_discipline_one_orientation_source_check
    check (employee_orientation_id is null or employee_quick_orientation_id is null);
create index if not exists safety_discipline_quick_orientation_idx
  on public.safety_discipline(employee_quick_orientation_id)
  where employee_quick_orientation_id is not null;
