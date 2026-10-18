import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {parseAst} from 'rollup/parseAst';
import {reportCenterHidden,reportCenterVisible,reportCenterTrashRows,changeReportCenterTrash,permanentlyPurgeReportFromSupabase,reportCenterDeleteMessage,reportCenterPermanentMessage,confirmPermanentReportDeletion,confirmAdminTrashPermanentDeletion} from '../src/report-center-trash.js';
import {groupFinalWalkReportsByCreator} from '../src/report-groups.js';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const node=parseAst(source).body.find(x=>x.type==='FunctionDeclaration'&&x.id.name==='reportCenter');
assert.ok(node,'reportCenter function must exist');
const body=source.slice(node.start,node.end);
const proj='11111111-1111-4111-8111-111111111111',employee='22222222-2222-4222-8222-222222222222';
const walk='33333333-3333-4333-8333-333333333333',observation='44444444-4444-4444-8444-444444444444';
const correction='55555555-5555-4555-8555-555555555555',incident='66666666-6666-4666-8666-666666666666';
const discipline='77777777-7777-4777-8777-777777777777',equipment='88888888-8888-4888-8888-888888888888';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function setup(role='admin'){
 const dom=new JSDOM('<main id="app"></main>');
 const doc=dom.window.document,dbCalls=[],messages=[],navigation=[],audit=[];
 const rows={
  daily_safety_walks:[{id:walk,created_at:'2026-10-14T09:00:00Z',created_by:employee,creator:{name:'Safety Worker'},items:[],overall_status:'safe',notes:'Daily inspection'}],
  safety_discipline:[{id:discipline,employee_name:'Worker A',incident_date:'2026-10-14T10:00:00Z',issuer:{name:'Safety Worker'},action_level:'coaching'}],
  corrective_actions:[{id:correction,observation_id:observation,created_at:'2026-10-14T10:05:00Z',author:{name:'Safety Worker'},observation:{area:'Level 5',category:'Fall protection',status:'open',priority:'high',description:'Open edge'}}],
  report_documents:[{id:'doc-a',report_type:'daily_safety_walk',source_id:walk,report_number:'WALK-1',document_status:'final',version:1}],
  incident_reports:[{id:incident,report_number:'INC-1',employee_name:'Worker A',incident_type:'injury',incident_at:'2026-10-14T11:00:00Z',severity:'low'}],
  equipment_inspections:[{id:equipment,report_number:'EQ-1',equipment_name:'Forklift',inspector_name:'Safety Worker',inspection_at:'2026-10-14T12:00:00Z'}],
  inventory_items:[{id:'inv-a',item_name:'Vest',quantity:15}],
  report_center_trash:[]
 };
 const db={
  from(table){
   assert.ok(table in rows,'known table '+table);
   let mode='read',payload,conditions=[];
   const q={
    select(){return q},eq(key,value){conditions.push([key,value]);return q},
    order(){return q},limit(){return q},
    upsert(row){mode='upsert';payload=row;return q},
    update(row){mode='update';payload=row;return q},
    single:async()=>{
     assert.equal(table,'report_center_trash');
     dbCalls.push({mode,table,payload,conditions});
     if(role!=='admin')return {data:null,error:new Error('RLS admin only')};
     let entry=rows[table].find(row=>row.project_id===proj&&row.report_kind===(payload.report_kind||conditions.find(x=>x[0]==='report_kind')?.[1])&&row.report_id===(payload.report_id||conditions.find(x=>x[0]==='report_id')?.[1]));
     if(mode==='upsert'){
      if(entry?.state==='permanent')return {data:null,error:new Error('permanent')};
      if(entry)entry={...entry,...payload,deleted_at:new Date().toISOString()};
      else entry={...payload,deleted_at:new Date().toISOString()};
     }else if(mode==='update'){
      if(!entry||entry.state!=='trashed')return {data:null,error:new Error('not trashed')};
      entry={...entry,...payload};
     }
     rows[table]=rows[table].filter(x=>!(x.report_kind===entry.report_kind&&x.report_id===entry.report_id));
     rows[table].push(entry);audit.push(mode==='upsert'?'trashed':payload.state);
     return {data:{...entry},error:null};
    },
    then(resolve,reject){
     assert.equal(mode,'read');
     const results=rows[table].filter(row=>conditions.every(([key,value])=>!(key in row)||row[key]===value));
     return Promise.resolve({data:results,error:null}).then(resolve,reject);
    }
   };
   return q;
  },functions:{invoke:async(name,{body}={})=>{
   if(name!=='purge-report-center')return {data:{insights:[]}};
   const record=rows.report_center_trash.find(x=>x.project_id===body.project_id&&x.report_kind===body.report_kind&&x.report_id===body.report_id&&x.state==='trashed');
   if(role!=='admin'||!record)return {data:{error:'Admin trash record required'}};
   const table={discipline:'safety_discipline',correction:'corrective_actions',walk:'daily_safety_walks',incident:'incident_reports',equipment:'equipment_inspections'}[body.report_kind];
   if(table)rows[table]=rows[table].filter(x=>x.id!==body.report_id);
   record.state='permanent';audit.push('physical_purge');
   return {data:{ok:true,entry:{...record},removed_storage_files:1,deleted_source_records:1}};
  }}
 };
 const prompts=[],window=dom.window;
 window.confirm=msg=>{prompts.push(msg);return true};window.prompt=(msg)=>{prompts.push(msg);return 'DELETE'};
 const context=vm.createContext({document:doc,window,db,
  state:{project:proj,profile:{id:employee,role},projects:[{id:proj,name:'Jobsite A'}],observations:[{id:observation,project_id:proj,area:'Level 5',category:'Fall protection',status:'open',priority:'high',description:'Open edge',created_at:'2026-10-14T11:00:00Z'}]},
  frame:html=>{doc.querySelector('#app').innerHTML=html},mountSafetyIntelligence:()=>{},
  tr:en=>en,esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  fmt:()=> 'Oct 14',localDateKey:()=> '2026-10-14',captureView:()=>()=>true,
  toolsHomeMarkup:()=>'',safetyTools:{bindHome(){}},nativeReportArchiveAvailable:()=>false,
  reportCenterHidden,reportCenterVisible,reportCenterTrashRows,changeReportCenterTrash,permanentlyPurgeReportFromSupabase,reportCenterDeleteMessage,reportCenterPermanentMessage,confirmPermanentReportDeletion,confirmAdminTrashPermanentDeletion,
  groupFinalWalkReportsByCreator,effectiveWalkStatus:()=> 'safe',disciplinaryActionLabel:()=> 'Coaching',
  confirmAction:msg=>messages.push(msg),error:e=>messages.push('ERROR: '+e.message),
  navigate:(...args)=>navigation.push(args),Date,console
 });
 vm.runInContext(body,context);
 await context.reportCenter();
 return {dom,doc,db,rows,dbCalls,navigation,prompts,messages};
}
test('report center trash helpers hide only the exact category and id',()=>{
 const entries=[{report_kind:'correction',report_id:'same',state:'trashed'}, {report_kind:'walk',report_id:'closed',state:'permanent'},{report_kind:'discipline',report_id:'restored',state:'active'}];
 assert.equal(reportCenterHidden(entries,'correction','same'),true);
 assert.equal(reportCenterHidden(entries,'observation','same'),false);
 assert.equal(reportCenterHidden(entries,'walk','closed'),true);
 assert.equal(reportCenterHidden(entries,'discipline','restored'),false);
 assert.deepEqual(reportCenterVisible(entries,'correction',[{id:'same'},{id:'other'}]).map(x=>x.id),['other']);
 assert.equal(reportCenterTrashRows(entries).length,1);
});
test('admin trash and restore preserve data but confirmed permanent removal deletes Supabase source',async()=>{
 const t=await setup();
 t.doc.querySelector('[data-category="discipline"]').click();
 const row=t.doc.querySelector('.report-record');
 assert.equal(row.dataset.kind,'discipline');
 const deleteButton=t.doc.querySelector('.report-center-admin-delete');
 assert.ok(deleteButton);deleteButton.click();await tick();
 assert.equal(t.rows.safety_discipline.length,1);
 assert.equal(t.rows.report_center_trash[0].state,'trashed');
 assert.equal(t.doc.querySelector('.report-record'),null);
 t.doc.querySelector('.report-center-trash-toggle').click();
 assert.match(t.doc.querySelector('.report-center-admin-trash').textContent,/Worker A/);
 t.doc.querySelector('.report-center-trash-controls .secondary').click();await tick();
 assert.equal(t.rows.report_center_trash[0].state,'active');
 t.doc.querySelector('.report-center-trash-toggle').click();
 assert.equal(t.doc.querySelectorAll('.report-record').length,1);
 t.doc.querySelector('.report-center-admin-delete').click();await tick();
 t.doc.querySelector('.report-center-trash-toggle').click();
 t.doc.querySelector('.report-center-trash-controls .report-center-admin-delete').click();await tick();
 assert.equal(t.rows.report_center_trash[0].state,'permanent');
 assert.equal(t.rows.safety_discipline.length,0);
 assert.equal(t.prompts.filter(x=>/Type DELETE|Escriba ELIMINAR/.test(x)).length,0,'Admin Trash must not ask for a typed deletion code');
 t.dom.window.close();
});
test('correction deletion hides only the corrective report, not its underlying observation',async()=>{
 const t=await setup();
 t.doc.querySelector('[data-category="corrections"]').click();
 assert.equal(t.doc.querySelector('.report-record').dataset.id,correction);
 t.doc.querySelector('.report-center-admin-delete').click();await tick();
 assert.equal(t.doc.querySelectorAll('.report-record').length,0);
 t.doc.querySelector('[data-category="observations"]').click();
 assert.equal(t.doc.querySelector('.report-record').dataset.id,observation);
 t.doc.querySelector('.report-record').click();
 assert.equal(t.navigation.at(-1)[0],'observationReport');
 t.dom.window.close();
});
test('walk cards keep own admin delete button outside record button',async()=>{
 const t=await setup();
 t.doc.querySelector('[data-category="walks"]').click();
 assert.equal(t.doc.querySelectorAll('details.report-person-group').length,1);
 const outer=t.doc.querySelector('.report-center-admin-entry');
 assert.ok(outer);assert.equal(outer.querySelectorAll('button').length,3);
 assert.equal(outer.querySelector('button.report-record').contains(outer.querySelector('.report-center-admin-delete')),false);
 t.dom.window.close();
});
test('non-admin has no delete buttons or trash even if report is visible',async()=>{
 const t=await setup('safety');
 t.doc.querySelector('[data-category="discipline"]').click();
 assert.ok(t.doc.querySelector('.report-record'));
 assert.equal(t.doc.querySelector('.report-center-admin-delete'),null);
 assert.equal(t.doc.querySelector('.report-center-trash-toggle'),null);
 assert.equal(t.dbCalls.length,0);
 t.dom.window.close();
});
test('trash and permanent center operations do not call delete on source tables',async()=>{
 const calls=[];
 const db={from(table){calls.push(table);const q={upsert:d=>{calls.push(d.state);return q},update:d=>{calls.push(d.state);return q},eq(){return q},select(){return q},single:async()=>({data:{state:'trashed'}})};return q}};
 await changeReportCenterTrash(db,{projectId:proj,kind:'incident',id:incident,title:'INC-1',action:'trash'});
 await changeReportCenterTrash(db,{projectId:proj,kind:'incident',id:incident,action:'restore'});
 await assert.rejects(changeReportCenterTrash(db,{projectId:proj,kind:'incident',id:incident,action:'permanent'}),/verified Supabase purge/);
 assert.deepEqual(calls,['report_center_trash','trashed','report_center_trash','active']);
 await assert.rejects(changeReportCenterTrash(db,{projectId:proj,kind:'unknown',id:incident,action:'trash'}),/Invalid/);
});

