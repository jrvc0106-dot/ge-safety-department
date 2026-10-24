import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const repoPath=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const edge=repoPath('supabase/functions/auto-dropbox-reports/index.ts');
const bridge=repoPath('supabase/functions/backup-cloud/index.ts');
const schema=repoPath('supabase/automatic-dropbox-final-reports.sql');
const main=repoPath('src/main.js');

test('automatically queues each final PDF, with no transfers before Dropbox approval',()=>{
 assert.match(schema,/after insert or update of document_status,pdf_path on public\.report_documents/);
 assert.match(schema,/new\.document_status='final' and new\.pdf_path is not null/);
 assert.match(schema,/on conflict \(report_id\) do nothing/);
 assert.match(schema,/enabled boolean not null default false/);
 assert.match(schema,/on public\.report_documents/);
 assert.match(schema,/report_type not like '%medical%'/);
});

test('retryable server queue requires isolated worker credentials and no client-readable tokens',()=>{
 assert.match(schema,/alter table public\.dropbox_automatic_reports enable row level security/);
 assert.match(schema,/revoke all on public\.dropbox_auto_control,public\.dropbox_automatic_reports,public\.dropbox_automatic_worker_key from public,anon,authenticated/);
 assert.match(schema,/for update skip locked/);
 assert.match(schema,/cron\.schedule\('ge-auto-dropbox-final-reports'/);
 assert.match(edge,/authorizeWorker\(req\.headers\.get\("x-ge-dropbox-worker"\)/);
 assert.match(edge,/if\(!await authorizeWorker/);
 assert.match(edge,/dropbox_auto_control/);
 assert.match(edge,/\.eq\("lock_token",job\.lock_token\)/);
 assert.match(edge,/Math\.min\(24\*3600/);
 assert.match(edge,/pdfIsComplete\(blob\)/);
 assert.match(edge,/Number\(saved\.size\)!==blob\.size/);
 assert.match(edge,/return \{enabled:false,sent:0,failed:0\}/);
});
test('automatic reports use specific PDF paths and jobsite folders, and retain source documents',()=>{
 assert.match(edge,/admin\.storage\.from\("final-reports"\)\.download\(record\.pdf_path\)/);
 assert.match(edge,/\/GE ONE Reports/);
 assert.match(edge,/safe\(project\.name,"Project"\)/);
 assert.match(edge,/safe\(record\.report_type,"Safety Reports"\)/);
 assert.match(edge,/By G&E\.pdf/);
 assert.match(edge,/mode:"overwrite"/);
 assert.doesNotMatch(edge,/storage\.from\("final-reports"\)\.remove/);
});
test('Dropbox must be approved by an Admin before deliveries start',()=>{
 assert.match(bridge,/if\(record\.provider==="dropbox"\)/);
 assert.match(bridge,/enabled:true,connection_id:connected\.id/);
 assert.match(bridge,/profile\?\.role!=="admin"/);
 assert.match(bridge,/if\(body\.action==="automatic_reports"\)/);
 assert.match(bridge,/if\(p==="dropbox"\)\{/);
 assert.match(bridge,/enabled:false,connection_id:null/);
 assert.match(bridge,/existingConnection\?\.id\|\|crypto\.randomUUID/);
});
test('iPad Files original is unaffected and no PDF is uploaded before opt-in',()=>{
 assert.match(main,/if\(nativeReportArchiveAvailable\(\)\)/);
 assert.match(main,/await saveLocalReport\(\{/);
 assert.match(main,/body:\{action:'enabled',project_id:meta\.projectId\}/);
 assert.match(main,/if\(permission\.error\|\|permission\.data\?\.enabled!==true\)return/);
 assert.match(main,/await registerFinalReport\(blob,report,meta\)/);
 assert.match(main,/backup-auto-status/);
 assert.match(main,/backup-auto-toggle/);
 assert.match(main,/automatic_reports',project_id:projectId,enabled:!autoReports\.enabled/);
});
