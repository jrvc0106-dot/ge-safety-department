-- Employee phone is optional in Quick Safety Orientation only.
-- Older reports remain valid without a telephone number.
alter table public.quick_safety_orientations
  add column if not exists employee_phone text
  check (employee_phone is null or char_length(employee_phone) <= 32);

comment on column public.quick_safety_orientations.employee_phone
  is 'Optional telephone number supplied for the employee in Quick Safety Orientation';
