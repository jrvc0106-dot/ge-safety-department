-- Permit genuinely unanswered values without marking them safe, approved, or N/A.
BEGIN;
ALTER TABLE public.daily_safety_walk_items ALTER COLUMN status DROP NOT NULL;
ALTER TABLE public.equipment_inspections ALTER COLUMN overall_status DROP NOT NULL, ALTER COLUMN inspection_at DROP NOT NULL;
ALTER TABLE public.incident_reports ALTER COLUMN incident_at DROP NOT NULL;
ALTER TABLE public.inventory_items ALTER COLUMN quantity DROP NOT NULL;
COMMIT;
