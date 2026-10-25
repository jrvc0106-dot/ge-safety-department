-- Automatic Dropbox archive cleanup. No source rows or medical PDFs are removed.
ALTER TABLE public.dropbox_automatic_reports
 ADD COLUMN IF NOT EXISTS cleanup_verified_at timestamptz,
 ADD COLUMN IF NOT EXISTS cleanup_verified_sha256 text,
 ADD COLUMN IF NOT EXISTS cleanup_archived_at timestamptz,
 ADD COLUMN IF NOT EXISTS cleanup_bytes_freed bigint,
 ADD COLUMN IF NOT EXISTS cleanup_original_path text,
 ADD COLUMN IF NOT EXISTS cleanup_error text,
 ADD COLUMN IF NOT EXISTS cleanup_lock_until timestamptz,
 ADD COLUMN IF NOT EXISTS cleanup_lock_token uuid,
 ADD COLUMN IF NOT EXISTS cleanup_hold boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.dropbox_cleanup_control (
 id integer PRIMARY KEY DEFAULT 1 CHECK (id=1),
 enabled boolean NOT NULL DEFAULT true,
 retention_days integer NOT NULL DEFAULT 7 CHECK(retention_days>=7),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.dropbox_cleanup_control (id,enabled,retention_days)
 VALUES(1,true,7) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.dropbox_cleanup_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dropbox_cleanup_control FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.dropbox_cleanup_control TO service_role;
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
    AND (r.cleanup_lock_until IS NULL OR r.cleanup_lock_until < now())
    AND (
      r.cleanup_verified_at IS NULL
      OR r.cleanup_verified_at + make_interval(days=>c.retention_days) <= now()
    )
  ORDER BY CASE WHEN r.cleanup_verified_at IS NULL THEN 1 ELSE 0 END,
   r.completed_at ASC NULLS LAST, r.report_id
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
COMMENT ON TABLE public.dropbox_cleanup_control IS '7+ day retention; only verified completed non-medical Dropbox copies can be cleaned, never source rows.';
