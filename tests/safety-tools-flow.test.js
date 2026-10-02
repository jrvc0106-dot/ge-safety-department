import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createSafetyTools} from '../src/safety-tools.js';

function setup(){
 const dom=new JSDOM('<main></main>',{url:'https://test.invalid'});
 for(const key of ['document','FormData','Event','Image'])globalThis[key]=key==='document'?dom.window.document:dom.window[key];
 dom.window.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}});
 const writes=[],nav=[],errors=[];const state={project:'job-a',profile:{id:'author',name:'Inspector',role:'admin'},projects:[{id:'job-a',name:'Project A',address:'Address',general_contractor:'GC'}]};
 let pending=null;
 const db={from(name){let payload,filter={};const q={select(){return q},eq(k,v){filter[k]=v;return q},order(){return q},limit(){return q},range(){return q},insert(p){payload=p;return q},single(){return q},maybeSingle(){return q},then(resolve,reject){if(pending)return pending.then(resolve,reject);let data=[];if(payload){writes.push({name,payload});data={id:payload.id}}else if(name==='safety_tool_records')data={...writes.at(-1)?.payload,created_at:'2026-10-01T12:00:00Z',creator:{name:'Inspector'}};else if(name==='safety_orientations')data={employee_name:'Sample Employee',sticker_number:'GE123',certificate_photo_paths:[]};return Promise.resolve({data,error:null}).then(resolve,reject)}};return q},storage:{from(){return {upload:async()=>({error:null}),remove:async()=>({error:null})}}}};
 const ctx={db,state,tr:x=>x,frame:html=>document.querySelector('main').innerHTML=html,navigate:(...v)=>nav.push(v),captureView:()=>()=>true,error:e=>errors.push(e.message),confirmAction(){},enableAutoDraft:async f=>f.dataset.autoDraft='true',draftFilesFor:async()=>[],clearDraft:async()=>{},normalizeReportImage:async f=>f,signedDisplayImage:async()=>''};
 return {tools:createSafetyTools(ctx),writes,nav,errors,dom,state,hold:p=>pending=p};
}
for(const kind of ['toolbox','safety_net','emergency','director','hazard'])test(`${kind}: incomplete form saves to original project and opens matching report`,async()=>{
 const t=setup();await t.tools.form(kind);const f=document.querySelector('form');assert.ok(f);if(f.elements.topic)f.elements.topic.value='Sample topic';
 await f.onsubmit({preventDefault(){}});assert.deepEqual(t.errors,[]);assert.equal(t.writes.length,1);assert.equal(t.writes[0].payload.project_id,'job-a');assert.equal(t.writes[0].payload.kind,kind);assert.equal(t.nav[0][0],'safetyToolReport');
 await t.tools.report(t.writes[0].payload.id);assert.ok(document.querySelector('article.report'));assert.match(document.querySelector('h1').textContent,/By G&E$/);t.dom.window.close();
});
test('QR lookup requires a matching record, saves a snapshot and renders a report',async()=>{
 const t=setup();await t.tools.form('qr');const f=document.querySelector('form');await f.onsubmit({preventDefault(){}});assert.equal(t.writes.length,0);assert.equal(t.errors.length,1);
 document.querySelector('#st-code').value='GE123';await document.querySelector('#st-find').onclick();assert.match(document.querySelector('#st-lookup-result').textContent,/Sample Employee/);
 await f.onsubmit({preventDefault(){}});assert.equal(t.writes.length,1);assert.equal(t.writes[0].payload.payload.lookup.sticker_number,'GE123');t.dom.window.close();
});
test('double click during save does not create two reports',async()=>{
 const t=setup();await t.tools.form('toolbox');const f=document.querySelector('form');let release;t.hold(new Promise(r=>release=r));
 const a=f.onsubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));await f.onsubmit({preventDefault(){}});release({data:{id:'saved'},error:null});await a;assert.equal(t.nav.length,1);t.dom.window.close();
});
