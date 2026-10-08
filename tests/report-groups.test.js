import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupWalkReportsByCreator} from '../src/report-groups.js';

test('groups walk reports by normalized creator name and sorts groups alphabetically',()=>{
 const rows=[
  {id:'j2',created_at:'2026-10-07T10:00:00Z',creator:{name:'Jorling Jiron'}},
  {id:'a1',created_at:'2026-10-07T09:00:00Z',creator:{name:'Ana Ruiz'}},
  {id:'j1',created_at:'2026-10-06T10:00:00Z',creator:{name:'  jorling jiron '}},
 ];
 const groups=groupWalkReportsByCreator(rows);
 assert.deepEqual(groups.map(group=>group.name),['Ana Ruiz','Jorling Jiron']);
 assert.deepEqual(groups[1].reports.map(report=>report.id),['j2','j1']);
});

test('places reports without a profile name in the translated fallback group',()=>{
 const groups=groupWalkReportsByCreator([{id:'missing',creator:null}],'Creador desconocido');
 assert.equal(groups[0].name,'Creador desconocido');
 assert.deepEqual(groups[0].reports.map(report=>report.id),['missing']);
});

test('does not mutate the original report list',()=>{
 const rows=[{id:'b',creator:{name:'Zoe'}},{id:'a',creator:{name:'Ana'}}];
 const original=[...rows];
 groupWalkReportsByCreator(rows);
 assert.deepEqual(rows,original);
});
