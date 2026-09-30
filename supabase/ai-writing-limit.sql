create table if not exists private.ai_writing_limits(
 user_id uuid not null references public.profiles(id) on delete cascade,
 usage_day date not null,requests integer not null check(requests between 1 and 30),
 primary key(user_id,usage_day)
);
alter table private.ai_writing_limits enable row level security;
revoke all on private.ai_writing_limits from public,anon,authenticated;
create or replace function private.claim_ai_writing_request(p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare allowed boolean;
begin
 insert into private.ai_writing_limits(user_id,usage_day,requests)
 values(p_user_id,(now() at time zone 'UTC')::date,1)
 on conflict(user_id,usage_day) do update set requests=private.ai_writing_limits.requests+1
 where private.ai_writing_limits.requests<30
 returning true into allowed;
 return coalesce(allowed,false);
end $$;
revoke all on function private.claim_ai_writing_request(uuid) from public,anon,authenticated;
grant execute on function private.claim_ai_writing_request(uuid) to service_role;
create or replace function public.claim_ai_writing_request(p_user_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 select private.claim_ai_writing_request(p_user_id)
$$;
revoke all on function public.claim_ai_writing_request(uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function public.claim_ai_writing_request(uuid) to service_role;