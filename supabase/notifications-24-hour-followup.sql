-- Consolidate assigned observation reminders into one per user/project/day.
create or replace function public.generate_observation_reminders()
returns integer language plpgsql set search_path='public' as $$
declare n integer;
begin
 insert into public.notifications(user_id,project_id,observation_id,type,title,message,priority)
 select a.user_id,a.project_id,null,'observation_reminder','Safety Observation Reminder',
        count(distinct a.observation_id)::text||' open safety observation(s) require correction or verification.',
        case when bool_or(a.high_priority) then 'critical' else 'high' end
 from (
   select distinct recipient as user_id,o.project_id,o.id as observation_id,(o.priority='high') as high_priority
   from public.observations o
   cross join lateral unnest(array[o.assigned_to,o.foreman_id,o.jobsite_safety_id]) recipient
   where o.status in ('open','pending_verification')
     and o.created_at<=now()-interval '24 hours' and recipient is not null
 ) a
 where not exists (
   select 1 from public.notifications previous
   where previous.user_id=a.user_id and previous.project_id=a.project_id
     and previous.type='observation_reminder'
     and previous.created_at>now()-interval '24 hours'
 )
 group by a.user_id,a.project_id;
 get diagnostics n=row_count;
 return n;
end $$;

-- A due item should create the correct message and should not fail if its observation was deleted.
create or replace function private.deliver_due_app_notifications()
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 with due as (
  select d.id,d.user_id,d.project_id,d.reference_id,d.event_type,
         o.id as existing_observation
  from public.notification_deliveries d
  left join public.observations o on o.id=d.reference_id
  where d.channel='app' and d.status='pending' and d.scheduled_for<=now()
  for update of d skip locked
 ), ins as (
  insert into public.notifications(user_id,project_id,observation_id,type,title,message,priority)
  select user_id,project_id,
   case when event_type in ('observation_digest','correction_digest') then existing_observation else null end,
   event_type,
   case event_type
     when 'incident_alert' then 'Incident / Accident Alert'
     when 'correction_digest' then 'Safety Corrections Update'
     when 'open_cases_digest' then 'Open Safety Cases'
     else 'Safety Observations Update' end,
   case event_type
     when 'incident_alert' then 'An incident or accident report is available for review.'
     when 'correction_digest' then 'Corrections were updated during the last 24 hours. Review the current project status.'
     when 'open_cases_digest' then 'Open safety cases need review and follow-up.'
     else 'New safety observations were created during the last 24 hours. Review the current project status.' end,
   case when event_type='incident_alert' then 'high' else 'normal' end
  from due returning 1
 )
 update public.notification_deliveries d set status='sent',provider='in_app',sent_at=now()
 where d.id in (select id from due);
 get diagnostics n=row_count;
 return n;
end $$;
