import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {JSDOM} from 'jsdom';
import {simplifyDisciplineForm,markDisciplineMissingFields} from '../src/discipline-ui.js';
import {attachDisciplineViolationControls,disciplineViolationForSave} from '../src/discipline-osha-reference.js';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const ast=parseAst(source);
const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='discipline');
assert.ok(node);
const disciplineSource=source.slice(node.start,node.end);
const id=(n)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const project=id(1);
const traditional={id:id(3),sticker_number:'0781',employee_name:'Traditional Worker',employee_position:'Foreman',employee_profile_id:null};
const quick={id:id(4),sticker_number:'0585',employee_name:'Quick Worker',employee_trade:'Glazier'};

async function setup({old=[traditional],fast=[quick],hist=[],confirmResult=true}={}){
 const dom=new JSDOM('<main></main>'),doc=dom.window.document;
 const writes=[],errors=[],nav=[],confirmCalls=[];
 const rows={project_members:[],safety_discipline:hist,safety_orientations:old,quick_safety_orientations:fast};
 const reads=[],failedReads=new Set();
 const db={from(table){let inserted=false,conditions=[];
   const q={
    select(){return q},eq(name,value){conditions.push([name,value]);return q},order(){return q},
    insert(data){inserted=true;writes.push({table,data});return q},
    delete(){return q},
    single:async()=>({data:{id:id(900)}}),
    then(resolve,reject){
     const source=rows[table]||[];
     const data=inserted?{id:id(900)}:source.filter(row=>conditions.every(([key,value])=>!(key in row)||row[key]===value));
     reads.push({table,conditions:conditions.slice()});
     return Promise.resolve({data:failedReads.has(table)&&!inserted?null:data,error:failedReads.has(table)&&!inserted?new Error('Simulated read outage'):null}).then(resolve,reject)
    }
   };return q;
  },storage:{from:()=>({remove:async()=>{}})}
 };
 const tr=en=>en,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const context=vm.createContext({
  state:{project,profile:{id:id(2),name:'Safety',role:'admin'},projects:[{id:project,name:'Jobsite'}]},db,document:doc,window:dom.window,FormData:dom.window.FormData,File:dom.window.File,Event:dom.window.Event,
  captureView:()=>()=>true,frame:html=>{doc.querySelector('main').innerHTML=html},tr,esc,fmt:()=>'',error:e=>errors.push(String(e?.message||e)),
  disciplinaryActionLabel:r=>r.action_level||'Warning',simplifyDisciplineForm,markDisciplineMissingFields,attachDisciplineViolationControls,disciplineViolationForSave,
  mountReportSignatures:form=>{
   form.querySelector('button[type=submit]').insertAdjacentHTML('beforebegin','<div class="jha-approval-fields"><input name="jha_safety_name"><input name="jha_employee_name"><input type="hidden" name="jha_employee_signature" value="[]"><button type="button" data-jha-clear="employee">Clear signature</button></div>');
   form.querySelector('[data-jha-clear="employee"]').onclick=()=>{form.elements.jha_employee_signature.value='[]'}
  },
  reportApprovals:()=>({employee:{name:'Worker',strokes:[]}}),draftFilesFor:async()=>[],
  clearDraft:async()=>{},savedAction(){},navigate:(...a)=>nav.push(a),readStickerNumber:async()=>'',confirm:message=>{confirmCalls.push(message);return confirmResult},console,
  crypto:{randomUUID:()=>id(33)}
 });
 vm.runInContext(disciplineSource,context);
 await context.discipline();
 const form=doc.querySelector('#discipline-form');
 assert.ok(form);
 return {dom,doc,db,form,writes,errors,nav,rows,reads,failedReads,confirmCalls};
}

test('Find Sticker resolves finalized Quick Orientation and saves a real Quick employee link',async()=>{
 const t=await setup();
 t.doc.querySelector('#discipline-sticker-number').value='  # 0585  ';
 t.doc.querySelector('#discipline-sticker-verify').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_orientation_id.value,'quick:'+quick.id);
 assert.equal(t.form.elements.employee_name.value,'Quick Worker');
 assert.equal(t.form.elements.employee_position.value,'Glazier');
 assert.match(t.doc.querySelector('#discipline-sticker-status').textContent,/Quick Safety Orientation sticker linked/);
 t.form.elements.description.value='Employee safety violation documented';
 await t.form.onsubmit({preventDefault(){},target:t.form});
 assert.deepEqual(t.errors,[]);
 const payload=t.writes.find(x=>x.table==='safety_discipline').data;
 assert.equal(payload.employee_quick_orientation_id,quick.id);
 assert.equal(payload.employee_orientation_id,null);
 assert.equal(payload.employee_sticker_number,'0585');
 assert.equal(payload.employee_name,'Quick Worker');
 assert.equal(payload.employee_position,'Glazier');
 assert.equal(t.nav.at(-1)[0],'disciplineReport');
 t.dom.window.close();
});

