import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {reportFileDate,reportName,reportExportFilename,originalReportDateFromElement} from '../src/report-export-filename.js';

test('exact mandated Forklift Daily Report filename with original report date',()=>{
 assert.equal(reportExportFilename({title:'Forklift',reportType:'equipment_inspection',originalDate:'2026-10-23'}),
  'Forklift Daily Report 10.23.2026 By G&E.pdf');
});

test('date-only values never change calendar day for UTC conversion',()=>{
 assert.equal(reportFileDate('2026-10-23'),'10.23.2026');
 assert.equal(reportFileDate('10/23/2026'),'10.23.2026');
 assert.equal(reportFileDate('10.23.2026'),'10.23.2026');
 assert.equal(reportFileDate('20261023'),'10.23.2026');
 assert.equal(reportFileDate('2026-10-24T00:30:00.000Z'),'10.23.2026');
 assert.equal(reportFileDate(new Date('2026-10-24T00:30:00.000Z')),'10.23.2026');
 assert.equal(reportFileDate('2026-10-23T17:30:00.000Z'),'10.23.2026');
 assert.equal(reportFileDate('2026-02-29'),'');
 assert.equal(reportFileDate('not a date'),'');
});

test('all report classes keep descriptive names with date and suffix',()=>{
 const values=[
  ['Daily Safety Report','daily_report','Daily Safety Report'],
  ['Daily Safety Walk (JHA)','daily_safety_walk','Daily Safety Walk (JHA)'],
  ['Incident / Accident Report','incident','Incident - Accident Report'],
  ['Quick Safety Orientation','training','Quick Safety Orientation'],
  ['Safety Observation Report','observation','Safety Observation Report'],
  ['Disciplinary Action Report','disciplinary_action','Disciplinary Action Report'],
  ['Inventory Report By G&E','inventory','Inventory Report'],
  ['Toolbox Talk','tool_toolbox','Toolbox Talk'],
  ['Confined Space Entry','tool_confined_space','Confined Space Entry'],
  ['Medical Follow Up','tool_medical_followup','Medical Follow Up'],
  ['Equipment Inspection Report','equipment_inspection','Equipment Inspection Report']
 ];
 for(const [title,kind,want] of values){
  assert.equal(reportExportFilename({title,reportType:kind,originalDate:'2026-10-23'}),
    want+' 10.23.2026 By G&E.pdf');
 }
 assert.equal(reportExportFilename({title:'Forklift Daily Report 10.23.2026 By G&E.pdf',originalDate:'2026-10-23'}),
   'Forklift Daily Report 10.23.2026 By G&E.pdf');
});

test('invalid names are safe, but no report is labeled with the download date',()=>{
 assert.equal(reportExportFilename({title:'../Suspicious/Report',originalDate:'2026-10-23'}),
   'Suspicious-Report 10.23.2026 By G&E.pdf');
 assert.throws(()=>reportExportFilename({title:'Any Report'}),/Original report date is required/);
});

test('DOM report uses authoritative source date before other dates displayed as evidence',()=>{
 const doc=new JSDOM('<article data-ge-report-date="2026-10-23T16:00:00Z">Correction scheduled 11/04/2026</article>').window.document;
 assert.equal(reportFileDate(originalReportDateFromElement(doc.querySelector('article'))),'10.23.2026');
 const fallback=new JSDOM('<article>Event date: 10/23/2026. Signed on 10/24/2026</article>').window.document;
 assert.equal(originalReportDateFromElement(fallback.querySelector('article')),'10/23/2026');
});
