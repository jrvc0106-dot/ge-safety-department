create table if not exists public.admin_invite_allowlist (
  email text primary key,
  created_by uuid not null,
  expires_at timestamptz not null
);
alter table public.admin_invite_allowlist enable row level security;
revoke all on table public.admin_invite_allowlist from anon, authenticated;
grant all on table public.admin_invite_allowlist to service_role;

create or replace function private.new_user_profile()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  email_domain text := lower(split_part(btrim(coalesce(new.email, '')), '@', 2));
  allowed_external boolean := false;
begin
  if new.email is null or btrim(new.email) = '' then
    raise exception 'A valid email address is required';
  end if;

  if email_domain <> 'geflcontractors.com' and new.invited_at is null then
    delete from public.admin_invite_allowlist
    where email = lower(btrim(new.email))
      and expires_at > now()
    returning true into allowed_external;

    if not coalesce(allowed_external, false) then
      raise exception 'A company email or administrator invitation is required';
    end if;
  end if;

  insert into public.profiles(id, email, name, role)
  values (
    new.id,
    lower(btrim(new.email)),
    coalesce(nullif(btrim(new.raw_user_meta_data->>'name'), ''), split_part(lower(btrim(new.email)), '@', 1)),
    'worker'
  );
  return new;
end
$function$;
