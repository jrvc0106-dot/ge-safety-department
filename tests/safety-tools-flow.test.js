import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createSafetyTools} from '../src/safety-tools.js';

function setup(options={}){
 const dom=new JSDOM('<main></main>',{url:'https://test.invalid'});
 for(const key of ['document','FormData','Event','Image'])globalThis[key]=key==='document'?dom.window.document:dom.window[key];
 dom.window.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}});
 const writes=[],nav=[],errors=[];const state={project:'job-a',profile:{id:'author',name:'Inspector',role:'admin'},projects:[{id:'job-a',name:'Project A',address:'Address',general_contractor:'GC'}]};
 let pending=null;
 const db={from(name){let payload,filter={},range=[0,49];const q={select(){return q},eq(k,v){filter[k]=v;return q},ilike(k,v){filter[k]=v;return q},order(){return q},limit(){return q},range(a,b){range=[a,b];return q},insert(p){payload=p;return q},single(){return q},maybeSingle(){return q},then(resolve,reject){if(pending)return pending.then(resolve,reject);let data=[];if(payload){writes.push({name,payload});data={id:payload.id}}else if(name==='safety_tool_records'&&options.records)data=options.records.slice(range[0],range[1]+1);else if(name==='safety_tool_records')data={...writes.at(-1)?.payload,created_at:'2026-10-01T12:00:00Z',creator:{name:'Inspector'}};else if(name==='safety_orientations')data={employee_name:'Sample Employee',sticker_number:'GE123',certificate_photo_paths:[]};return Promise.resolve({data,error:null}).then(resolve,reject)}};return q},storage:{from(){return {upload:async()=>({error:null}),remove:async()=>({error:null})}}}};
 const ctx={db,state,tr:x=>x,frame:html=>document.querySelector('main').innerHTML=html,navigate:(...v)=>nav.push(v),captureView:()=>()=>options.current!==false,error:e=>errors.push(e.message),confirmAction(){},enableAutoDraft:async f=>f.dataset.autoDraft='true',draftFilesFor:async()=>[],clearDraft:async()=>{},normalizeReportImage:async f=>f,signedDisplayImage:async()=>''};
 return {ctx,tools:createSafetyTools(ctx),writes,nav,errors,dom,state,hold:p=>pending=p};
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

test('new lists paginate beyond 100 records and retain search on loaded rows',async()=>{
 const t=setup({records:Array.from({length:101},(_,i)=>({id:String(i),report_number:'TB-'+i,created_at:'2026-10-01'}))});
 await t.tools.list('toolbox');assert.equal(document.querySelectorAll('[data-tool-record]').length,50);
 await document.querySelector('#st-more').onclick();await document.querySelector('#st-more').onclick();
 assert.equal(document.querySelectorAll('[data-tool-record]').length,101);assert.equal(document.querySelector('#st-more').hidden,true);
 const search=document.querySelector('#st-search');search.value='TB-100';search.oninput();assert.equal(document.querySelectorAll('[data-tool-record]:not([hidden])').length,1);t.dom.window.close();
});
test('late list response cannot append records after changing project',async()=>{
 const options={records:[]},t=setup(options);let release;t.hold(new Promise(r=>release=r));const pending=t.tools.list('toolbox');options.current=false;document.querySelector('main').innerHTML='<p>Other project</p>';release({data:[{id:'old'}],error:null});await pending;assert.equal(document.querySelector('main').textContent,'Other project');t.dom.window.close();
});
test('failed QR lookup clears the previous record and its saved draft evidence',async()=>{
 const t=setup();await t.tools.form('qr');document.querySelector('#st-code').value='GE123';await document.querySelector('#st-find').onclick();
 const f=document.querySelector('form');assert.ok(f.elements.lookup.value);document.querySelector('#st-code').value='https://invalid.example';await document.querySelector('#st-find').onclick();
 assert.equal(f.elements.lookup.value,'');assert.equal(f.elements.lookup_evidence.value,'');await f.onsubmit({preventDefault(){}});assert.equal(t.writes.length,0);t.dom.window.close();
});
test('invalid gallery QR cannot leave the previous employee selected',async()=>{
 const t=setup();await t.tools.form('qr');document.querySelector('#st-code').value='GE123';await document.querySelector('#st-find').onclick();
 await document.querySelector('#st-qr-file').onchange({target:{files:[{size:11*1024*1024}]}});
 assert.equal(document.querySelector('form').elements.lookup.value,'');assert.match(t.errors.at(-1),/10 MB/);t.dom.window.close();
});
test('form stays inert while saving and is unlocked after a failed save',async()=>{
 const t=setup();await t.tools.form('hazard');const f=document.querySelector('form');let release;t.hold(new Promise(r=>release=r));const saving=f.onsubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(f.inert,true);release({data:null,error:new Error('Network failed')});await saving;assert.equal(f.inert,false);assert.equal(t.nav.length,0);assert.match(t.errors[0],/Network failed/);t.dom.window.close();
});
test('report photos load in bounded parallel batches without changing their order',async()=>{
 const t=setup();await t.tools.form('hazard');await document.querySelector('form').onsubmit({preventDefault(){}});
 t.writes[0].payload.photos=Array.from({length:7},(_,i)=>({path:String(i),label:'Photo '+i}));
 let active=0,peak=0;t.ctx.signedDisplayImage=async(bucket,path)=>{active++;peak=Math.max(peak,active);await new Promise(r=>setImmediate(r));active--;return 'https://example.invalid/'+path};
 await createSafetyTools(t.ctx).report(t.writes[0].payload.id);assert.equal(peak,4);assert.deepEqual([...document.querySelectorAll('.ewr-photo-card img')].map(x=>x.getAttribute('src')),Array.from({length:7},(_,i)=>'https://example.invalid/'+i));t.dom.window.close();
});
