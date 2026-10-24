-- Copy finalized PDF archives to an administrator-authorized Dropbox account.
-- Queues are dormant until a Dropbox OAuth connection explicitly enables transfer.
create table if not exists public.dropbox_auto_control(
  id integer primary key default 1 check(id=1),
  enabled boolean not null default false,
  connection_id uuid references public.backup_cloud_connections(id) on delete set null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
create table if not exists public.dropbox_automatic_reports(
  report_id uuid primary key references public.report_documents(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','sending','completed','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lock_until timestamptz,
  lock_token uuid,
  remote_path text,
  remote_id text,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.dropbox_automatic_worker_key(
  id integer primary key default 1 check(id=1),
  secret text not null
);
insert into public.dropbox_automatic_worker_key(id,secret)
values(1,encode(gen_random_bytes(32),'hex')) on conflict (id) do nothing;
alter table public.dropbox_auto_control enable row level security;
alter table public.dropbox_automatic_reports enable row level security;
alter table public.dropbox_automatic_worker_key enable row level security;
revoke all on public.dropbox_auto_control,public.dropbox_automatic_reports,public.dropbox_automatic_worker_key from public,anon,authenticated;
grant all on public.dropbox_auto_control,public.dropbox_automatic_reports,public.dropbox_automatic_worker_key to service_role;

create or replace function public.enqueue_automatic_dropbox_pdf()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.document_status='final' and new.pdf_path is not null
    and new.report_type not like '%medical%' then
  insert into public.dropbox_automatic_reports(report_id,project_id)
   values(new.id,new.project_id) on conflict (report_id) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function public.enqueue_automatic_dropbox_pdf() from public,anon,authenticated;
drop trigger if exists ge_enqueue_final_pdf_for_dropbox on public.report_documents;
create trigger ge_enqueue_final_pdf_for_dropbox
after insert or update of document_status,pdf_path on public.report_documents
for each row execute function public.enqueue_automatic_dropbox_pdf();

-- Old finalized PDFs are queued, but NEVER copied until the account is authorized.
insert into public.dropbox_automatic_reports(report_id,project_id)
select id,project_id from public.report_documents
where document_status='final' and pdf_path is not null and report_type not like '%medical%'
on conflict (report_id) do nothing;

create or replace function public.claim_dropbox_automatic_reports(p_limit integer default 3)
returns setof public.dropbox_automatic_reports
language sql security invoker set search_path='' as $$
 with selected as (
  select report_id from public.dropbox_automatic_reports
  where (status in ('pending','failed') or (status='sending' and lock_until < now()))
    and next_attempt_at <= now()
    and (lock_until is null or lock_until < now())
  order by created_at,report_id
  for update skip locked
  limit least(greatest(p_limit,1),3)
 )
 update public.dropbox_automatic_reports d set
  status='sending', attempts=d.attempts+1,
  lock_until=now()+interval '3 minutes', lock_token=gen_random_uuid(),
  updated_at=now(),last_error=null
 from selected
 where d.report_id=selected.report_id
 returning d.*;
$$;
revoke all on function public.claim_dropbox_automatic_reports(integer) from public,anon,authenticated;
grant execute on function public.claim_dropbox_automatic_reports(integer) to service_role;

-- Execute an authenticated worker without ever placing its secret in application JS.
-- pg_net and pg_cron are already installed for G&E ONE.
select cron.schedule('ge-auto-dropbox-final-reports','*/5 * * * *',
 $cron$
 select net.http_post(
   url:='https://uubgrpdknxheflbkwkzf.supabase.co/functions/v1/auto-dropbox-reports',
   headers:=jsonb_build_object(
     'Content-Type','application/json',
     'x-ge-dropbox-worker',(select secret from public.dropbox_automatic_worker_key where id=1)
   ),
   body:='{"action":"process"}'::jsonb,
   timeout_milliseconds:=120000
 );
 $cron$
);
