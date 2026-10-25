-- Allows the authenticated GE ONE worker to prioritize one project's missing quick-orientation PDFs.
-- Keeps ordinary chronological/medical backup schedules and existing queue data intact.
CREATE OR REPLACE FUNCTION public.claim_dropbox_quick_project(p_project uuid,p_limit integer DEFAULT 2)
RETURNS SETOF public.dropbox_automatic_reports
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 WITH eligible AS (
  SELECT queue.report_id FROM public.dropbox_automatic_reports queue
  JOIN public.report_documents d ON d.id=queue.report_id
  JOIN public.quick_safety_orientations q ON q.id=d.source_id AND q.project_id=p_project
  WHERE queue.project_id=p_project AND d.report_type='training'
    AND d.document_status='final' AND d.pdf_path IS NOT NULL
    AND (queue.status IN ('pending','failed') OR (queue.status='sending' AND queue.lock_until<now()))
    AND queue.next_attempt_at<=now() AND (queue.lock_until IS NULL OR queue.lock_until<now())
  ORDER BY q.orientation_at,queue.report_id FOR UPDATE OF queue SKIP LOCKED
  LIMIT LEAST(GREATEST(p_limit,1),3)
 )
 UPDATE public.dropbox_automatic_reports queue SET
  status='sending',attempts=queue.attempts+1,
  lock_until=now()+interval '3 minutes',lock_token=gen_random_uuid(),
  updated_at=now(),last_error=NULL
 FROM eligible WHERE queue.report_id=eligible.report_id
 RETURNING queue.*;
$$;
REVOKE ALL ON FUNCTION public.claim_dropbox_quick_project(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_dropbox_quick_project(uuid,integer) TO service_role;
