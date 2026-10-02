import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {REPORT_SIGNATURE_ROLES,mountReportSignatures,reportApprovals,reportSignaturesReport,restoreReportSignatures,toggleQrSignatures} from '../src/report-signatures.js';
import {mountAttendance,attendanceApprovals,attendanceReport} from '../src/report-attendance.js';
import {attachAggregateSignatures} from '../src/aggregate-signatures.js';
function fixture(){
 const dom=new JSDOM('<main><form><input name="lookup_type" value="employee"><button type="submit">Save</button></form></main>');
 for(const key of ['document','Event','FormData'])globalThis[key]=key==='document'?dom.window.document:dom.window[key];
 dom.window.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}});
 return {dom,form:document.querySelector('form')};
}
for(const [kind,roles] of Object.entries(REPORT_SIGNATURE_ROLES))test(`${kind}: editable names and signatures round-trip with the correct roles`,()=>{
 const {dom,form}=fixture();mountReportSignatures(form,kind,x=>x);
 const records=Object.fromEntries(roles.map((role,i)=>[role,{name:`Updated ${role} ${i}`,strokes:[[[.1,.2],[.7,.8]]]}]));
 restoreReportSignatures(form,kind,records);
 assert.deepEqual(reportApprovals(kind,new FormData(form)),records);
 const pdf=new JSDOM(reportSignaturesReport(kind,records,x=>x)).window.document;
 assert.equal(pdf.querySelectorAll('img').length,roles.length);
 assert.deepEqual([...pdf.querySelectorAll('strong')].map(x=>x.textContent),roles.map(r=>records[r].name));
 if(kind==='director')assert.match(pdf.body.textContent,/Safety Director/);
 dom.window.close();
});
test('equipment QR verification uses Foreman; employee verification uses employee',()=>{
 const {dom,form}=fixture();mountReportSignatures(form,'qr',x=>x);form.elements.lookup_type.value='equipment';toggleQrSignatures(form,'equipment');
 form.elements.jha_foreman_name.value='Equipment Foreman';form.elements.jha_employee_name.value='Previous employee';
 const saved=reportApprovals('qr',new FormData(form));assert.equal(saved.foreman.name,'Equipment Foreman');assert.equal(saved.employee,undefined);
 assert.match(reportSignaturesReport('qr',saved,x=>x),/Foreman/);assert.ok(!reportSignaturesReport('qr',saved,x=>x).includes('Previous employee'));
 toggleQrSignatures(form,'employee');form.elements.lookup_type.value='employee';assert.equal(reportApprovals('qr',new FormData(form)).foreman,undefined);dom.window.close();
});
test('Toolbox attendance preserves participant signatures in drafts and final reports',()=>{
 const t=fixture();mountAttendance(t.form,x=>x);const hidden=t.form.elements.attendance_signatures;
 hidden.value=JSON.stringify([{name:'Worker A',strokes:[[[.1,.2],[.3,.4]]]},{name:'Worker B',strokes:[]}]);hidden.dispatchEvent(new Event('change',{bubbles:true}));
 const before=attendanceApprovals(new FormData(t.form));assert.equal(before[0].name,'Worker A');assert.equal(before[0].strokes.length,1);
 t.form.elements.jha_participant_1_name.value='Worker B Updated';t.form.elements.jha_participant_1_name.dispatchEvent(new Event('input',{bubbles:true}));
 const saved=attendanceApprovals(new FormData(t.form));assert.equal(saved[1].name,'Worker B Updated');assert.match(attendanceReport(saved,x=>x),/Worker B Updated/);
 document.querySelector('[data-add-participant]').click();assert.equal(attendanceApprovals(new FormData(t.form)).length,3);assert.equal(attendanceApprovals(new FormData(t.form))[0].strokes.length,1);t.dom.window.close();
});
function aggregateFixture(options={}){
 const t=fixture();document.querySelector('main').innerHTML='<article class="report"><section data-aggregate-signatures></section></article>';
 const state={project:'job-a',profile:{id:'owner-a',role:'safety'}},filters=[],writes=[],errors=[],report=document.querySelector('article');let current=true;
 const db={from(){const query={select(){return query},eq(k,v){filters.push([k,v]);return query},maybeSingle:async()=>options.readPromise?await options.readPromise:{data:{approvals:{safety:{name:'Saved Safety',strokes:[]}}}},upsert:async payload=>{writes.push(payload);return {error:options.saveError?Error('offline'):null}}};return query}};
 const args={report,kind:'daily',snapshot:{rows:[{id:'one',description:options.description||'Hazard'}]},state,db,tr:x=>x,isCurrent:()=>current,enableAutoDraft:async()=>{},clearDraft:async()=>{},confirmAction(){},error:e=>errors.push(e.message)};
 return {...t,args,state,report,filters,writes,errors,leave(){current=false}};
}
test('aggregate signatures belong to the captured jobsite and report snapshot',async()=>{
 const t=aggregateFixture();await attachAggregateSignatures(t.args);const form=document.querySelector('form');assert.equal(t.report.dataset.loading,'false');assert.match(t.report.textContent,/Saved Safety/);
 form.elements.jha_safety_name.value='Edited Safety';t.state.project='job-b';t.state.profile.id='other-user';await form.onsubmit({preventDefault(){}});
 assert.equal(t.writes[0].project_id,'job-a');assert.equal(t.writes[0].created_by,'owner-a');assert.equal(t.writes[0].snapshot_key.length,64);assert.equal(t.writes[0].approvals.safety.name,'Edited Safety');const firstKey=t.writes[0].snapshot_key;t.dom.window.close();
 const changed=aggregateFixture({description:'Changed hazard'});await attachAggregateSignatures(changed.args);await document.querySelector('form').onsubmit({preventDefault(){}});assert.notEqual(changed.writes[0].snapshot_key,firstKey);changed.dom.window.close();
});
test('failed aggregate save leaves the previously saved PDF names intact and allows retry',async()=>{
 const t=aggregateFixture({saveError:true});await attachAggregateSignatures(t.args);const form=document.querySelector('form');form.elements.jha_safety_name.value='Unsaved name';await form.onsubmit({preventDefault(){}});
 assert.match(t.report.textContent,/Saved Safety/);assert.ok(!t.report.textContent.includes('Unsaved name'));assert.deepEqual(t.errors,['offline']);assert.equal(form.querySelector('button[type=submit]').disabled,false);t.dom.window.close();
});
test('late signature lookup cannot replace another jobsite screen',async()=>{
 let resolve;const t=aggregateFixture({readPromise:new Promise(r=>resolve=r)});const pending=attachAggregateSignatures(t.args);await new Promise(r=>setImmediate(r));t.leave();resolve({data:{approvals:{safety:{name:'Wrong project'}}}});await pending;
 assert.ok(!t.report.textContent.includes('Wrong project'));assert.equal(document.querySelector('.aggregate-signature-editor'),null);t.dom.window.close();
});
