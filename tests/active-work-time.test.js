import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createActiveClock,formatActiveTime,installActiveWorkTime} from '../src/active-work-time.js';
const context={userId:'u',projectId:'p',device:'tablet'};
test('active clock pauses after two idle minutes and resumes without counting the idle gap',()=>{
 const clock=createActiveClock();let total=0;
 for(let now=0;now<=180000;now+=5000)total+=clock({now,context,visible:true,focused:true})?.duration||0;
 assert.equal(total,120000);assert.equal(clock({now:185000,context,visible:true,focused:true,interacted:true}),null);
 assert.equal(clock({now:190000,context,visible:true,focused:true}).duration,5000);
});
test('hidden tabs, focus loss, suspension and project/account changes do not accrue time',()=>{
 const clock=createActiveClock(),tick=(now,extra={})=>clock({now,context,visible:true,focused:true,...extra});
 tick(0);assert.equal(tick(5000).duration,5000);assert.equal(tick(10000,{visible:false}),null);assert.equal(tick(15000),null);assert.equal(tick(20000,{focused:false}),null);assert.equal(tick(25000),null);assert.equal(tick(900000),null);assert.equal(tick(905000,{context:{...context,projectId:'other'}}),null);assert.equal(tick(910000,{context:{...context,userId:'other'}}),null);
});
test('time labels distinguish seconds, minutes and hours',()=>{
 assert.equal(formatActiveTime(0),'0 s');assert.equal(formatActiveTime(45000),'45 s');assert.equal(formatActiveTime(125000),'2 min');assert.equal(formatActiveTime(9300000),'2 h 35 min');
});
test('offline retries reuse IDs and reloads keep pending time without attributing it to another account',async()=>{
 let now=0,uid='u',fail=true,serial=0;const saved=new Map(),writes=[],doc=new EventTarget(),win=new EventTarget();
 Object.assign(doc,{visibilityState:'visible',hasFocus:()=>true});
 Object.assign(win,{screen:{width:1024},performance:{now:()=>now},crypto:{randomUUID:()=>String(++serial)},sessionStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},setInterval:()=>1,clearInterval(){}});
 const db={from:()=>({upsert:async(rows,options)=>{writes.push({rows:structuredClone(rows),options});return {error:fail?Error('offline'):null}}})};
 let tracker=installActiveWorkTime({db,getContext:()=>({userId:uid,projectId:'p'}),window:win,document:doc});now=5000;await tracker.flush();assert.equal(writes[0].rows[0].metric_value,5000);await tracker.stop();
 uid='other';tracker=installActiveWorkTime({db,getContext:()=>({userId:uid,projectId:'p'}),window:win,document:doc});await tracker.flush();assert.equal(writes.length,2);
 uid='u';fail=false;await tracker.flush();assert.equal(writes[2].rows[0].session_id,writes[0].rows[0].session_id);assert.equal(writes[2].options.ignoreDuplicates,true);await tracker.stop();assert.equal(writes.length,3);
});
