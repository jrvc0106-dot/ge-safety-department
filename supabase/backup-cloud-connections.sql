
create table public.backup_cloud_settings(
 project_id uuid primary key references public.projects(id) on delete cascade,
 provider text not null default 'supabase' check(provider in ('supabase','google_drive','dropbox')),
 updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);
create table public.backup_cloud_connections(
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
 provider text not null check(provider in ('google_drive','dropbox')),
 encrypted_token text not null, account_label text not null, connected_by uuid not null references public.profiles(id),
 connected_at timestamptz not null default now(), unique(project_id,provider)
);
create table public.backup_cloud_oauth_states(
 state uuid primary key, project_id uuid not null references public.projects(id) on delete cascade,
 provider text not null check(provider in ('google_drive','dropbox')), user_id uuid not null references public.profiles(id),
 expires_at timestamptz not null
);
create table public.backup_cloud_exports(
 backup_id uuid not null references public.cloud_backups(id) on delete cascade,
 provider text not null check(provider in ('google_drive','dropbox')), connection_id uuid not null,
 folder_id text, copied jsonb not null default '[]', total_files integer not null default 0,
 status text not null default 'pending' check(status in ('pending','completed','failed')),
 error_message text, completed_at timestamptz, lock_until timestamptz, lock_token uuid,
 primary key(backup_id,provider)
);
alter table public.backup_cloud_settings enable row level security;
alter table public.backup_cloud_connections enable row level security;
alter table public.backup_cloud_oauth_states enable row level security;
alter table public.backup_cloud_exports enable row level security;
revoke all on public.backup_cloud_settings,public.backup_cloud_connections,public.backup_cloud_oauth_states,public.backup_cloud_exports from public,anon,authenticated;
grant all on public.backup_cloud_settings,public.backup_cloud_connections,public.backup_cloud_oauth_states,public.backup_cloud_exports to service_role;
create function public.claim_backup_cloud_export(p_backup uuid,p_provider text,p_connection uuid,p_token uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare claimed boolean;
begin
 insert into public.backup_cloud_exports(backup_id,provider,connection_id,lock_until,lock_token)
 values(p_backup,p_provider,p_connection,now()+interval '3 minutes',p_token)
 on conflict(backup_id,provider) do update set lock_until=excluded.lock_until,lock_token=excluded.lock_token
 where public.backup_cloud_exports.lock_until is null or public.backup_cloud_exports.lock_until<now()
 returning true into claimed;
 return coalesce(claimed,false);
end $$;
revoke all on function public.claim_backup_cloud_export(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_backup_cloud_export(uuid,text,uuid,uuid) to service_role;
