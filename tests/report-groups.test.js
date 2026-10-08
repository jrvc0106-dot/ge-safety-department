import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupWalkReportsByCreator,groupFinalWalkReportsByCreator} from '../src/report-groups.js';

test('groups walk reports by normalized creator and orders reports and groups by latest date',()=>{
 const rows=[
  {id:'j2',created_at:'2026-10-07T10:00:00Z',creator:{name:'Jorling Jiron'}},
  {id:'a1',created_at:'2026-10-07T09:00:00Z',creator:{name:'Ana Ruiz'}},
  {id:'j1',created_at:'2026-10-06T10:00:00Z',creator:{name:'  jorling jiron '}},
 ];
 const groups=groupWalkReportsByCreator(rows);
 assert.deepEqual(groups.map(group=>group.name),['Jorling Jiron','Ana Ruiz']);
 assert.deepEqual(groups[0].reports.map(report=>report.id),['j2','j1']);
});

test('includes only walks whose latest report document is finalized',()=>{
 const rows=[
  {id:'final',created_at:'2026-10-07T10:00:00Z',creator:{name:'Jorling Jiron'}},
  {id:'draft',created_at:'2026-10-07T09:00:00Z',creator:{name:'Jorling Jiron'}},
  {id:'missing-doc',created_at:'2026-10-06T10:00:00Z',creator:{name:'Ana Ruiz'}},
 ];
 const documents=[
  {report_type:'daily_safety_walk',source_id:'final',document_status:'final',created_at:'2026-10-07T11:00:00Z'},
  {report_type:'daily_safety_walk',source_id:'draft',document_status:'final',created_at:'2026-10-07T11:00:00Z'},
  {report_type:'daily_safety_walk',source_id:'draft',document_status:'draft',created_at:'2026-10-07T12:00:00Z'},
 ];
 const groups=groupFinalWalkReportsByCreator(rows,documents);
 assert.deepEqual(groups.map(group=>group.name),['Jorling Jiron']);
 assert.deepEqual(groups[0].reports.map(report=>report.id),['final']);
});

test('places reports without a profile name in the translated fallback group',()=>{
 const groups=groupWalkReportsByCreator([{id:'missing',creator:null}],'Creador desconocido');
 assert.equal(groups[0].name,'Creador desconocido');
 assert.deepEqual(groups[0].reports.map(report=>report.id),['missing']);
});

test('does not mutate the original report list',()=>{
 const rows=[{id:'b',created_at:'2026-10-06T00:00:00Z',creator:{name:'Zoe'}},{id:'a',created_at:'2026-10-07T00:00:00Z',creator:{name:'Ana'}}];
 const original=[...rows];
 groupWalkReportsByCreator(rows);
 assert.deepEqual(rows,original);
});
