import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {namedAttendance,summarizeTrainingStats,TRAINING_STATS_CATEGORIES,mountReportCenterTrainingStatistics} from '../src/report-center-training-statistics.js';
const now=new Date('2026-10-25T17:00:00-04:00');
const data={
 quick:[{id:'q1',project_id:'p1',employee_name:'A',sticker_number:'100',orientation_at:'2026-10-24T13:00:00Z',status:'final'},
        {id:'q2',project_id:'p2',employee_name:'B',sticker_number:'200',orientation_at:'2026-10-25T13:00:00Z',status:'final'},
        {id:'draft',project_id:'p1',employee_name:'Draft',status:'draft',created_at:'2026-10-25T13:00:00Z'}],
 registered:[{id:'r1',project_id:'p1',employee_name:'A',sticker_number:'100',orientation_date:'2026-10-24'}],
 tools:[{id:'t1',project_id:'p1',kind:'toolbox',created_at:'2026-10-25T13:00:00Z',payload:{attendance_signatures:[{name:'Jose'},{name:'Jose'},{name:'Mary'},{}]}},
        {id:'t2',project_id:'p2',kind:'training',created_at:'2026-10-25T13:00:00Z',payload:{attendance_signatures:[{name:'Mary'}]}}]
};
test('Reports statistics has four independent categories',()=>assert.deepEqual(TRAINING_STATS_CATEGORIES.map(x=>x.id),['quick','registered','toolbox','training']));
test('Counts true registrations, separate sessions and signed/name attendance only',()=>{
 const s=summarizeTrainingStats(data,{now});
 assert.equal(s.groups.quick.length,2);assert.equal(s.groups.registered.length,1);
 assert.equal(s.groups.toolbox.length,1);assert.equal(s.groups.training.length,1);
 assert.equal(s.attendance,3);assert.equal(s.orientationRecords,3);assert.equal(s.nonDuplicatedRegistrations,2);
 assert.equal(namedAttendance({attendees:'25 workers',attendance_signatures:[]}),0);
});
test('Filters by jobsite and calendar periods without including drafts',()=>{
 const s=summarizeTrainingStats(data,{project:'p1',period:'today',now});
 assert.equal(s.groups.quick.length,0);assert.equal(s.groups.registered.length,0);assert.equal(s.groups.toolbox.length,1);assert.equal(s.groups.training.length,0);
 const y=summarizeTrainingStats(data,{project:'p1',period:'7d',now});
 assert.equal(y.groups.quick.length,1);assert.equal(y.groups.registered.length,1);
});
test('Report Center imports and mounts the isolated panel',()=>{
 const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(src,/mountReportCenterTrainingStatistics/);assert.match(src,/id="report-center-training-stats"/);
});
test('Panel renders filters and categories without mutating external modules',async()=>{
 const dom=new JSDOM('<div id="slot"></div>',{url:'https://localhost.test'}),before=globalThis.document,option=globalThis.Option;
 globalThis.document=dom.window.document;globalThis.Option=dom.window.Option;
 try{
  const query=(table)=>({select(){return this},in(){return this},order(){return this},range(){return Promise.resolve({data:table==='quick_safety_orientations'?data.quick:table==='safety_orientations'?data.registered:data.tools,error:null})}});
  mountReportCenterTrainingStatistics({db:{from:query},root:document.querySelector('#slot'),projects:[{id:'p1',name:'Project One'},{id:'p2',name:'Project Two'}],currentProjectId:'p1',tr:en=>en,isCurrent:()=>true});
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(document.querySelectorAll('.ge-stats-card').length,4);
  assert.equal(document.querySelector('.ge-stats-card').querySelector('strong').textContent,'1');
  document.querySelector('.ge-stats-project').value='all';document.querySelector('.ge-stats-project').dispatchEvent(new dom.window.Event('change'));
  assert.equal(document.querySelector('.ge-stats-card').querySelector('strong').textContent,'2');
 }finally{globalThis.document=before;globalThis.Option=option}
});