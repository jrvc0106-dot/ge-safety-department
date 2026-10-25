CREATE TABLE IF NOT EXISTS public.safety_tool_pdf_backfill(
 tool_id uuid PRIMARY KEY REFERENCES public.safety_tool_records(id) ON DELETE CASCADE,
 project_id uuid NOT NULL REFERENCES public.projects(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','working','completed','failed')),
 attempts integer NOT NULL DEFAULT 0,retry_after timestamptz NOT NULL DEFAULT now(),
 lock_token uuid,lock_until timestamptz,
 report_document_id uuid REFERENCES public.report_documents(id),
 last_error text,completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.safety_tool_pdf_backfill ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.safety_tool_pdf_backfill FROM public,anon,authenticated;
GRANT ALL ON public.safety_tool_pdf_backfill TO service_role;
CREATE OR REPLACE FUNCTION public.enqueue_safety_tool_pdf()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.kind IN('toolbox','training','confined_space','director','safety_net') THEN
  INSERT INTO public.safety_tool_pdf_backfill(tool_id,project_id)
  VALUES(NEW.id,NEW.project_id) ON CONFLICT(tool_id) DO NOTHING;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.enqueue_safety_tool_pdf() FROM public,anon,authenticated;
DROP TRIGGER IF EXISTS ge_safety_tool_pdf_enqueue ON public.safety_tool_records;
CREATE TRIGGER ge_safety_tool_pdf_enqueue AFTER INSERT
ON public.safety_tool_records FOR EACH ROW EXECUTE FUNCTION public.enqueue_safety_tool_pdf();
INSERT INTO public.safety_tool_pdf_backfill(tool_id,project_id)
SELECT id,project_id FROM public.safety_tool_records
WHERE kind IN('toolbox','training','confined_space','director','safety_net')
ON CONFLICT(tool_id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.claim_safety_tool_pdf(p_limit integer DEFAULT 2)
RETURNS SETOF public.safety_tool_pdf_backfill
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 WITH pick AS (
 SELECT tool_id FROM public.safety_tool_pdf_backfill
 WHERE (status IN('pending','failed') OR (status='working' AND lock_until<now()))
 AND retry_after<=now() AND (lock_until IS NULL OR lock_until<now())
 ORDER BY created_at,tool_id FOR UPDATE SKIP LOCKED
 LIMIT LEAST(GREATEST(p_limit,1),3)
 )
 UPDATE public.safety_tool_pdf_backfill b SET
 status='working',attempts=attempts+1,lock_until=now()+interval '3 minutes',
 lock_token=gen_random_uuid(),updated_at=now()
 FROM pick WHERE b.tool_id=pick.tool_id RETURNING b.*;
$$;
REVOKE ALL ON FUNCTION public.claim_safety_tool_pdf(integer) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_safety_tool_pdf(integer) TO service_role;