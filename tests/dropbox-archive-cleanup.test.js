import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const worker=code('supabase/functions/dropbox-archive-cleanup/index.ts');
const schema=code('supabase/migrations/20261025221000_dropbox_archived_pdf_cleanup.sql');
const ui=code('src/main.js');
test('Archive cleanup keeps a minimum seven-day verification period',()=>{
 assert.match(schema,/retention_days integer NOT NULL DEFAULT 7/);
 assert.match(worker,/await verify\(row,record,token\)/);
 assert.match(worker,/originalHash!==remoteHash/);
 assert.match(worker,/Math\.max\(7,Number\(settings\.retention_days\)\)/);
 assert.match(schema,/cleanup_hold boolean NOT NULL DEFAULT false/);
});
test('Archive never deletes database records or medical files',()=>{
 assert.doesNotMatch(worker,/\.from\("report_documents"\)\.delete\(/);
 assert.doesNotMatch(worker,/storage\.from\("medical-final-pdfs"\)\.remove/);
 assert.match(worker,/storage\.from\("final-reports"\)\.remove/);
});
test('Report Center keeps View and Download buttons with authenticated Dropbox fallback',()=>{
 assert.match(ui,/action:'archive_link'/);
 assert.match(ui,/action:'archive_status'/);
 assert.match(ui,/Archived in Dropbox/);
 assert.match(worker,/authorizedProject/);
 assert.match(worker,/get_temporary_link/);
});