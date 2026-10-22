import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {safetyTrendTotal,safetyTrendDelta,canViewSafetyAiFindings,mountSafetyIntelligence} from '../src/safety-intelligence.js';
import {JSDOM} from 'jsdom';
test('counts across sources without creating a safety score',()=>{
 assert.equal(safetyTrendTotal({observations:{count:3},incidents:{count:2},walks:{count:7}}),12);
 assert.equal(safetyTrendTotal({}),0);
});
test('compares equal period report counts',()=>{
 assert.equal(safetyTrendDelta(3,7),-4);
 assert.equal(safetyTrendDelta(9,4),5);
});
test('scheduler uses only aggregate non-personal fields and verifies the secret',()=>{
 const source=readFileSync('supabase/functions/safety-trends-scheduler/index.ts','utf8');
 assert.match(source,/verify_safety_trend_job_token/);
 assert.match(source,/x-ge-cron-key/);
 assert.match(source,/\.eq\("project_id",setting\.project_id\)/);
 assert.match(source,/No employee identities|Never access narrative text/);
 assert.doesNotMatch(source,/employee_name,employee_dob|select\("\*"/);
});
test('new report settings have project-level RLS and only two cadences',()=>{
 const sql=readFileSync('supabase/migrations/20261017000000_automatic_safety_intelligence.sql','utf8');
 assert.match(sql,/enable row level security/);
 assert.match(sql,/check \(cadence in \('weekly','monthly'\)\)/);
 assert.match(sql,/grant update\(cadence,enabled,next_run_at,updated_at\)/);
});

test('AI Findings is restricted to administrator and safety director roles',()=>{
 for(const [role,allowed] of [['admin',true],['safety_director',true],['safety',false],['superintendent',false],['supervisor',false],['foreman',false],['worker',false],['',false]]){
  assert.equal(canViewSafetyAiFindings(role),allowed,role);
 }
});
test('Report Center loads aggregate statistics for Safety without requesting protected insights',async()=>{
 const dom=new JSDOM('<section class="report-library"></section>',{url:'https://g-e.test'});
 const original=globalThis.document;globalThis.document=dom.window.document;
 try{
  const queries=[],rpcCalls=[];
  const db={
   from(table){
    const chain={
     select(columns){queries.push({table,columns});return chain},
     eq(){return chain},
     order(){return table==='projects'?Promise.resolve({data:[{id:'p1',name:'Jobsite 1',status:'active'}]}):chain},
     maybeSingle(){return Promise.resolve({data:{project_id:'p1',cadence:'weekly',enabled:true,next_run_at:'2026-10-22T00:00:00Z'}})},
     limit(){return Promise.resolve({data:[{id:'r1',metrics:{current:{observations:{count:2}},previous:{}},computed_at:'2026-10-21T00:00:00Z',ai_status:'complete'}]})}
    };return chain;
   },
   rpc(name){rpcCalls.push(name);return Promise.resolve({data:[{title:'PRIVATE',summary:'Confidential insight',question:'Why?'}],error:null})}
  };
  mountSafetyIntelligence({db,profile:{role:'safety'},projectId:'p1',tr:en=>en});
  await new Promise(resolve=>setTimeout(resolve,30));
  const text=dom.window.document.body.textContent;
  assert.match(text,/Records analyzed/);
  assert.doesNotMatch(text,/AI findings|PRIVATE|Confidential insight/);
  assert.deepEqual(rpcCalls,[]);
  assert.ok(queries.some(q=>q.table==='safety_trend_results'));
  assert.ok(queries.every(q=>!q.columns.includes('insights')));
 }finally{globalThis.document=original;dom.window.close()}
});
test('Safety Director can request AI findings through the authorized RPC',async()=>{
 const dom=new JSDOM('<section class="report-library"></section>',{url:'https://g-e.test'});
 const original=globalThis.document;globalThis.document=dom.window.document;
 try{
  const calls=[];
  const db={
   from(table){
    const chain={
     select(){return chain},eq(){return chain},
     order(){return table==='projects'?Promise.resolve({data:[{id:'p1',name:'Jobsite 1',status:'active'}]}):chain},
     maybeSingle(){return Promise.resolve({data:{project_id:'p1',cadence:'weekly',enabled:true}})},
     limit(){return Promise.resolve({data:[{id:'r1',metrics:{current:{observations:{count:1}},previous:{}},computed_at:'2026-10-21T00:00:00Z',ai_status:'complete'}]})}
    };return chain;
   },
   rpc(name,args){calls.push({name,args});return Promise.resolve({data:[{title:'Finding A',summary:'Director-only conclusion',question:'Review?'}],error:null})}
  };
  mountSafetyIntelligence({db,profile:{role:'safety_director'},projectId:'p1',tr:en=>en});
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.match(dom.window.document.body.textContent,/AI findings/);
  assert.match(dom.window.document.body.textContent,/Director-only conclusion/);
  assert.deepEqual(calls,[{name:'get_safety_ai_findings',args:{p_result_id:'r1'}}]);
 }finally{globalThis.document=original;dom.window.close()}
});
