CREATE OR REPLACE FUNCTION public.claim_quick_orientation_backfill_project(
 p_project uuid,p_limit integer DEFAULT 3)
RETURNS SETOF public.quick_orientation_pdf_backfill
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 WITH chosen AS (
  SELECT b.orientation_id
  FROM public.quick_orientation_pdf_backfill b
  WHERE b.project_id=p_project
    AND (b.status IN ('pending','failed') OR (b.status='working' AND b.lock_until<now()))
    AND b.retry_after<=now() AND (b.lock_until IS NULL OR b.lock_until<now())
  ORDER BY b.created_at,b.orientation_id FOR UPDATE SKIP LOCKED
  LIMIT LEAST(GREATEST(p_limit,1),3)
 )
 UPDATE public.quick_orientation_pdf_backfill b SET
  status='working',attempts=b.attempts+1,lock_token=gen_random_uuid(),
  lock_until=now()+interval '3 minutes',updated_at=now()
 FROM chosen WHERE b.orientation_id=chosen.orientation_id
 RETURNING b.*;
$$;
REVOKE ALL ON FUNCTION public.claim_quick_orientation_backfill_project(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_quick_orientation_backfill_project(uuid,integer) TO service_role;
