-- Adds one optional emergency-contact text field to Quick Safety Orientation.
-- Preserves existing orientations and their PDF reports.
alter table public.quick_safety_orientations add column if not exists emergency_contact text;
