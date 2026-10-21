import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {simplifyOrientationForm} from '../src/orientation-ui.js';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),ast=parseAst(source);
const fn=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(n.start,n.end)};
async function setup(project='job-a'){
 const dom=new JSDOM('<main></main>'),doc=dom.window.document,writes=[],uploads=[],errors=[],revoked=[];let serial=0;
 dom.window.URL.createObjectURL=()=> 'blob:photo-'+(++serial);dom.window.URL.revokeObjectURL=url=>revoked.push(url);
 const db={from(table){const q={select(){return q},eq(){return q},order(){return q},insert(payload){writes.push({table,payload});return q},single:async()=>({data:{id:'new-record'}}),maybeSingle:async()=>({data:null}),then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}};return q},storage:{from:()=>({upload:async(path,file)=>{uploads.push({path,file});return {}},remove:async()=>({})})}};
 const context=vm.createContext({simplifyOrientationForm,state:{project,profile:{id:'owner',role:'safety'},projects:[{id:project}]},db,document:doc,FormData:dom.window.FormData,captureView:()=>()=>true,frame:html=>doc.querySelector('main').innerHTML=html,tr:en=>en,esc:x=>String(x??''),localDateKey:()=> '2026-10-09',error:e=>errors.push(e),savedAction(){},normalizeReportImage:async f=>f,crypto:{randomUUID:()=>String(++serial)},reportApprovals:()=>({safety:{name:'Safety'},employee:{name:'Worker'}}),mountReportSignatures(form){const box=doc.createElement('div');box.className='jha-approval-fields';box.innerHTML='<section><input name="jha_safety_name"><input name="jha_safety_signature" value="[]"><button type="button" data-jha-clear="safety">Clear</button></section><section><input name="jha_employee_name"><input name="jha_employee_signature" value="[]"><button type="button" data-jha-clear="employee">Clear</button></section>';form.insertBefore(box,form.querySelector('[type=submit]'));box.querySelectorAll('[data-jha-clear]').forEach(b=>b.onclick=()=>{form.elements['jha_'+b.dataset.jhaClear+'_signature'].value='[]'})}});
 vm.runInContext(fn('orientationEvidenceField')+'\n'+fn('team'),context);await context.team();
 const form=doc.querySelector('#orientation-form');
 const photo=(name,filename='image.jpg')=>{const input=form.querySelector('[data-evidence-input="'+name+'"][data-source="gallery"]');Object.defineProperty(input,'files',{configurable:true,value:[new dom.window.File(['image'],filename,{type:'image/jpeg'})]});input.onchange()};
 return {dom,doc,form,photo,writes,uploads,errors,revoked};
}
test('orientation keeps employee fields and only two required photo choices',async()=>{
 const t=await setup(),f=t.form;
 for(const name of ['sticker_number','employee_name','employee_company','employee_position','orientation_date','notes','jha_safety_name','jha_employee_name','jha_safety_signature','jha_employee_signature'])assert.ok(f.elements.namedItem(name),name);
 assert.equal(f.querySelectorAll('[data-evidence-source]').length,4);
 assert.equal(f.querySelectorAll('[data-evidence-clear]').length,2);
 assert.equal(f.elements.namedItem('employee_profile_id'),null);
 assert.equal(f.querySelector('[data-evidence-count="orientation_document_photo"]'),null);
 assert.equal(f.querySelector('[data-evidence-count="certificate_photos"]'),null);
 assert.doesNotMatch(f.textContent,/Link to a TEAM member|Safety Orientation Document Photo|Certificate Photos/i);
 assert.ok(t.doc.querySelector('#sticker-camera'));assert.ok(t.doc.querySelector('#sticker-find'));
 const details=f.querySelectorAll('details');assert.deepEqual([...details].map(x=>x.open),[true,true]);
 assert.equal(f.querySelector('.orientation-legacy-fields').hidden,true);
 assert.equal(f.querySelectorAll('.orientation-step').length,2);
 assert.equal(f.elements.notes.required,false);
 details[0].open=false;f.checkValidity();assert.equal(details[0].open,true);
 assert.equal(new t.dom.window.FormData(f).get('orientation_date'),'2026-10-09');
 await f.onsubmit({preventDefault(){}});assert.equal(t.writes.length,0);assert.equal(t.errors.length,1);assert.equal(t.doc.activeElement.dataset.evidenceName,'orientation_photo');
 t.dom.window.close();
});
test('Face ID and sticker photo replacements, removal and navigation clean up previews',async()=>{
 const t=await setup();t.photo('orientation_photo','first.jpg');t.photo('orientation_photo','second.jpg');assert.equal(t.revoked.length,1);
 t.photo('sticker_photo','first-sticker.jpg');t.photo('sticker_photo','second-sticker.jpg');
 assert.equal(t.form.querySelectorAll('.orientation-photo-previews img').length,2);
 t.form.querySelector('[data-evidence-clear="sticker_photo"]').click();assert.equal(t.form.querySelectorAll('.orientation-photo-previews img').length,1);
 t.form.remove();await new Promise(r=>setTimeout(r,0));assert.equal(t.revoked.length,4);t.dom.window.close();
});
for(const project of ['job-a','job-b'])test('orientation saves Face ID, sticker photo and original employee values for '+project,async()=>{
 const t=await setup(project),f=t.form;
 Object.entries({sticker_number:'ge-0248',employee_name:'Juan Pérez',employee_company:'G&E',employee_position:'Carpenter',notes:'Original notes'}).forEach(([name,value])=>f.elements[name].value=value);
 for(const name of ['orientation_photo','sticker_photo'])t.photo(name);
 f.elements.jha_employee_signature.value='[[[0.1,0.2]]]';
 await f.onsubmit({preventDefault(){}});await new Promise(r=>setTimeout(r,0));
 assert.deepEqual(t.errors,[]);assert.equal(t.uploads.length,2);const saved=t.writes.find(x=>x.table==='safety_orientations').payload;
 assert.equal(saved.project_id,project);assert.equal(saved.sticker_number,'GE-0248');assert.equal(saved.employee_name,'Juan Pérez');assert.equal(saved.notes,'Original notes');assert.equal(Object.hasOwn(saved,'certificate_photo_paths'),false);assert.equal(Object.hasOwn(saved,'orientation_document_photo_path'),false);assert.equal(Object.hasOwn(saved,'employee_profile_id'),false);assert.equal(saved.approvals.employee.name,'Worker');
 assert.equal(f.querySelectorAll('.orientation-photo-previews img').length,0);assert.equal(f.elements.jha_employee_signature.value,'[]');assert.equal(f.elements.employee_name.value,'');t.dom.window.close();
});
