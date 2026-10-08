alter table public.app_performance_events
 drop constraint app_performance_events_metric_check;
alter table public.app_performance_events
 add constraint app_performance_events_metric_check
 check (metric = any (array[
  'lcp'::text,'inp'::text,'cls'::text,'fcp'::text,'load'::text,
  'pdf_action'::text,'pdf_failure'::text,'pdf_cancelled'::text
 ]));
