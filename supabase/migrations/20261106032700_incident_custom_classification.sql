-- Incident / Accident custom classifications. Historical records remain unchanged.
alter table public.incident_reports
 add column if not exists incident_type_custom text;
alter table public.incident_reports
 drop constraint if exists incident_reports_incident_type_check;
alter table public.incident_reports
 add constraint incident_reports_incident_type_check
 check (incident_type in ('injury','illness','near_miss','property_damage','environmental','custom'));
alter table public.incident_reports
 add constraint incident_reports_custom_classification_check
 check (incident_type <> 'custom' or nullif(btrim(incident_type_custom),'') is not null);
comment on column public.incident_reports.incident_type_custom is
 'Human-entered classification when incident_type is custom. Original classification and incident history preserved.';
