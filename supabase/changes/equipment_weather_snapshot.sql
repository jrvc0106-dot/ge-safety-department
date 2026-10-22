-- Apply this additive database change before releasing the new Equipment Inspection client.
-- Existing reports remain unchanged; new weather snapshots are optional.
alter table public.equipment_inspections add column if not exists weather_snapshot jsonb;
