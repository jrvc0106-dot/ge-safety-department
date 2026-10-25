-- Generate missing Quick Safety Orientation PDFs from finalized source records.
-- Uses the same worker secret as Dropbox; no credentials in browser code.
SELECT cron.schedule('ge-quick-orientation-pdf-backfill','* * * * *',
 $cron$
 SELECT net.http_post(
  url:='https://uubgrpdknxheflbkwkzf.supabase.co/functions/v1/backfill-quick-orientation-pdfs',
  headers:=jsonb_build_object('Content-Type','application/json',
   'x-ge-dropbox-worker',(SELECT secret FROM public.dropbox_automatic_worker_key WHERE id=1)),
  body:='{"action":"process"}'::jsonb,
  timeout_milliseconds:=120000
 );
 $cron$
);
