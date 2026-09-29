-- One 24-hour cadence for all G&E safety notification types.
-- Existing notifications remain in the user's history; only future delivery changes.

drop trigger if exists notify_observation_created on public.observations;

create or replace function public.generate_observation_reminders()
returns integer language plpgsql set search_path='public' as $$
declare n integer;
begin
 insert into public.notifications(user_id,project_id,observation_id,type,title,message,priority)
 select distinct recipient,o.project_id,o.id,'observation_reminder','Safety Observation Reminder',
        coalesce(o.area,'Jobsite')||' — still requires correction / closure',
        case when o.priority='high' then 'critical' else 'high' end
 from public.observations o
 cross join lateral unnest(array[o.assigned_to,o.foreman_id,o.jobsite_safety_id]) recipient
 where o.status in ('open','pending_verification')
   and recipient is not null
   and o.created_at<=now()-interval '24 hours'
   and not exists (
     select 1 from public.notifications previous
     where previous.observation_id=o.id and previous.user_id=recipient
       and previous.type='observation_reminder'
       and previous.created_at>now()-interval '24 hours'
   );
 get diagnostics n=row_count;
 return n;
end $$;

create or replace function private.queue_project_notification(
 p_project uuid,p_event text,p_reference uuid,p_immediate boolean default false
) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.notification_deliveries(project_id,user_id,event_type,channel,reference_id,status,scheduled_for)
 select p_project,pm.user_id,p_event,c.channel,p_reference,'pending',now()+interval '24 hours'
 from public.project_members pm
 join public.profiles pr on pr.id=pm.user_id
 cross join lateral (values ('app',pr.notify_app),('email',pr.notify_email),('sms',pr.notify_sms)) c(channel,enabled)
 where pm.project_id=p_project and c.enabled
   and (c.channel<>'sms' or nullif(trim(pr.phone),'') is not null)
   and not exists (
     select 1 from public.notification_deliveries prior
     where prior.project_id=p_project and prior.user_id=pm.user_id
       and prior.event_type=p_event and prior.channel=c.channel
       and prior.created_at>now()-interval '24 hours'
   );
end $$;

create or replace function private.incident_notification_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform private.queue_project_notification(new.project_id,'incident_alert',new.id,false);
 return new;
end $$;

create or replace function private.queue_daily_open_case_notifications()
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 insert into public.notification_deliveries(project_id,user_id,event_type,channel,status,scheduled_for)
 select pm.project_id,pm.user_id,'open_cases_digest',c.channel,'pending',now()
 from public.project_members pm
 join public.profiles pr on pr.id=pm.user_id
 cross join lateral (values ('app',pr.notify_app),('email',pr.notify_email),('sms',pr.notify_sms)) c(channel,enabled)
 where c.enabled and (c.channel<>'sms' or nullif(trim(pr.phone),'') is not null)
 and (
   exists(select 1 from public.observations o where o.project_id=pm.project_id and coalesce(o.status,'open') not in ('closed','resolved'))
   or exists(select 1 from public.incident_reports i where i.project_id=pm.project_id and i.status in ('draft','final'))
 )
 and not exists (
   select 1 from public.notification_deliveries d
   where d.project_id=pm.project_id and d.user_id=pm.user_id
     and d.event_type='open_cases_digest' and d.channel=c.channel
     and (d.created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date
 );
 get diagnostics n=row_count;
 return n;
end $$;

-- A queued incident must no longer bypass the new 24-hour rule.
update public.notification_deliveries
set scheduled_for=greatest(scheduled_for,created_at+interval '24 hours')
where status='pending' and event_type<>'open_cases_digest';

select cron.unschedule('ge-observation-reminders-30m')
where exists(select 1 from cron.job where jobname='ge-observation-reminders-30m');
select cron.schedule('ge-observation-reminders-24h','0 12 * * *',
 'select public.generate_observation_reminders();');
