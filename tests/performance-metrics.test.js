import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordPageLoad,recordPerformanceMetric} from '../src/performance-metrics.js';

test('performance events keep only bounded, allowlisted metrics and attach device/session context',async()=>{
 const writes=[],original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=> 'test-session',setItem(){}}});
 const db={from:table=>({upsert:async(row,options)=>{writes.push({table,row,options});return {error:null}}})};
 try{
  await recordPerformanceMetric(db,{projectId:'job-1',userId:'safety-1',page:'safetyWalkReport:download',metric:'pdf_action',duration:12.36});
  assert.equal(writes.length,1);
  assert.equal(writes[0].table,'app_performance_events');
  assert.equal(writes[0].row.metric,'pdf_action');
  assert.equal(writes[0].row.metric_value,12.4);
  assert.equal(writes[0].row.session_id,'test-session');
  const width=globalThis.screen?.width||globalThis.innerWidth||0;
  assert.equal(writes[0].row.device_category,width>=700&&width<=1400?'tablet':width<700?'phone':width>1400?'desktop':'other');
  assert.deepEqual(writes[0].options,{onConflict:'project_id,user_id,session_id,page,metric'});
  await recordPerformanceMetric(db,{projectId:'job-1',userId:'safety-1',page:'safetyWalkReport:download',metric:'private-content',duration:12});
  await recordPerformanceMetric(db,{projectId:'job-1',userId:'safety-1',page:'safetyWalkReport:download',metric:'pdf_failure',duration:-1});
  assert.equal(writes.length,1);
 }finally{
  if(original)Object.defineProperty(globalThis,'sessionStorage',original);
  else delete globalThis.sessionStorage;
 }
});

test('page load metrics retain the existing load event contract',async()=>{
 const writes=[];
 const original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=> 'session-2',setItem(){}}});
 try{
  await recordPageLoad({from:()=>({upsert:async(row)=>{writes.push(row);return {error:null}}})},{projectId:'job-1',userId:'safety-1',page:'home',duration:45});
  assert.equal(writes[0].metric,'load');
  assert.equal(writes[0].metric_value,45);
 }finally{
  if(original)Object.defineProperty(globalThis,'sessionStorage',original);
  else delete globalThis.sessionStorage;
 }
});
