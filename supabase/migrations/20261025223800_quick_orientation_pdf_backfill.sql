-- Archive missing PDFs for completed quick orientations without altering their source records.
CREATE TABLE IF NOT EXISTS public.quick_orientation_pdf_backfill (
 orientation_id uuid PRIMARY KEY REFERENCES public.quick_safety_orientations(id) ON DELETE CASCADE,
 project_id uuid NOT NULL REFERENCES public.projects(id),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','working','completed','failed')),
 attempts integer NOT NULL DEFAULT 0,
 retry_after timestamptz NOT NULL DEFAULT now(),
 lock_token uuid,
 lock_until timestamptz,
 report_document_id uuid REFERENCES public.report_documents(id),
 last_error text,
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quick_orientation_backfill_pending_idx
 ON public.quick_orientation_pdf_backfill (retry_after,created_at)
 WHERE status IN ('pending','failed','working');
ALTER TABLE public.quick_orientation_pdf_backfill ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quick_orientation_pdf_backfill FROM public,anon,authenticated;
GRANT ALL ON public.quick_orientation_pdf_backfill TO service_role;
CREATE OR REPLACE FUNCTION public.enqueue_quick_orientation_archive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='final' THEN
  INSERT INTO public.quick_orientation_pdf_backfill (orientation_id,project_id)
  VALUES (NEW.id,NEW.project_id) ON CONFLICT (orientation_id) DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_quick_orientation_archive() FROM public,anon,authenticated;
DROP TRIGGER IF EXISTS quick_orientation_pdf_backfill_enqueue ON public.quick_safety_orientations;
CREATE TRIGGER quick_orientation_pdf_backfill_enqueue AFTER INSERT OR UPDATE OF status
ON public.quick_safety_orientations FOR EACH ROW
EXECUTE FUNCTION public.enqueue_quick_orientation_archive();
INSERT INTO public.quick_orientation_pdf_backfill (orientation_id,project_id)
SELECT q.id,q.project_id FROM public.quick_safety_orientations q
WHERE q.status='final'
ON CONFLICT (orientation_id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.claim_quick_orientation_pdf_backfill(p_limit int DEFAULT 3)
RETURNS SETOF public.quick_orientation_pdf_backfill
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 WITH claim AS (
  SELECT b.orientation_id FROM public.quick_orientation_pdf_backfill b
  WHERE (b.status IN ('pending','failed') OR (b.status='working' AND b.lock_until<now()))
   AND b.retry_after<=now() AND (b.lock_until IS NULL OR b.lock_until<now())
  ORDER BY b.created_at,b.orientation_id FOR UPDATE SKIP LOCKED
  LIMIT LEAST(GREATEST(p_limit,1),3)
 )
 UPDATE public.quick_orientation_pdf_backfill b SET
 status='working',attempts=b.attempts+1,lock_token=gen_random_uuid(),
 lock_until=now()+interval '3 minutes',updated_at=now()
 FROM claim WHERE b.orientation_id=claim.orientation_id
 RETURNING b.*;
$$;
REVOKE ALL ON FUNCTION public.claim_quick_orientation_pdf_backfill(integer) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_quick_orientation_pdf_backfill(integer) TO service_role;
