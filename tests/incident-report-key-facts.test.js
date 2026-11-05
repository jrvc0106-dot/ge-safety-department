import test from 'node:test';
import assert from 'node:assert/strict';
import {incidentReportLongDate,renderIncidentReport} from '../src/incident-report-template.js';
const tr=(en)=>en,esc=x=>String(x),fmt=x=>String(x);
test('incident date is printed as a named month with a two-digit day',()=>{
 assert.equal(incidentReportLongDate('2026-11-04T20:00:30Z'),'Noviembre 04 2026');
 assert.equal(incidentReportLongDate('2026-11-04'),'Noviembre 04 2026');
 assert.equal(incidentReportLongDate(null),'—');
});
test('incident report preserves professional structure and highlights key facts',()=>{
 const html=renderIncidentReport({incident_type:'injury',employee_name:'Example Person',what_happened:'Example incident description',created_at:'2026-11-04T20:00:30Z',project:{name:'The Crossings'},approvals:{}},[],{tr,esc,fmt});
 assert.match(html,/professional-report incident-pdf incident-reference/);
 assert.match(html,/class="ir-person-name">Example Person/);
 assert.match(html,/class="ir-narrative ir-key-description"/);
 assert.match(html,/Example incident description/);
 assert.match(html,/Noviembre 04 2026/);
 assert.match(html,/Investigation closeout/);
});