test('Find Sticker still resolves traditional stickers and keeps original foreign key',async()=>{
 const t=await setup();
 t.doc.querySelector('#discipline-sticker-number').value='0781';
 t.doc.querySelector('#discipline-sticker-verify').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_orientation_id.value,traditional.id);
 assert.equal(t.form.elements.employee_name.value,'Traditional Worker');
 t.form.elements.description.value='Fall protection violation documented';
 await t.form.onsubmit({preventDefault(){},target:t.form});
 assert.deepEqual(t.errors,[]);
 const payload=t.writes.find(x=>x.table==='safety_discipline').data;
 assert.equal(payload.employee_orientation_id,traditional.id);
 assert.equal(payload.employee_quick_orientation_id,null);
 assert.equal(payload.employee_sticker_number,'0781');
 t.dom.window.close();
});

test('shared number with different employee names requires explicit choice instead of misidentification',async()=>{
 const t=await setup({old:[{...traditional,sticker_number:'0585'}]});
 t.doc.querySelector('#discipline-sticker-number').value='0585';
 t.doc.querySelector('#discipline-sticker-verify').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_orientation_id.value,'');
 assert.match(t.doc.querySelector('#discipline-sticker-status').textContent,/Multiple employee records/);
 assert.ok([...t.form.elements.employee_orientation_id.options].some(o=>o.value==='quick:'+quick.id));
 assert.ok([...t.form.elements.employee_orientation_id.options].some(o=>o.value===traditional.id));
 t.form.elements.employee_orientation_id.value='quick:'+quick.id;
 t.form.elements.employee_orientation_id.onchange();
 assert.equal(t.form.elements.employee_name.value,'Quick Worker');
 t.dom.window.close();
});

test('shared sticker belonging to same employee automatically preserves traditional link history',async()=>{
 const t=await setup({old:[{...traditional,sticker_number:'0585',employee_name:'Quick Worker'}]});
 t.doc.querySelector('#discipline-sticker-number').value='0585';
 t.doc.querySelector('#discipline-sticker-verify').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_orientation_id.value,traditional.id);
 t.dom.window.close();
});

test('unmatched sticker stays unlinked and does not invent an employee',async()=>{
 const t=await setup();
 t.doc.querySelector('#discipline-sticker-number').value='9999';
 t.doc.querySelector('#discipline-sticker-verify').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(t.doc.querySelector('#discipline-sticker-status').textContent,/not found in this project/);
 assert.equal(t.form.elements.employee_orientation_id.value,'');
 t.dom.window.close();
});


test('Find Sticker refreshes registrations added after the disciplinary form was opened',async()=>{
 const t=await setup({old:[],fast:[]});
 const newlyCompleted={...quick,id:id(42),sticker_number:'0910',employee_name:'Registered Just Now',project_id:project,status:'final'};
 t.rows.quick_safety_orientations.push(newlyCompleted);
 t.doc.querySelector('#discipline-sticker-number').value='0910';
 t.doc.querySelector('#discipline-sticker-verify').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_orientation_id.value,'quick:'+newlyCompleted.id);
 assert.equal(t.form.elements.employee_name.value,'Registered Just Now');
 assert.ok(t.reads.filter(r=>r.table==='quick_safety_orientations').length>=2,'initial load and refreshed lookup');
 t.dom.window.close();
});

test('Find Sticker only matches the selected project in both registration tables',async()=>{
 const differentProject=id(55);
 const t=await setup({old:[{...traditional,project_id:differentProject}],fast:[{...quick,project_id:differentProject}]});
 t.doc.querySelector('#discipline-sticker-number').value='0585';
 t.doc.querySelector('#discipline-sticker-verify').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_orientation_id.value,'');
 assert.match(t.doc.querySelector('#discipline-sticker-status').textContent,/not found in this project/);
 assert.ok(t.reads.filter(r=>r.table==='quick_safety_orientations').every(r=>r.conditions.some(([key,value])=>key==='project_id'&&value===project)));
 assert.ok(t.reads.filter(r=>r.table==='safety_orientations').every(r=>r.conditions.some(([key,value])=>key==='project_id'&&value===project)));
 t.dom.window.close();
});

test('Find Sticker never includes unfinished Quick orientation drafts',async()=>{
 const t=await setup({old:[],fast:[{...quick,status:'draft',project_id:project}]});
 t.doc.querySelector('#discipline-sticker-number').value='0585';
 t.doc.querySelector('#discipline-sticker-verify').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_orientation_id.value,'');
 assert.match(t.doc.querySelector('#discipline-sticker-status').textContent,/not found/);
 assert.ok(t.reads.filter(r=>r.table==='quick_safety_orientations').every(r=>r.conditions.some(([key,value])=>key==='status'&&value==='final')));
 t.dom.window.close();
});


