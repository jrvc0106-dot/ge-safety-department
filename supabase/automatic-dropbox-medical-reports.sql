-- Medical final PDFs have their own PRIVATE Storage bucket and delivery queue.
-- No medical PDF is placed in the standard final-reports bucket or public Data API.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('medical-final-pdfs','medical-final-pdfs',false,41943040,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=41943040,allowed_mime_types=array['application/pdf'];
create table if not exists public.dropbox_automatic_medical_reports (
 followup_id uuid primary key references public.employee_medical_followups(id) on delete cascade,
 project_id uuid not null references public.projects(id) on delete cascade,
 pdf_path text not null unique,
 status text not null default 'pending' check(status in ('pending','sending','completed','failed')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 lock_until timestamptz,
 lock_token uuid,
 remote_id text,
 remote_path text,
 last_error text,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint medical_pdf_owner_path check (
  pdf_path like project_id::text || '/%/' || followup_id::text || '/final.pdf'
 )
);
alter table public.dropbox_automatic_medical_reports enable row level security;
revoke all on public.dropbox_automatic_medical_reports from public,anon,authenticated;
grant all on public.dropbox_automatic_medical_reports to service_role;

-- Insert-only upload, never expose a read/list or public URL to ordinary users.
-- The server validates a PDF's bytes and the original medical record before queueing.
drop policy if exists "medical PDF upload authorized" on storage.objects;
create policy "medical PDF upload authorized" on storage.objects
for insert to authenticated with check (
 bucket_id='medical-final-pdfs'
 and (select private.my_role()) in ('admin','safety_director')
 and (storage.foldername(name))[2]=(select auth.uid())::text
 and name=(storage.foldername(name))[1]||'/'||(storage.foldername(name))[2]||'/'||(storage.foldername(name))[3]||'/final.pdf'
 and exists (
  select 1 from public.employee_medical_followups f
  where f.id::text=(storage.foldername(name))[3]
   and f.project_id::text=(storage.foldername(name))[1]
   and private.is_project_member(f.project_id)
 )
);

create or replace function public.claim_dropbox_automatic_medical_reports(p_limit integer default 1)
returns setof public.dropbox_automatic_medical_reports
language sql security invoker set search_path='' as $$
 with selected as (
  select followup_id from public.dropbox_automatic_medical_reports
  where (status in ('pending','failed') or (status='sending' and lock_until<now()))
   and next_attempt_at<=now() and (lock_until is null or lock_until<now())
  order by created_at,followup_id for update skip locked
  limit least(greatest(p_limit,1),2)
 )
 update public.dropbox_automatic_medical_reports q set
  status='sending',attempts=q.attempts+1,
  lock_until=now()+interval '3 minutes',lock_token=gen_random_uuid(),
  last_error=null,updated_at=now()
 from selected where q.followup_id=selected.followup_id returning q.*;
$$;
revoke all on function public.claim_dropbox_automatic_medical_reports(integer) from public,anon,authenticated;
grant execute on function public.claim_dropbox_automatic_medical_reports(integer) to service_role;
