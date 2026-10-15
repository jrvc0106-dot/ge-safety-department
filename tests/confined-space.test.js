import test from 'node:test';
import assert from 'node:assert/strict';
import {TOOL_DEFINITIONS,toolReportHtml} from '../src/safety-tools-model.js';
import {REPORT_SIGNATURE_ROLES,reportApprovals} from '../src/report-signatures.js';

test('confined space permit has OSHA entry-control fields',()=>{
 const def=TOOL_DEFINITIONS.confined_space;
 assert.equal(def.prefix,'CSE');
 const names=new Set(def.fields.map(field=>field[0]));
 for(const key of ['space_id','location','purpose','entry_date','entry_start','entry_end','classification','hazards','isolation','acceptable_conditions','atmospheric_tests','entrants','attendants','entry_supervisor','rescue_service','rescue_procedure','authorization','cancellation'])
  assert.ok(names.has(key),key);
 assert.ok(def.checklist.length>=10);
});

test('entry supervisor, attendant, safety signatures are individually captured',()=>{
 assert.deepEqual(REPORT_SIGNATURE_ROLES.confined_space,['entry_supervisor','attendant','safety']);
 const data=new FormData();
 for(const role of REPORT_SIGNATURE_ROLES.confined_space){
  data.set('jha_'+role+'_name',role);
  data.set('jha_'+role+'_signature',JSON.stringify([[[0.1,0.1],[0.2,0.2]]]));
 }
 const approvals=reportApprovals('confined_space',data);
 for(const role of REPORT_SIGNATURE_ROLES.confined_space){
  assert.equal(approvals[role].name,role);
  assert.equal(approvals[role].strokes.length,1);
 }
});

test('permit report separates entry hazards, rescue and authorization',()=>{
 const record={kind:'confined_space',report_number:'CSE-TEST',payload:{
  space_id:'TEST-01',hazards:'Engulfment assessment recorded',rescue_service:'Designated rescue team',authorization:'Supervisor verification'
 }};
 const html=toolReportHtml(record,{name:'Example Project'},[]);
 for(const phrase of ['CSE-TEST','TEST-01','Engulfment assessment recorded','Designated rescue team','Supervisor verification','Entry authorization and closure'])
 assert.ok(html.includes(phrase),phrase);
});
