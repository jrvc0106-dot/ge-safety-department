CREATE TABLE IF NOT EXISTS public.final_source_pdf_backfill(
 source_type text NOT NULL CHECK(source_type IN('daily_safety_walk','equipment_inspection','incident','disciplinary_action','correction')),
 source_id uuid NOT NULL,
 project_id uuid NOT NULL REFERENCES public.projects(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','working','completed','failed')),
 attempts integer NOT NULL DEFAULT 0,retry_after timestamptz NOT NULL DEFAULT now(),
 lock_token uuid,lock_until timestamptz,
 report_document_id uuid REFERENCES public.report_documents(id),
 last_error text,completed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(source_type,source_id)
);
ALTER TABLE public.final_source_pdf_backfill ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.final_source_pdf_backfill FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.final_source_pdf_backfill TO service_role;
CREATE OR REPLACE FUNCTION public.enqueue_final_source_pdf()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_kind text;v_project uuid;v_finished boolean;
BEGIN
 v_kind:=CASE TG_TABLE_NAME
 WHEN 'daily_safety_walks' THEN 'daily_safety_walk'
 WHEN 'equipment_inspections' THEN 'equipment_inspection'
 WHEN 'incident_reports' THEN 'incident'
 WHEN 'safety_discipline' THEN 'disciplinary_action'
 WHEN 'corrective_actions' THEN 'correction' END;
 v_project:=CASE WHEN TG_TABLE_NAME='corrective_actions' THEN
  (SELECT o.project_id FROM public.observations o WHERE o.id=NEW.observation_id) ELSE NEW.project_id END;
 v_finished:=CASE
 WHEN TG_TABLE_NAME='daily_safety_walks' THEN NEW.approvals IS NOT NULL
 WHEN TG_TABLE_NAME='equipment_inspections' THEN NEW.status='final'
 WHEN TG_TABLE_NAME='incident_reports' THEN NEW.status='final'
 WHEN TG_TABLE_NAME='safety_discipline' THEN NEW.approvals IS NOT NULL
 WHEN TG_TABLE_NAME='corrective_actions' THEN NEW.status='closed'
 ELSE false END;
 IF v_finished AND v_project IS NOT NULL THEN
  INSERT INTO public.final_source_pdf_backfill(source_type,source_id,project_id)
  VALUES(v_kind,NEW.id,v_project) ON CONFLICT(source_type,source_id) DO NOTHING;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.enqueue_final_source_pdf() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS ge_walk_pdf_enqueue ON public.daily_safety_walks;
CREATE TRIGGER ge_walk_pdf_enqueue AFTER INSERT OR UPDATE OF approvals
ON public.daily_safety_walks FOR EACH ROW EXECUTE FUNCTION public.enqueue_final_source_pdf();
DROP TRIGGER IF EXISTS ge_equipment_pdf_enqueue ON public.equipment_inspections;
CREATE TRIGGER ge_equipment_pdf_enqueue AFTER INSERT OR UPDATE OF status
ON public.equipment_inspections FOR EACH ROW EXECUTE FUNCTION public.enqueue_final_source_pdf();
DROP TRIGGER IF EXISTS ge_incident_pdf_enqueue ON public.incident_reports;
CREATE TRIGGER ge_incident_pdf_enqueue AFTER INSERT OR UPDATE OF status
ON public.incident_reports FOR EACH ROW EXECUTE FUNCTION public.enqueue_final_source_pdf();
DROP TRIGGER IF EXISTS ge_discipline_pdf_enqueue ON public.safety_discipline;
CREATE TRIGGER ge_discipline_pdf_enqueue AFTER INSERT OR UPDATE OF approvals
ON public.safety_discipline FOR EACH ROW EXECUTE FUNCTION public.enqueue_final_source_pdf();
DROP TRIGGER IF EXISTS ge_correction_pdf_enqueue ON public.corrective_actions;
CREATE TRIGGER ge_correction_pdf_enqueue AFTER INSERT OR UPDATE OF status
ON public.corrective_actions FOR EACH ROW EXECUTE FUNCTION public.enqueue_final_source_pdf();
INSERT INTO public.final_source_pdf_backfill(source_type,source_id,project_id)
SELECT 'daily_safety_walk',id,project_id FROM public.daily_safety_walks WHERE approvals IS NOT NULL
UNION ALL SELECT 'equipment_inspection',id,project_id FROM public.equipment_inspections WHERE status='final'
UNION ALL SELECT 'incident',id,project_id FROM public.incident_reports WHERE status='final'
UNION ALL SELECT 'disciplinary_action',id,project_id FROM public.safety_discipline WHERE approvals IS NOT NULL
UNION ALL SELECT 'correction',c.id,o.project_id FROM public.corrective_actions c
JOIN public.observations o ON o.id=c.observation_id WHERE c.status='closed'
ON CONFLICT(source_type,source_id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.claim_final_source_pdf(p_limit integer DEFAULT 2)
RETURNS SETOF public.final_source_pdf_backfill
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 WITH pick AS (
  SELECT source_type,source_id FROM public.final_source_pdf_backfill
  WHERE (status IN('pending','failed') OR (status='working' AND lock_until<now()))
  AND retry_after<=now() AND (lock_until IS NULL OR lock_until<now())
  ORDER BY created_at,source_type,source_id FOR UPDATE SKIP LOCKED
  LIMIT LEAST(GREATEST(p_limit,1),3)
 )
 UPDATE public.final_source_pdf_backfill b SET status='working',attempts=b.attempts+1,
  lock_until=now()+interval '3 minutes',lock_token=gen_random_uuid(),updated_at=now()
 FROM pick WHERE b.source_type=pick.source_type AND b.source_id=pick.source_id RETURNING b.*;
$$;
REVOKE ALL ON FUNCTION public.claim_final_source_pdf(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_final_source_pdf(integer) TO service_role;