create or replace function private.new_user_profile()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  email_domain text := lower(split_part(btrim(coalesce(new.email, '')), '@', 2));
begin
  if new.email is null or btrim(new.email) = '' then
    raise exception 'A valid email address is required';
  end if;

  -- External email addresses are accepted only for an invitation created by
  -- the trusted server-side Admin API. app_metadata cannot be set by a client.
  if email_domain <> 'geflcontractors.com'
     and new.invited_at is null
     and coalesce(new.raw_app_meta_data->>'ge_admin_invite', 'false') <> 'true' then
    raise exception 'A company email or administrator invitation is required';
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
