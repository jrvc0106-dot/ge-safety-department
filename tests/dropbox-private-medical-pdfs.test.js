import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {medicalDropboxPdfPath,medicalDropboxStatus,queueMedicalDropboxPdf} from '../src/medical-dropbox-archive.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const worker=source('supabase/functions/auto-dropbox-reports/index.ts');
const cloud=source('supabase/functions/backup-cloud/index.ts');
const sql=source('supabase/automatic-dropbox-medical-reports.sql');
const main=source('src/main.js');
const projectId='11111111-1111-4111-8111-111111111111';
const userId='22222222-2222-4222-8222-222222222222';
const followupId='33333333-3333-4333-8333-333333333333';
test('confidential medical storage stays private and available only to authorized jobsite medical staff',()=>{
 assert.match(sql,/values\('medical-final-pdfs','medical-final-pdfs',false/);
 assert.match(sql,/private\.my_role\(\)\) in \('admin','safety_director'\)/);
 assert.match(sql,/private\.is_project_member/);
 assert.match(sql,/grant all on public\.dropbox_automatic_medical_reports to service_role/);
 assert.match(sql,/revoke all on public\.dropbox_automatic_medical_reports from public,anon,authenticated/);
 assert.match(sql,/returns setof public\.dropbox_automatic_medical_reports/);
 assert.match(sql,/for update skip locked/);
});
test('medical PDF paths cannot mix different users, projects or followup IDs',()=>{
 assert.equal(medicalDropboxPdfPath({projectId,userId,followupId}),projectId+'/'+userId+'/'+followupId+'/final.pdf');
 for(const bad of [{projectId:'../../',userId,followupId},{projectId,userId:'abc',followupId},{projectId,userId,followupId:'../../steal'}])
  assert.throws(()=>medicalDropboxPdfPath(bad));
});
test('confidential PDF queue only acknowledges verified full upload',async()=>{
 const path=medicalDropboxPdfPath({projectId,userId,followupId}),calls=[];
 const db={storage:{from:bucket=>({upload:async(p,blob,opt)=>{calls.push({bucket,p,opt});return {error:null}}})},
  functions:{invoke:async(name,body)=>({data:{queued:true}})}};
 const result=await queueMedicalDropboxPdf(db,{blob:new Blob(['%PDF-1.4\n','A'.repeat(60),'\n%%EOF'],{type:'application/pdf'}),projectId,userId,followupId});
 assert.deepEqual(result,{queued:true,path,alreadyQueued:false});
 assert.equal(calls[0].bucket,'medical-final-pdfs');
 assert.equal(calls[0].opt.upsert,false);
 await assert.rejects(()=>queueMedicalDropboxPdf(db,{blob:new Blob(['x']),projectId,userId,followupId}));
});
test('Dropbox status is not mistaken for an authorized medical backup before OAuth',async()=>{
 const db={functions:{invoke:async()=>({data:{enabled:false,medical_queued:false}})}};
 assert.deepEqual(await medicalDropboxStatus(db,{projectId,followupId}),{enabled:false,queued:false});
});
test('medical Dropbox routing avoids normal final-reports and uses dedicated medical folder',()=>{
 assert.match(worker,/admin\.storage\.from\("medical-final-pdfs"\)\.download\(row\.pdf_path\)/);
 assert.match(worker,/Medical Reports - Confidential/);
 assert.match(worker,/medicalSent/);
 assert.match(worker,/archiveMedical\(body,auth\.data\.user\.id,profile\.role\)/);
 assert.match(worker,/if\(!\["admin","safety_director"\]\.includes\(role\)\)/);
 assert.match(worker,/if\(!member\)return json\(\{error:"Jobsite access denied\."\},403\)/);
 assert.match(worker,/pdfIsComplete\(downloaded\.data\)/);
 assert.doesNotMatch(worker,/employee_name|reported_medications/);
 assert.match(cloud,/medical_counts:medicalCounts/);
});
test('saved medical followup is automatically PDF-rendered only after Dropbox approval',()=>{
 assert.match(main,/article\.report\[data-tool-kind="medical_followup"\]/);
 assert.match(main,/status\.enabled&&!status\.queued&&current\(\)/);
 assert.match(main,/await buildReportPdf\(true\)/);
 assert.match(main,/if\(report\.dataset\?\.toolKind==='medical_followup'/);
 assert.match(main,/queueMedicalDropboxPdf\(db,/);
 assert.match(main,/PDF médicos confidenciales/);
});
