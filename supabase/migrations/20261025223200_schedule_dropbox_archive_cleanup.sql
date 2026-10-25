-- Safe archival runs separately from the established Dropbox upload worker.
-- The worker uses a service-only random secret; it cannot be invoked anonymously.
SELECT cron.schedule('ge-dropbox-archive-cleanup','*/10 * * * *',
 $cron$
 SELECT net.http_post(
  url:='https://uubgrpdknxheflbkwkzf.supabase.co/functions/v1/dropbox-archive-cleanup',
  headers:=jsonb_build_object('Content-Type','application/json',
   'x-ge-dropbox-worker',(SELECT secret FROM public.dropbox_automatic_worker_key WHERE id=1)),
  body:='{"action":"process"}'::jsonb,
  timeout_milliseconds:=120000
 );
 $cron$
);
