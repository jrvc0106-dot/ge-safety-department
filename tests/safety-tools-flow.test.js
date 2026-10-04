import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createSafetyTools,toolsHomeMarkup} from '../src/safety-tools.js';
import {canCreateTool,canReadTool} from '../src/safety-tools-model.js';

function setup(options={}){
 const dom=new JSDOM('<main></main>',{url:'https://test.invalid'});
 for(const key of ['document','FormData','Event','Image'])globalThis[key]=key==='document'?dom.window.document:dom.window[key];
 dom.window.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}});
 const writes=[],nav=[],errors=[],observationQueries=[],uploads=[];const state={project:'job-a',profile:{id:'author',name:'Inspector',role:'admin'},projects:[{id:'job-a',name:'Project A',address:'Address',general_contractor:'GC'}]};
 let pending=null;
 const db={from(name){let payload,filter={},range=[0,49],selection='';const q={select(columns=''){selection=columns;return q},eq(k,v){filter[k]=v;return q},in(k,v){filter[k]=v;return q},ilike(k,v){filter[k]=v;return q},order(){return q},limit(){return q},range(a,b){range=[a,b];return q},insert(p){payload=p;return q},single(){return q},maybeSingle(){return q},then(resolve,reject){if(pending)return pending.then(resolve,reject);let data=[];if(payload){writes.push({name,payload});data={id:payload.id}}else if(name==='incident_reports')data=options.incidents||[];else if(name==='employee_medical_followups'){const record=writes.find(x=>x.name===name)?.payload;if(selection.startsWith('*,')&&selection.includes('incident:'))data=record?{...record,created_at:'2026-10-04T12:00:00Z',incident:(options.incidents||[]).find(i=>i.id===record.incident_id),creator:{name:'Safety Director'}}:null;else if(selection.includes('incident:'))data=record?[{...record,created_at:'2026-10-04T12:00:00Z',incident:(options.incidents||[]).find(i=>i.id===record.incident_id)}]:[];else data=record?[{...record,created_at:'2026-10-04T12:00:00Z'}]:[]}else if(name==='employee_medical_followup_documents')data=options.documents||[];else if(name==='observations'){observationQueries.push({filter:{...filter},range:[...range]});data=(options.observations||[]).filter(row=>!filter.project_id||(Array.isArray(filter.project_id)?filter.project_id.includes(row.project_id):row.project_id===filter.project_id)).slice(range[0],range[1]+1)}else if(name==='safety_tool_records'&&options.records)data=options.records.slice(range[0],range[1]+1);else if(name==='safety_tool_records')data={...writes.at(-1)?.payload,created_at:'2026-10-01T12:00:00Z',creator:{name:'Inspector'}};else if(name==='safety_orientations')data={employee_name:'Sample Employee',sticker_number:'GE123',certificate_photo_paths:[]};return Promise.resolve({data,error:null}).then(resolve,reject)}};return q},storage:{from(bucket){return {upload:async(path,file)=>{uploads.push({bucket,path,file});return {error:null}},remove:async()=>({error:null})}}}};
 const ctx={db,state,tr:x=>x,frame:html=>document.querySelector('main').innerHTML=html,navigate:(...v)=>nav.push(v),captureView:()=>()=>options.current!==false,error:e=>errors.push(e.message),confirmAction(){},enableAutoDraft:async f=>f.dataset.autoDraft='true',draftFilesFor:async()=>[],clearDraft:async()=>{},normalizeReportImage:async f=>f,signedDisplayImage:async()=>''};
 return {ctx,tools:createSafetyTools(ctx),writes,nav,errors,dom,state,observationQueries,uploads,options,hold:p=>pending=p};
}
for(const kind of ['toolbox','training','safety_net','emergency','director','hazard'])test(`${kind}: incomplete form saves to original project and opens matching report`,async()=>{
 const t=setup();await t.tools.form(kind);const f=document.querySelector('form');assert.ok(f);if(f.elements.topic)f.elements.topic.value='Sample topic';if(kind==='training'){f.elements.training_type.value='forklift';f.elements.training_date.value='2026-10-01';document.querySelector('[data-add-participant]').click();f.elements.jha_participant_0_name.value='Crew Member'}f.elements.jha_safety_name.value='Assigned Safety';f.elements.jha_safety_signature.value='[[[0.1,0.2],[0.3,0.4]]]';
 await f.onsubmit({preventDefault(){}});assert.deepEqual(t.errors,[]);assert.equal(t.writes.length,1);assert.equal(t.writes[0].payload.project_id,'job-a');assert.equal(t.writes[0].payload.kind,kind);assert.equal(t.writes[0].payload.payload.approvals.safety.name,'Assigned Safety');assert.equal(t.writes[0].payload.payload.approvals.safety.strokes.length,1);if(kind==='training'){assert.equal(t.writes[0].payload.payload.training_type,'forklift');assert.equal(t.writes[0].payload.payload.attendance_signatures[0].name,'Crew Member')}assert.equal(t.nav[0][0],'safetyToolReport');
 await t.tools.report(t.writes[0].payload.id);assert.ok(document.querySelector('article.report'));assert.match(document.querySelector('h1').textContent,/By G&E$/);assert.match(document.querySelector('article.report').textContent,/Assigned Safety/);assert.equal(document.querySelectorAll('.report-signatures img').length,1);t.dom.window.close();
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

test('director summary pages all authorized projects together and excludes other projects',async()=>{
 const rows=Array.from({length:501},(_,i)=>({id:String(i),project_id:i===500?'job-b':'job-a',status:'open',priority:'high'}));rows.push({id:'outside',project_id:'other',status:'open',priority:'high'});
 const t=setup({observations:rows});t.state.projects.push({id:'job-b',name:'Project B'});await t.tools.form('director');
 assert.equal(t.observationQueries.length,2);assert.deepEqual(t.observationQueries[0].filter.project_id,['job-a','job-b']);
 assert.match(document.querySelector('.st-summary').textContent,/Open: 500/);assert.match(document.querySelector('.st-summary').textContent,/Open: 1/);assert.doesNotMatch(document.querySelector('.st-summary').textContent,/other/);t.dom.window.close();
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

test('saved safety tool report survives draft cleanup failure and opens normally',async()=>{
 const t=setup();t.ctx.clearDraft=async()=>{throw Error('Draft cleanup offline')};const tools=createSafetyTools(t.ctx);
 await tools.form('hazard');await document.querySelector('form').onsubmit({preventDefault(){}});
 assert.equal(t.writes.length,1);assert.equal(t.errors.length,0);assert.equal(t.nav[0][0],'safetyToolReport');t.dom.window.close();
});

test('medical follow-up starts without an incident and saves appointment, reported condition, medications, and work status',async()=>{
 const t=setup({incidents:[]});const tools=createSafetyTools(t.ctx);await tools.form('medical_followup');const f=document.querySelector('#st-medical_followup-form');
 assert.ok(f);assert.equal(f.dataset.autoDraft,undefined);assert.equal(f.elements.photos,undefined);f.elements.employee_name.value='Case Worker';f.elements.event_date.value='2026-10-04';f.elements.last_appointment_date.value='2026-10-02';f.elements.next_appointment_date.value='2026-10-09';f.elements.current_condition_summary.value='Recovering; reports improving mobility';f.elements.reported_medications.value='Employee-reported medication';f.elements.work_status.value='temporary_restrictions';f.elements.work_restrictions_summary.value='No ladder work';
 await f.onsubmit({preventDefault(){}});assert.equal(t.errors.length,0);const saved=t.writes.find(x=>x.name==='employee_medical_followups').payload;
 assert.equal(saved.project_id,'job-a');assert.equal(saved.employee_name,'Case Worker');assert.equal(saved.incident_id,undefined);assert.equal(saved.last_appointment_date,'2026-10-02');assert.equal(saved.next_appointment_date,'2026-10-09');assert.equal(saved.current_condition_summary,'Recovering; reports improving mobility');assert.equal(saved.reported_medications,'Employee-reported medication');assert.equal(saved.clearance_received,false);assert.equal(saved.work_restrictions_summary,'No ladder work');assert.equal('photos' in saved,false);
 await tools.report(saved.id);const report=document.querySelector('article.report');assert.ok(report);assert.match(report.textContent,/Case Worker/);assert.match(report.textContent,/No ladder work/);assert.match(report.textContent,/improving mobility/);assert.match(report.textContent,/Employee-reported medication/);assert.match(report.textContent,/2026-10-09/);assert.match(report.textContent,/CONFIDENTIAL/);assert.equal(report.dataset.toolKind,'medical_followup');t.dom.window.close();
});

test('medical report captures document photos, uploads privately, and includes them in its final report',async()=>{
 const t=setup();t.ctx.signedDisplayImage=async(bucket,path)=>`blob:${bucket}:${path}`;const tools=createSafetyTools(t.ctx);await tools.form('medical_followup');const f=document.querySelector('#st-medical_followup-form'),input=document.querySelector('#st-medical-documents');
 assert.equal(input.getAttribute('capture'),'environment');assert.equal(input.multiple,true);assert.equal(f.dataset.autoDraft,undefined);
 f.elements.employee_name.value='Case Worker';f.elements.event_date.value='2026-10-04';f.elements.current_condition_summary.value='Recovering';
 const photo={name:'patient-private-record.jpg',type:'image/jpeg',size:2048};Object.defineProperty(input,'files',{configurable:true,value:[photo]});input.onchange({target:input});assert.match(document.querySelector('#st-medical-document-list').textContent,/Medical document 1/);
 await f.onsubmit({preventDefault(){}});assert.equal(t.errors.length,0);assert.equal(t.uploads.length,1);assert.equal(t.uploads[0].bucket,'employee-medical-documents');assert.match(t.uploads[0].path,/^job-a\/author\//);
 const doc=t.writes.find(x=>x.name==='employee_medical_followup_documents').payload[0];assert.equal(doc.project_id,'job-a');assert.equal(doc.mime_type,'image/jpeg');assert.equal('file_name' in doc,false);
 t.options.documents=[{storage_path:doc.storage_path,document_number:1,mime_type:doc.mime_type,size_bytes:doc.size_bytes}];await tools.report(t.writes.find(x=>x.name==='employee_medical_followups').payload.id);
 assert.equal(document.querySelectorAll('.st-medical-report .ewr-photo-card img').length,1);assert.match(document.querySelector('article.report').textContent,/Medical document photos/);assert.match(document.querySelector('.st-medical-report .ewr-photo-card img').getAttribute('src'),/^blob:employee-medical-documents:/);t.dom.window.close();
});

for(const failure of ['empty','rejected'])test(`QR final report preserves evidence integrity when an orientation image is ${failure}`,async()=>{
 const t=setup();await t.tools.form('hazard');await document.querySelector('form').onsubmit({preventDefault(){}});
 t.writes[0].payload.kind='qr';t.writes[0].payload.payload.lookup_evidence=[{bucket:'orientation-photos',path:'face',label:'Employee Face ID'}];
 t.ctx.signedDisplayImage=async()=>{if(failure==='rejected')throw Error('Evidence unavailable');return ''};
 document.querySelector('main').innerHTML='<p>Previous view</p>';
 await assert.rejects(createSafetyTools(t.ctx).report(t.writes[0].payload.id),/Evidence/);
 assert.equal(document.querySelector('article.report'),null);t.dom.window.close();
});

test('assigned Safety coordinators can open, create, and read medical follow-up in their selected project',async()=>{
 const t=setup();t.state.profile.role='safety';
 assert.equal(canReadTool('medical_followup','safety'),true);assert.equal(canCreateTool('medical_followup','safety'),true);
 assert.equal(canReadTool('medical_followup','worker'),false);assert.equal(canReadTool('director','safety'),false);
 assert.match(toolsHomeMarkup('safety',x=>x),/data-safety-tool="medical_followup"/);
 await t.tools.list('medical_followup');assert.ok(document.querySelector('#st-new'));
 document.querySelector('#st-new').onclick();assert.deepEqual(t.nav[0],['safetyToolForm','medical_followup']);
 await t.tools.form('medical_followup');const f=document.querySelector('#st-medical_followup-form');
 f.elements.employee_name.value='Case Worker';f.elements.event_date.value='2026-10-04';f.elements.current_condition_summary.value='Employee-reported status';
 await f.onsubmit({preventDefault(){}});
 assert.equal(t.errors.length,0);const saved=t.writes.find(x=>x.name==='employee_medical_followups').payload;
 assert.equal(saved.project_id,'job-a');assert.equal(saved.employee_name,'Case Worker');assert.equal(saved.incident_id,undefined);
 await t.tools.report(saved.id);assert.equal(document.querySelector('article.report')?.dataset.toolKind,'medical_followup');
 assert.match(document.querySelector('article.report').textContent,/Safety Coordinators assigned to this jobsite/);
 t.dom.window.close();
});
