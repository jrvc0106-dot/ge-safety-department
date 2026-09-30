-- Keep the PDF registry aligned with currentReportIdentity in src/main.js.
-- Apply atomically; retain all existing report types and add inventory.
BEGIN;
ALTER TABLE public.report_documents DROP CONSTRAINT report_documents_report_type_check;
ALTER TABLE public.report_documents ADD CONSTRAINT report_documents_report_type_check CHECK (report_type IN ('daily_report', 'daily_safety_walk', 'observation', 'correction', 'disciplinary_action', 'incident', 'near_miss', 'jha', 'toolbox', 'equipment_inspection', 'training', 'inventory'));
COMMIT;
