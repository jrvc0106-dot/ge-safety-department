-- Retire database helpers belonging only to the removed active-use feature.
-- Keep the existing historical event and metric allowlist; neither executes code.
-- Existing performance data, RLS policies and report tables remain unchanged.
drop function if exists public.app_active_time_totals(uuid);
drop index if exists public.app_performance_active_totals_idx;
