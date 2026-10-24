import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../supabase/functions/dropbox-connect-ge-one/index.ts',import.meta.url),'utf8');
test('Dropbox wizard uses direct GE ONE Supabase Auth login and a validated Admin session',()=>{
 assert.match(source,/\/auth\/v1\/token\?grant_type=password/);
 assert.match(source,/client\.auth\.getUser\(\)/);
 assert.match(source,/role\.data\?\.role!=="admin"/);
 assert.match(source,/el\("password"\)\.value=""/);
 assert.match(source,/access=data\.access_token/);
 assert.doesNotMatch(source,/localStorage|sessionStorage/);
});
test('Dropbox wizard requires no secret, provides official app setup, scopes and redirect',()=>{
 assert.match(source,/https:\/\/www\.dropbox\.com\/developers\/apps/);
 assert.match(source,/Scoped access/);
 assert.match(source,/App folder/);
 assert.match(source,/files\.content\.write/);
 assert.match(source,/files\.metadata\.read/);
 assert.match(source,/account_info\.read/);
 assert.match(source,/OAuth 2/);
 assert.match(source,/action:"setup_dropbox"/);
 assert.match(source,/action:"connect"/);
 assert.match(source,/window\.location\.assign/);
 assert.match(source,/hostname!=="www\.dropbox\.com"/);
 assert.match(source,/Content-Security-Policy/);
 assert.match(source,/script-src 'nonce-/);
 assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY"\)\.replace\(/);
});