test('irreversible deletion calls the secure Supabase Edge Function and rejects unconfirmed results',async()=>{
 const calls=[];
 const db={functions:{invoke:async(name,{body})=>{
  calls.push({name,body});
  return {data:{ok:true,entry:{state:'permanent',report_kind:body.report_kind,report_id:body.report_id}}};
 }}};
 const result=await permanentlyPurgeReportFromSupabase(db,{projectId:proj,kind:'discipline',id:discipline});
 assert.equal(result.ok,true);
 assert.deepEqual(calls,[{name:'purge-report-center',body:{project_id:proj,report_kind:'discipline',report_id:discipline}}]);
 await assert.rejects(permanentlyPurgeReportFromSupabase({functions:{invoke:async()=>({data:{ok:false}})}},{projectId:proj,kind:'incident',id:incident}),/did not confirm/);
 await assert.rejects(permanentlyPurgeReportFromSupabase(db,{projectId:proj,kind:'incorrect',id:incident}),/Invalid/);
});

test('Admin sees a direct Delete permanently button on an active report',async()=>{
 const t=await setup();
 t.doc.querySelector('[data-category="discipline"]').click();
 const buttons=[...t.doc.querySelectorAll('.report-center-admin-entry button')];
 assert.equal(buttons.length,3);
 assert.match(buttons[2].textContent,/Delete permanently/);
 buttons[2].click();await tick();await tick();
 assert.equal(t.rows.safety_discipline.length,0);
 assert.equal(t.rows.report_center_trash[0].state,'permanent');
 assert.equal(t.doc.querySelectorAll('.report-record').length,0);
 assert.ok(t.messages.some(m=>m.includes('permanently deleted')));
 t.dom.window.close();
});
test('canceling direct permanent deletion does not touch Supabase',async()=>{
 const t=await setup();
 t.doc.querySelector('[data-category="discipline"]').click();
 t.dom.window.confirm=()=>false;
 const perm=t.doc.querySelector('[data-report-action="permanent"]');
 perm.click();await tick();
 assert.equal(t.rows.report_center_trash.length,0);
 assert.equal(t.rows.safety_discipline.length,1);
 t.dom.window.close();
});
test('incorrect confirmation word does not delete a report',async()=>{
 const t=await setup();
 t.doc.querySelector('[data-category="discipline"]').click();
 t.dom.window.prompt=()=> 'NOT DELETE';
 const perm=t.doc.querySelector('[data-report-action="permanent"]');
 perm.click();await tick();
 assert.equal(t.rows.report_center_trash.length,0);
 assert.equal(t.rows.safety_discipline.length,1);
 t.dom.window.close();
});
test('direct permanent operation failure keeps report in Admin Trash and does not claim it is deleted',async()=>{
 const t=await setup();
 t.doc.querySelector('[data-category="discipline"]').click();
 t.db.functions.invoke=async()=>({data:{error:'Linked medical record prevents deletion'}});
 t.doc.querySelector('[data-report-action="permanent"]').click();await tick();await tick();
 assert.equal(t.rows.safety_discipline.length,1);
 assert.equal(t.rows.report_center_trash[0].state,'trashed');
 assert.equal(t.doc.querySelector('.report-center-admin-trash').hidden,false);
 assert.equal(t.doc.querySelectorAll('.report-center-trash-item').length,1);
 assert.ok(!t.messages.some(m=>m.includes('permanently deleted')));
 t.dom.window.close();
});
test('double confirmation uses ELIMINAR for Spanish and DELETE for English',()=>{
 const calls=[];
 const win={confirm:()=>true,prompt:message=>{calls.push(message);return 'ELIMINAR'}};
 assert.equal(confirmPermanentReportDeletion(win,{title:'Prueba',tr:(_,es)=>es,language:'es'}),true);
 assert.equal(confirmPermanentReportDeletion(win,{title:'Test',tr:en=>en,language:'en'}),false);
 assert.equal(calls.length,2);
});

