import test from 'node:test';
import assert from 'node:assert/strict';
import {indexFinalPdfDocuments,isRecoveredJhaPdf,archivedPdfLink} from '../src/finalized-pdf-direct.js';

const project='project-1',source='jha-1';
const row=(override={})=>({
 project_id:project,report_type:'daily_safety_walk',
 source_id:source,document_status:'final',version:1,
 pdf_path:'project-1/daily_safety_walk/DSW-001.pdf',
 created_at:'2026-11-18T10:00:00.000Z',snapshot:{source_page:'safetyWalkReport'},
 ...override
});

test('technical recovered JHA from screenshot/text dump is never classified as professional',()=>{
 const recovered=row({version:2,pdf_path:'project-1/daily_safety_walk/DAILY-SAFETY-WALK-RECOVERED-REV-1.pdf',
  snapshot:{source_page:'recoveredSourceReport'}});
 assert.equal(isRecoveredJhaPdf(recovered),true);
 assert.equal(indexFinalPdfDocuments([recovered],project).size,0);
});

test('professional JHA remains accessible even when a newer technical recovered version exists',()=>{
 const good=row();
 const recovered=row({version:3,pdf_path:'jha-RECOVERED-rev-3.pdf',snapshot:{source_page:'recoveredSourceReport'}});
 assert.deepEqual(indexFinalPdfDocuments([good,recovered],project).get('daily_safety_walk:'+source),good);
});

test('recovered JHA archive cannot bypass the guard with a signed URL',async()=>{
 let called=false;
 const storage={from(){called=true;throw Error('Storage must not be queried');}};
 const recovered=row({pdf_path:'broken-RECOVERED-file.pdf'});
 await assert.rejects(archivedPdfLink(storage,recovered),/technical recovery format/);
 assert.equal(called,false);
});

test('ordinary professional and non-JHA documents keep their existing behavior',()=>{
 const jha=row();
 const incident={...row({report_type:'incident',pdf_path:'an-incident-RECOVERED-file.pdf'})};
 assert.equal(isRecoveredJhaPdf(jha),false);
 assert.equal(isRecoveredJhaPdf(incident),false);
 assert.equal(indexFinalPdfDocuments([jha,incident],project).size,2);
});
