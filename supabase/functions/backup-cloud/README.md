# External backup storage

Cloud Backup Center supports a project-specific primary backup destination: Supabase, Google Drive or Dropbox. The application's operational records and evidence remain in Supabase. External destinations receive copies only after account authorization and an explicit backup/copy action.

## Provider setup

The OAuth redirect URL for both providers is:

https://uubgrpdknxheflbkwkzf.supabase.co/functions/v1/backup-cloud?callback=1

### Google Drive

1. In Google Cloud Console, enable Google Drive API.
2. Configure the OAuth consent screen. For testing, add the intended account as a test user. Use a company-internal or production configuration when appropriate; testing-mode refresh tokens may expire.
3. Create a Web Application OAuth client and register the redirect URL above exactly.
4. In Supabase Edge Function Secrets, set GOOGLE_BACKUP_CLIENT_ID and GOOGLE_BACKUP_CLIENT_SECRET.
5. In Cloud Backup Center, select Connect account for Google Drive, grant drive.file access, close the authorization window and refresh the connection status.
6. Select Google Drive in Primary Storage and create a backup.

### Dropbox

1. Create a scoped API app in https://www.dropbox.com/developers/apps with App Folder access.
2. Enable files.content.write, files.metadata.read and account_info.read. Register the redirect URL above.
3. In Supabase Edge Function Secrets, set DROPBOX_BACKUP_APP_KEY and DROPBOX_BACKUP_APP_SECRET.
4. Connect the account in Cloud Backup Center, then select Dropbox as Primary Storage.

Never enter provider secrets into the browser app or commit them to Git. Gemini API keys are unrelated to Drive OAuth credentials.

## Storage and verification

Apply ../../backup-cloud-connections.sql. Deploy backup-cloud with gateway JWT verification disabled: POST explicitly validates auth.getUser and a stored Admin/Safety Director role plus project access. The public callback consumes a random one-use OAuth state with a ten-minute expiry, then rechecks the user's role and project access. A health response exposes configuration booleans only. Tables containing OAuth state, encrypted refresh tokens, destination preferences and export progress deny all browser/anonymous access.

Refresh tokens are AES-GCM encrypted with a key derived from the Supabase service-role secret. Rotating that secret requires reconnecting cloud accounts. Account disconnection removes this application's stored connection and falls back to Supabase; it does not delete external backup files or revoke the provider's account-wide app permissions.

create-cloud-backup creates a local immutable snapshot with project records, descendant records, saved PDFs, JHA item-linked photos, inventory and orientation evidence. It paginates reads, deduplicates source paths, reads back copied files and verifies SHA-256 content and the manifest. An unreadable required record or file fails the backup instead of reporting success. Legacy snapshots cannot recover evidence omitted by the old engine; create a fresh backup.

External copies use the verified snapshot and upload up to three files per request. A database lease blocks concurrent processing. Progress is saved after each provider-acknowledged upload and can be resumed from history. External completion means all files and the manifest were acknowledged at their expected size; Google/Dropbox end-to-end checksum verification is not claimed. Keep the page open during copying. A cloud-account change requires a new backup. A provider timeout followed by a successful upload but a failed database checkpoint may create a duplicate Google Drive file on retry; source records remain intact.

Provider credentials are currently unconfigured; account authorization and real provider uploads must be verified after setup. Controlled tests cover authorization, OAuth replay protection, encrypted credentials, pagination/copy integrity, provider request formats, resumed copying and destination selection.
