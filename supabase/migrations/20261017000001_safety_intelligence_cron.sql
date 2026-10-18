-- One daily sweep checks each project's independent weekly/monthly due date.
-- Prerequisites: pg_net; Vault secrets ge_safety_trends_job_token,
-- ge_safety_trends_publishable_key, ge_safety_trends_project_url.
select cron.schedule('ge-safety-intelligence-daily','0 12 * * *',$job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='ge_safety_trends_project_url') || '/functions/v1/safety-trends-scheduler',
  headers := jsonb_build_object(
   'Content-Type','application/json',
   'apikey',(select decrypted_secret from vault.decrypted_secrets where name='ge_safety_trends_publishable_key'),
   'x-ge-cron-key',(select decrypted_secret from vault.decrypted_secrets where name='ge_safety_trends_job_token')
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 30000
 ) as request_id;
$job$);
