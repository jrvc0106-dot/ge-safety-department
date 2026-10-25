import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../supabase/functions/auto-dropbox-reports/index.ts',import.meta.url),'utf8');
test('Backup folders mirror Report Center categories',()=>{
 for(const category of ['Daily Safety Reports','Daily Safety Walks','Safety Observations','Corrective Actions','Disciplinary Actions','Incidents - Accidents','Near Miss Reports','Equipment Inspections','Inventory Reports','Toolbox Talks','G&E Safety Training','Quick Safety Orientation','Register Safety Orientation'])
  assert.ok(worker.includes(category),category);
});
test('Documents are filed by report date, creator and stable identity without modifying PDF',()=>{
 for(const text of ['originalReportDay(record)','Created By - ','record.created_by','readableMonth','readableDay','record.id.slice(0,8)','await pdfIsComplete(blob)'])
  assert.ok(worker.includes(text),text);
 assert.ok(worker.includes('status:"completed"'));
 assert.ok(worker.includes('saved.size'));
});
