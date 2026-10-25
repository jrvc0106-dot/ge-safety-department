import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const universal=file('supabase/automatic-dropbox-final-reports.sql');
const quick=file('supabase/migrations/20261025223800_quick_orientation_pdf_backfill.sql');
const registered=file('supabase/migrations/20261025234000_registered_orientation_pdf_backfill.sql');
const tool=file('supabase/migrations/20261025235500_safety_tools_pdf_backfill.sql');
const source=file('supabase/migrations/20261026000500_final_source_pdf_backfill.sql');
const uploader=file('supabase/functions/auto-dropbox-reports/index.ts');
const orientations=file('supabase/functions/backfill-registered-orientation-pdfs/index.ts');
const sources=file('supabase/functions/backfill-final-source-pdfs/index.ts');
test('All current and future projects use one corporate Dropbox connection',()=>{
 assert.match(uploader,/dropbox_auto_control/);
 assert.match(universal,/after insert or update of document_status,pdf_path/);
 assert.match(universal,/new.document_status='final'/);
 assert.match(universal,/on conflict \(report_id\) do nothing/);
 assert.doesNotMatch(uploader,/project_id\",projectId\)\.eq\(\"provider\",\"dropbox\"/);
});
test('All finalized report source classes are automatically queued',()=>{
 assert.match(quick,/CREATE TRIGGER quick_orientation_pdf_backfill_enqueue/);
 assert.match(registered,/CREATE TRIGGER ge_registered_orientation_pdf_enqueue/);
 assert.match(tool,/CREATE TRIGGER ge_safety_tool_pdf_enqueue/);
 for(const s of ['daily_safety_walks','equipment_inspections','incident_reports','safety_discipline','corrective_actions'])
  assert.ok(source.includes(s),s);
 assert.match(source,/status='final'/);
 assert.match(source,/status='closed'/);
 assert.match(source,/after insert or update/i);
});
test('Archived PDFs preserve employee photos and signatures without inventing missing signatures',()=>{
 assert.match(orientations,/record.orientation_photo_path/);
 assert.match(orientations,/record.certificate_photo_paths/);
 assert.match(orientations,/record.approvals/);
 assert.match(orientations,/One or more signatures/);
 assert.match(sources,/Saved report evidence photo unavailable/);
});
test('Registered and quick orientations have their own Dropbox categories',()=>{
 assert.match(uploader,/registeredOrientationReport/);
 assert.match(uploader,/Register Safety Orientation/);
 assert.match(uploader,/Quick Safety Orientation/);
 assert.match(uploader,/tool_qr:"Confined Space Reports"/);
});
test('Source documents are preserved until verified Dropbox cleanup is permitted',()=>{
 assert.match(uploader,/status:"completed"/);
 assert.doesNotMatch(sources,/\.from\("final-reports"\)\.remove\(\[record\.pdf_path\]\)/);
});