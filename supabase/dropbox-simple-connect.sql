-- One-time Dropbox OAuth PKCE setup through G&E ONE Cloud Backup Center.
-- Existing backup tables have RLS enabled and deny browser/anonymous access.
alter table public.backup_cloud_settings add column if not exists dropbox_app_key text;
alter table public.backup_cloud_oauth_states add column if not exists code_verifier text;
alter table public.backup_cloud_oauth_states add column if not exists app_key text;
alter table public.backup_cloud_connections add column if not exists app_key text;
comment on column public.backup_cloud_settings.dropbox_app_key is 'Dropbox public OAuth client ID set by authenticated Admin in Cloud Backup Center.';
comment on column public.backup_cloud_oauth_states.code_verifier is '10-minute one-use PKCE verifier deleted when the OAuth callback is consumed.';
