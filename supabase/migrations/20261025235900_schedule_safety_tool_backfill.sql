SELECT cron.schedule('ge-safety-tool-pdf-backfill','* * * * *',
 $cron$
 SELECT net.http_post(
  url:='https://uubgrpdknxheflbkwkzf.supabase.co/functions/v1/backfill-safety-tool-pdfs',
  headers:=jsonb_build_object('Content-Type','application/json',
   'x-ge-dropbox-worker',(SELECT secret FROM public.dropbox_automatic_worker_key WHERE id=1)),
  body:='{"action":"process"}'::jsonb,timeout_milliseconds:=120000);
 $cron$
);