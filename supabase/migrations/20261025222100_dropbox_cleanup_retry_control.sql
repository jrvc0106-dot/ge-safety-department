ALTER TABLE public.dropbox_automatic_reports
 ADD COLUMN IF NOT EXISTS cleanup_retry_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.claim_dropbox_cleanup_candidate()
RETURNS SETOF public.dropbox_automatic_reports
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 WITH candidate AS (
  SELECT r.report_id FROM public.dropbox_automatic_reports r
  JOIN public.dropbox_cleanup_control c ON c.id=1
  WHERE c.enabled=true
    AND r.status='completed'
    AND r.cleanup_archived_at IS NULL
    AND r.cleanup_hold=false
    AND r.remote_id IS NOT NULL AND r.remote_path IS NOT NULL
    AND r.cleanup_retry_at <= now()
    AND (r.cleanup_lock_until IS NULL OR r.cleanup_lock_until < now())
    AND (
      r.cleanup_verified_at IS NULL
      OR r.cleanup_verified_at + make_interval(days=>c.retention_days) <= now()
    )
  ORDER BY CASE WHEN r.cleanup_verified_at IS NULL THEN 1 ELSE 0 END,
   r.completed_at ASC NULLS LAST,r.report_id
  FOR UPDATE OF r SKIP LOCKED
  LIMIT 1
 )
 UPDATE public.dropbox_automatic_reports r SET
  cleanup_lock_token=gen_random_uuid(),cleanup_lock_until=now()+interval '3 minutes',
  updated_at=now()
 FROM candidate WHERE r.report_id=candidate.report_id
 RETURNING r.*;
$$;
REVOKE ALL ON FUNCTION public.claim_dropbox_cleanup_candidate() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_dropbox_cleanup_candidate() TO service_role;
