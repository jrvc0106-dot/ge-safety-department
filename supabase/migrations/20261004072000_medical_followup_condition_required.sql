-- Every saved employee follow-up must contain a current employee-reported status.
alter table public.employee_medical_followups
 alter column current_condition_summary set not null;