test('Supabase purge endpoint validates administrator, source, physical Storage and audit',()=>{
 const code=readFileSync(new URL('../supabase/functions/purge-report-center/index.ts',import.meta.url),'utf8');
 assert.match(code,/admin\.auth\.getUser\(bearer\.slice\(7\)\)/);
 assert.match(code,/actor\?\.role!=="admin"/);
 assert.match(code,/trash\?\.state!=="trashed"/);
 assert.match(code,/admin\.storage\.from\(bucket\)\.remove/);
 assert.match(code,/from\("report_documents"\)\.delete/);
 assert.match(code,/from\(source\.table\)\.delete/);
 assert.match(code,/employee_medical_followups/);
});
test('database migration enforces row security, server role checks and immutable audit',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261014170000_admin_report_center_trash.sql',import.meta.url),'utf8');
 assert.match(sql,/enable row level security/g);
 assert.match(sql,/private\.my_role\(\)='admin'/);
 assert.match(sql,/before insert or update/);
 assert.match(sql,/create table if not exists public\.report_center_trash_audit/);
 assert.match(sql,/revoke all on public\.report_center_trash from public,anon,authenticated/);
});

test('Admin Trash permanent deletion requires just one confirmation and never a typed code',()=>{
 let confirmationCount=0,promptCount=0;
 const win={confirm:message=>{confirmationCount++;assert.match(message,/irreversible|cannot be undone|no se puede deshacer/i);return true},prompt:()=>{promptCount++;return 'DELETE'}};
 const accept=confirmAdminTrashPermanentDeletion(win,{title:'INC-104',tr:(en)=>en});
 assert.equal(accept,true);
 assert.equal(confirmationCount,1);
 assert.equal(promptCount,0);
});
test('cancelled Admin Trash confirmation performs no removal',async()=>{
 const t=await setup();
 t.doc.querySelector('[data-category="discipline"]').click();
 t.doc.querySelector('.report-center-admin-delete:not(.report-center-direct-permanent)').click();
 await tick();
 t.doc.querySelector('.report-center-trash-toggle').click();
 let confirmations=0;
 t.dom.window.confirm=()=>{confirmations++;return false};
 t.dom.window.prompt=()=>{throw new Error('No typed DELETE is allowed in Admin Trash')};
 const permanent=t.doc.querySelector('.report-center-trash-controls .report-center-admin-delete');
 permanent.click();
 await tick();
 assert.equal(confirmations,1);
 assert.equal(t.rows.report_center_trash[0].state,'trashed');
 assert.equal(t.rows.safety_discipline.length,1);
 t.dom.window.close();
});
