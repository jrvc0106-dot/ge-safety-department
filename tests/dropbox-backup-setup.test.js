import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dropboxSetupMarkup,isValidDropboxAppKey} from '../src/dropbox-backup-setup.js';

test('Dropbox App Key is public ID only, no password or secret required',()=>{
 assert.equal(isValidDropboxAppKey('1ab2CD3ef9'),true);
 for(const invalid of ['','abc','has spaces','<script>',123456,'x'.repeat(65)])assert.equal(isValidDropboxAppKey(invalid),false);
 const html=dropboxSetupMarkup('https://example.supabase.co/functions/v1/backup-cloud?callback=1',(en,es)=>es,s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;'));
 assert.match(html,/Guardar clave y conectar Dropbox/);
 assert.match(html,/Scoped access → App folder/);
 assert.match(html,/files\.content\.write/);
 assert.match(html,/account_info\.read/);
 assert.match(html,/backup-dropbox-copy-callback/);
 assert.doesNotMatch(html,/input[^>]*type="password"/);
 assert.doesNotMatch(html,/DROPBOX_BACKUP_APP_SECRET/);
});
test('Dropbox OAuth Edge Function uses short-lived state, server-side PKCE and account-specific token refresh',()=>{
 const source=readFileSync(new URL('../supabase/functions/backup-cloud/index.ts',import.meta.url),'utf8');
 assert.match(source,/validDropboxAppKey/);
 assert.match(source,/body\.action==="setup_dropbox"/);
 assert.match(source,/code_challenge_method","S256"/);
 assert.match(source,/token_access_type","offline"/);
 assert.match(source,/code_verifier:verifier/);
 assert.match(source,/record\.code_verifier/);
 assert.match(source,/appKey:connection\.app_key\|\|null/);
 assert.match(source,/profile\?\.role!=="admin"/);
 assert.match(source,/postMessage\(\{type:'ge-cloud-backup-oauth'/);
});
test('Cloud Backup UI keeps other providers intact while allowing one-click Dropbox setup',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/dropboxSetupMarkup/);
 assert.match(main,/beginBackupConnection/);
 assert.match(main,/action:'setup_dropbox'/);
 assert.match(main,/event\.origin!==callbackOrigin/);
 assert.match(main,/backup-primary-storage/);
 assert.match(main,/google_drive/);
});