test('a failed search clears the previously verified worker instead of retaining a wrong disciplinary identity',async()=>{
 const t=await setup();
 const number=t.doc.querySelector('#discipline-sticker-number'),find=t.doc.querySelector('#discipline-sticker-verify');
 number.value='0781';find.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_name.value,'Traditional Worker');
 assert.equal(t.form.elements.employee_orientation_id.value,traditional.id);
 number.value='9999';find.click();
 assert.equal(t.form.querySelector('button[type=submit]').disabled,true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_orientation_id.value,'');
 assert.equal(t.form.elements.employee_name.value,'');
 assert.equal(t.form.elements.employee_position.value,'');
 assert.equal(t.form.querySelector('button[type=submit]').disabled,false);
 assert.match(t.doc.querySelector('#discipline-sticker-status').textContent,/not found in this project/);
 t.dom.window.close();
});

test('a duplicate sticker does not leave an unrelated previously verified worker in the form',async()=>{
 const t=await setup({old:[traditional,{...traditional,id:id(88),employee_name:'Different Worker',sticker_number:'0585'}]});
 const number=t.doc.querySelector('#discipline-sticker-number'),find=t.doc.querySelector('#discipline-sticker-verify');
 number.value='0781';find.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_orientation_id.value,traditional.id);
 number.value='0585';find.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_orientation_id.value,'');
 assert.equal(t.form.elements.employee_name.value,'');
 assert.match(t.doc.querySelector('#discipline-sticker-status').textContent,/Multiple employee records/);
 t.dom.window.close();
});

test('network lookup errors clear stale identity, release buttons and allow a retry',async()=>{
 const t=await setup();
 const number=t.doc.querySelector('#discipline-sticker-number'),find=t.doc.querySelector('#discipline-sticker-verify');
 number.value='0781';find.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_name.value,'Traditional Worker');
 t.failedReads.add('quick_safety_orientations');
 number.value='0585';find.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_orientation_id.value,'');
 assert.equal(t.form.elements.employee_name.value,'');
 assert.match(t.doc.querySelector('#discipline-sticker-status').textContent,/Could not refresh/);
 assert.equal(find.disabled,false);
 assert.equal(t.form.querySelector('button[type=submit]').disabled,false);
 t.failedReads.clear();
 find.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_orientation_id.value,'quick:'+quick.id);
 t.dom.window.close();
});

test('manual employee entries stay intact after searching an unknown sticker',async()=>{
 const t=await setup();
 t.form.elements.employee_name.value='Manual Worker';
 t.form.elements.employee_position.value='Laborer';
 t.doc.querySelector('#discipline-sticker-number').value='NOT-REGISTERED';
 t.doc.querySelector('#discipline-sticker-verify').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_orientation_id.value,'');
 assert.equal(t.form.elements.employee_name.value,'Manual Worker');
 assert.equal(t.form.elements.employee_position.value,'Laborer');
 t.dom.window.close();
});


test('safety and matched employee signature names are filled without redesigning the report',async()=>{
 const t=await setup();
 assert.equal(t.form.elements.jha_safety_name.value,'Safety');
 const input=t.doc.querySelector('#discipline-sticker-number');
 input.value='0585';t.doc.querySelector('#discipline-sticker-verify').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_name.value,'Quick Worker');
 assert.equal(t.form.elements.jha_employee_name.value,'Quick Worker');
 t.form.elements.description.value='An observed hazard';
 await t.form.onsubmit({preventDefault(){},target:t.form});
 assert.equal(t.confirmCalls.length,1);
 assert.match(t.confirmCalls[0],/Quick Worker/);
 assert.match(t.confirmCalls[0],/Jobsite/);
 assert.match(t.confirmCalls[0],/Sticker: #0585/);
 t.dom.window.close();
});

test('cancelling the save review leaves disciplinary data and evidence unchanged',async()=>{
 const t=await setup({confirmResult:false});
 t.form.elements.employee_name.value='Manual Worker';
 t.form.elements.description.value='Unsafe operation';
 await t.form.onsubmit({preventDefault(){},target:t.form});
 assert.equal(t.confirmCalls.length,1);
 assert.equal(t.writes.filter(x=>x.table==='safety_discipline').length,0);
 assert.equal(t.form.elements.employee_name.value,'Manual Worker');
 assert.equal(t.form.querySelector('button[type=submit]').disabled,false);
 assert.equal(t.form.dataset.submitting,undefined);
 t.dom.window.close();
});

