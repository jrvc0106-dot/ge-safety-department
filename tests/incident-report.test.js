import {reportApprovals,reportSignaturesReport} from '../src/report-signatures.js';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {parseAst} from 'rollup/parseAst';
import {ACCIDENT_MECHANISMS,attachIncidentOptions} from '../src/incident-options.js';
import {orientationSnapshot} from '../src/incident-employee.js';
import {renderIncidentReport} from '../src/incident-report-template.js';
const tr=(en,es)=>en,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
test('accident mechanisms have unique stable values and bilingual labels',()=>{assert.equal(ACCIDENT_MECHANISMS.length,23);assert.equal(new Set(ACCIDENT_MECHANISMS.map(x=>x[0])).size,23);assert.ok(ACCIDENT_MECHANISMS.every(x=>x.every(Boolean)))});
test('Near Miss controls follow restored classification without clearing fields',()=>{
 const type={value:'near_miss'},potential={hidden:true},label={},buttons=['injury','near_miss'].map(value=>({dataset:{eventMode:value},setAttribute(k,v){this[k]=v}}));let update;
 const form={elements:{namedItem:()=>type},querySelectorAll:()=>buttons,querySelector:s=>s==='[data-near-miss]'?potential:label,addEventListener(_,f){update=f}};
 attachIncidentOptions(form,tr);assert.equal(potential.hidden,false);assert.equal(label.textContent,'Potential severity');assert.equal(buttons[1]['aria-pressed'],'true');type.value='injury';update();assert.equal(potential.hidden,true);assert.equal(label.textContent,'Severity');type.value='near_miss';update();assert.equal(potential.hidden,false);
});
test('Near Miss report preserves consequences, mechanism, captions and investigation fields',()=>{
 const html=renderIncidentReport({incident_type:'near_miss',accident_mechanism:'falling_object',potential_outcome:'Could strike a worker',severity:'serious',report_number:'NM-42',project:{name:'Job',address:'Miami'},witnesses:[{name:'Witness',statement:'Saw the object'}],corrective_actions:'Secure materials',supervisor_name:'Foreman'},[{url:'blob:photo',caption:'<unsafe & object>'}],{tr,esc,fmt:x=>x||''});
 for(const text of ['Near Miss Report By G&amp;E','Falling object','Could strike a worker','Saw the object','Secure materials','Foreman','&lt;unsafe &amp; object&gt;'])assert.ok(html.includes(text),text);
 assert.ok(html.includes('data-incident-type="near_miss"'));assert.ok(!html.includes('<unsafe'));
 const headings=[...html.matchAll(/<h2><span>(\d+)<\/span>/g)].map(x=>Number(x[1]));assert.deepEqual(headings,Array.from({length:headings.length},(_,i)=>i+1));
});
test('legacy accident records render in Spanish without new fields',()=>{
 const html=renderIncidentReport({incident_type:'injury',report_number:'IR-old',witnesses:[]},[],{tr:(_,es)=>es,esc,fmt:()=>''});assert.ok(html.includes('Reporte de Incidente / Accidente By G&amp;E'));assert.ok(html.includes('Sin especificar'));assert.ok(!html.includes('undefined'));
});
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),ast=parseAst(source),node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='incidentReportForm'),formSource=source.slice(node.start,node.end);
function setup(extra={},cleanupFails=false){
 const writes=[],errors=[],button={disabled:false},form={dataset:{},querySelector:()=>button},warning={};
 const values={incident_type:'near_miss',accident_mechanism:'falling_object',potential_outcome:'Could strike someone',severity:'serious',what_happened:'Fell onto a barricaded area',...extra};
 const db={from(table){const q={insert(payload){writes.push({table,payload});return q},update(payload){writes.push({table,update:payload});return q},eq(){return q},delete(){writes.push({table,delete:true});return q},select(){return q},single:async()=>({data:{id:'new-report'},error:null}),then(resolve,reject){return Promise.resolve({error:null}).then(resolve,reject)}};return q},storage:{from:()=>({remove:async()=>({})})}};
 const context=vm.createContext({reportApprovals,reportSignaturesReport,mountReportSignatures(){},attachAggregateSignatures:async()=>{},enableAutoDraft(){},clearDraft(){},confirmAction(){},state:{project:'job',profile:{id:'owner',name:'Safety'},projects:[{id:'job'}]},captureView:()=>()=>true,frame(){},tr,esc,db,document:{querySelector:s=>s==='#severe-warning'?warning:form},attachIncidentOptions(){},attachIncidentEmployee(){},signedDisplayImage(){},orientationSnapshot,ACCIDENT_MECHANISMS,FormData:class{get(name){return values[name]||''}},draftFilesFor:async()=>[],localDateKey:()=> '20260930',crypto:{randomUUID:()=> 'abc123'},clearDraft:async()=>{if(cleanupFails)throw Error('Cleanup offline')},savedAction(){},navigate(){},error:err=>errors.push(err.message),console:{warn(){}}});
 vm.runInContext(formSource,context);context.incidentReportForm();return {writes,errors,form,submit:()=>form.onsubmit({preventDefault(){}})};
}
test('Near Miss saves its mechanism and consequences with a separate report number',async()=>{const t=setup();await t.submit();assert.deepEqual(t.errors,[]);const p=t.writes.find(x=>x.payload)?.payload;assert.equal(p.incident_type,'near_miss');assert.equal(p.accident_mechanism,'falling_object');assert.equal(p.potential_outcome,'Could strike someone');assert.match(p.report_number,/^NM-/);assert.ok(t.writes.some(x=>x.update?.status==='final'))});
test('Near Miss with documented injury outcomes preserves draft and refuses conflicting classification',async()=>{const t=setup({amputation:'on'});await t.submit();assert.equal(t.writes.length,0);assert.equal(t.errors.length,1);assert.equal(t.form.dataset.submitting,undefined)});
test('saved final incident survives a later draft cleanup failure',async()=>{const t=setup({incident_type:'injury'},true);await t.submit();assert.deepEqual(t.errors,[]);assert.ok(t.writes.some(x=>x.update?.status==='final'));assert.ok(!t.writes.some(x=>x.delete))});

test('incident save retains the selected employee orientation snapshot',async()=>{const t=setup({employee_orientation_snapshot:JSON.stringify({sticker_number:'GE42',employee_name:'Worker',employee_position:'Carpenter',certificate_photo_paths:['certificate']})});await t.submit();assert.deepEqual(t.errors,[]);const snapshot=t.writes.find(x=>x.payload).payload.employee_orientation_snapshot;assert.equal(snapshot.sticker_number,'GE42');assert.deepEqual(snapshot.certificate_photo_paths,['certificate'])});

