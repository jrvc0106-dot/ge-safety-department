-- Additive migration: incident_accident_mechanism_and_potential_outcome.
-- Existing reports, classifications, permissions and RLS remain unchanged.
alter table public.incident_reports
 add column if not exists accident_mechanism text,
 add column if not exists potential_outcome text;
comment on column public.incident_reports.accident_mechanism is 'Accident mechanism selected independently of event classification; nullable for existing reports.';
comment on column public.incident_reports.potential_outcome is 'Potential consequences documented during investigation, including near misses.';