test('changing sticker input after verification clears linked identity and signature from previous employee',async()=>{
 const t=await setup();
 const lookup=t.doc.querySelector('#discipline-sticker-number');
 lookup.value='0781';t.doc.querySelector('#discipline-sticker-verify').click();
 await new Promise(resolve=>setImmediate(resolve));
 t.form.elements.jha_employee_signature.value='[[[0.1,0.2]]]';
 t.form.elements.employee_acknowledged.checked=true;
 lookup.value='0585';lookup.dispatchEvent(new t.dom.window.Event('input',{bubbles:true}));
 assert.equal(t.form.elements.employee_orientation_id.value,'');
 assert.equal(t.form.elements.employee_name.value,'');
 assert.equal(t.form.elements.jha_employee_name.value,'');
 assert.equal(t.form.elements.jha_employee_signature.value,'[]');
 assert.equal(t.form.elements.employee_acknowledged.checked,false);
 assert.match(t.doc.querySelector('#discipline-sticker-status').textContent,/Sticker changed/);
 t.dom.window.close();
});

test('switching verified workers does not carry an earlier employee signature forward',async()=>{
 const t=await setup();
 const input=t.doc.querySelector('#discipline-sticker-number'),find=t.doc.querySelector('#discipline-sticker-verify');
 input.value='0781';find.click();await new Promise(resolve=>setImmediate(resolve));
 t.form.elements.jha_employee_signature.value='[[[0.1,0.2]]]';
 t.form.elements.employee_acknowledged.checked=true;
 input.value='0585';find.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.form.elements.employee_orientation_id.value,'quick:'+quick.id);
 assert.equal(t.form.elements.jha_employee_name.value,'Quick Worker');
 assert.equal(t.form.elements.jha_employee_signature.value,'[]');
 assert.equal(t.form.elements.employee_acknowledged.checked,false);
 t.dom.window.close();
});

test('inconsistent verified sticker identity cannot be saved even after programmatic field changes',async()=>{
 const t=await setup();
 const input=t.doc.querySelector('#discipline-sticker-number');
 input.value='0781';t.doc.querySelector('#discipline-sticker-verify').click();
 await new Promise(resolve=>setImmediate(resolve));
 t.form.elements.description.value='Observed safety violation';
 t.form.elements.employee_name.value='Different Person';
 await t.form.onsubmit({preventDefault(){},target:t.form});
 assert.equal(t.writes.filter(x=>x.table==='safety_discipline').length,0);
 assert.match(t.errors.join(' '),/no longer match the verified sticker/);
 assert.equal(t.confirmCalls.length,0);
 t.dom.window.close();
});

test('manually adjusting employee name unlinks an old sticker and prompts reverification',async()=>{
 const t=await setup();
 const input=t.doc.querySelector('#discipline-sticker-number');
 input.value='0781';t.doc.querySelector('#discipline-sticker-verify').click();
 await new Promise(resolve=>setImmediate(resolve));
 t.form.elements.employee_name.value='Manually Edited';
 t.form.elements.employee_name.dispatchEvent(new t.dom.window.Event('input',{bubbles:true}));
 assert.equal(t.form.elements.employee_orientation_id.value,'');
 assert.match(t.doc.querySelector('#discipline-sticker-status').textContent,/Find Sticker again/);
 t.dom.window.close();
});

test('discipline form uses bright white field bars with dark readable text',()=>{
 const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(css,/Employee Safety Discipline: bright white field bars/);
 assert.match(css,/\.discipline-shell #discipline-form \.discipline-simple-heading\{\s*background:#fff!important;color:#162b3a!important/);
 assert.match(css,/\.discipline-shell #discipline-form \.discipline-simple-fields select,/);
 assert.match(css,/background:#fff!important;color:#14212c!important/);
});

test('sticker linking selector stays hidden for normal verified stickers and unlinked manual records',async()=>{
 const t=await setup();
 const selector=t.doc.querySelector('#discipline-sticker-disambiguation');
 assert.equal(selector.hidden,true);
 t.doc.querySelector('#discipline-sticker-number').value='0781';
 t.doc.querySelector('#discipline-sticker-verify').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(selector.hidden,true);
 assert.equal(t.form.elements.employee_orientation_id.value,traditional.id);
 t.dom.window.close();
});

test('duplicate stickers temporarily reveal safe employee selection and hide after choosing',async()=>{
 const t=await setup({old:[{...traditional,sticker_number:'0585'}]});
 const selector=t.doc.querySelector('#discipline-sticker-disambiguation');
 const input=t.doc.querySelector('#discipline-sticker-number');
 input.value='0585';
 t.doc.querySelector('#discipline-sticker-verify').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(selector.hidden,false);
 assert.equal(t.form.elements.employee_orientation_id.value,'');
 t.form.elements.employee_orientation_id.value='quick:'+quick.id;
 t.form.elements.employee_orientation_id.onchange();
 assert.equal(selector.hidden,true);
 assert.equal(t.form.elements.employee_name.value,'Quick Worker');
 t.dom.window.close();
});
