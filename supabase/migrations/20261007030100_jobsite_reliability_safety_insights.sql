-- Field reliability, correction review, medical PDF audit, and device performance events.
-- All access stays project-scoped and row-level security remains enabled.

alter table public.corrective_actions
  add column if not exists assigned_to uuid references public.profiles(id),
  add column if not exists due_date date,
  add column if not exists status text not null default 'pending_review',
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

alter table public.corrective_actions
  add constraint corrective_actions_status_check
    check (status in ('pending_review','approved','returned')),
  add constraint corrective_actions_review_state_check
    check (
      (status='pending_review' and reviewed_by is null and reviewed_at is null)
      or
      (status in ('approved','returned') and reviewed_by is not null and reviewed_at is not null)
    ),
  add constraint corrective_actions_return_note_check
    check (status<>'returned' or nullif(btrim(review_note),'') is not null),
  add constraint corrective_actions_review_note_length_check
    check (review_note is null or char_length(review_note)<=1000);

create index if not exists corrective_actions_due_assignee_idx
  on public.corrective_actions(assigned_to,due_date)
  where status='pending_review';

drop policy if exists "add actions" on public.corrective_actions;
create policy "add actions"
  on public.corrective_actions for insert to authenticated
  with check (
    created_by=(select auth.uid())
    and private.can_submit_correction(observation_id)
    and (
      assigned_to is null
      or exists (
        select 1
        from public.observations o
        join public.project_members pm on pm.project_id=o.project_id
        where o.id=corrective_actions.observation_id
          and pm.user_id=corrective_actions.assigned_to
      )
    )
  );

revoke update on public.corrective_actions from authenticated;
grant update(status,reviewed_by,reviewed_at,review_note) on public.corrective_actions to authenticated;
create policy "review corrective action"
  on public.corrective_actions for update to authenticated
  using (
    status='pending_review'
    and private.can_see_observation(observation_id)
    and (select private.my_role()) in ('admin','safety_director','safety')
  )
  with check (
    status in ('approved','returned')
    and reviewed_by=(select auth.uid())
    and reviewed_at is not null
    and private.can_see_observation(observation_id)
    and (select private.my_role()) in ('admin','safety_director','safety')
  );

create or replace function private.guard_observation_update()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
 if (new.id,new.project_id,new.area,new.category,new.description,new.priority,new.assigned_to,new.created_by,new.created_at)
    is distinct from
    (old.id,old.project_id,old.area,old.category,old.description,old.priority,old.assigned_to,old.created_by,old.created_at)
 then raise exception 'Only status and verification fields may change'; end if;
 if old.status='closed' then raise exception 'Closed observations are immutable'; end if;
 if new.status='pending_verification' and old.status='open'
    and private.can_submit_correction(old.id)
    and new.verified_by is null and new.closed_at is null
    and exists(select 1 from public.observation_photos where observation_id=old.id and kind='after')
 then return new; end if;
 if new.status='closed' and old.status='pending_verification'
    and private.my_role() in ('admin','safety_director','safety')
    and new.verified_by=auth.uid() and new.closed_at is not null
    and exists(select 1 from public.observation_photos where observation_id=old.id and kind='after')
 then return new; end if;
 if new.status='open' and old.status='pending_verification'
    and private.my_role() in ('admin','safety_director','safety')
    and new.verified_by is null and new.closed_at is null
    and exists(
      select 1 from public.corrective_actions
      where observation_id=old.id and status='returned' and reviewed_by=auth.uid()
    )
 then return new; end if;
 raise exception 'Invalid observation status transition';
end
$function$;

create or replace function public.review_corrective_action(
  p_action_id uuid,
  p_decision text,
  p_review_note text default null
)
returns boolean
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_observation_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_decision not in ('approved','returned') then raise exception 'Invalid review decision'; end if;
  if p_decision='returned' and nullif(btrim(p_review_note),'') is null then raise exception 'A return note is required'; end if;
  if char_length(coalesce(p_review_note,''))>1000 then raise exception 'Review note is too long'; end if;
  if (select private.my_role()) not in ('admin','safety_director','safety') then raise exception 'Review access denied'; end if;

  select observation_id into v_observation_id
  from public.corrective_actions
  where id=p_action_id and status='pending_review';

  if v_observation_id is null then raise exception 'Corrective action is no longer awaiting review'; end if;

  update public.corrective_actions
    set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(btrim(p_review_note),'')
    where id=p_action_id and status='pending_review';

  if not found then raise exception 'Corrective action review could not be recorded'; end if;

  if p_decision='approved' then
    update public.observations
      set status='closed',verified_by=auth.uid(),closed_at=now()
      where id=v_observation_id and status='pending_verification';
  else
    update public.observations
      set status='open',verified_by=null,closed_at=null
      where id=v_observation_id and status='pending_verification';
  end if;

  if not found then raise exception 'Observation status could not be updated'; end if;
  return true;
end
$function$;

revoke all on function public.review_corrective_action(uuid,text,text) from public,anon;
grant execute on function public.review_corrective_action(uuid,text,text) to authenticated;

create table public.employee_medical_pdf_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  followup_id uuid not null references public.employee_medical_followups(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  event_type text not null check (event_type in ('download_started','share_opened')),
  created_at timestamptz not null default now()
);
create index employee_medical_pdf_events_project_created_idx
  on public.employee_medical_pdf_events(project_id,created_at desc);
alter table public.employee_medical_pdf_events enable row level security;
revoke all on public.employee_medical_pdf_events from anon,authenticated;
grant select,insert on public.employee_medical_pdf_events to authenticated;
create policy "authorized medical PDF audit insert"
  on public.employee_medical_pdf_events for insert to authenticated
  with check (
    actor_id=(select auth.uid())
    and (select private.my_role()) in ('admin','safety_director','safety')
    and private.is_project_member(project_id)
    and exists (
      select 1 from public.employee_medical_followups f
      where f.id=followup_id and f.project_id=employee_medical_pdf_events.project_id
    )
  );
create policy "medical PDF audit read"
  on public.employee_medical_pdf_events for select to authenticated
  using (
    private.is_project_member(project_id)
    and (
      actor_id=(select auth.uid())
      or (select private.my_role()) in ('admin','safety_director')
    )
  );

create table public.app_performance_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  session_id uuid not null,
  page text not null check (char_length(page)<=80),
  metric text not null check (metric in ('lcp','inp','cls','fcp','load')),
  metric_value double precision not null check (metric_value>=0 and metric_value<=120000),
  device_category text not null check (device_category in ('tablet','phone','desktop','other')),
  created_at timestamptz not null default now(),
  unique(project_id,user_id,session_id,page,metric)
);
create index app_performance_events_project_created_idx
  on public.app_performance_events(project_id,created_at desc);
alter table public.app_performance_events enable row level security;
revoke all on public.app_performance_events from anon,authenticated;
grant select,insert on public.app_performance_events to authenticated;
create policy "project member performance event insert"
  on public.app_performance_events for insert to authenticated
  with check (
    user_id=(select auth.uid())
    and private.is_project_member(project_id)
  );
create policy "safety leadership performance event read"
  on public.app_performance_events for select to authenticated
  using (
    private.is_project_member(project_id)
    and (select private.my_role()) in ('admin','safety_director')
  );
