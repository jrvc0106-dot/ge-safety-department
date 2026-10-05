import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {parseAst} from 'rollup/parseAst';
import {attachJhaPhotos,jhaPhotoController} from '../src/jha-photos.js';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),ast=parseAst(source);
function fn(name){const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(node.start,node.end)}
for(const count of [0,1,6,7,13])test(`equipment report retains all ${count} photos in groups of six`,async()=>{
 const record={report_number:'EI-TEST',equipment_name:'Forklift',project:{name:'Project'},location:'Test Area',inspector_name:'Safety',checklist:[{item:'Existing check',result:'pass',note:'Existing finding'}],overall_status:'approved',photos:Array.from({length:count},(_,i)=>({path:String(i)}))};let html;
 const ctx=vm.createContext({state:{project:'project',detail:'record'},db:{from(){return{select(){return this},eq(){return this},single:async()=>({data:record})}}},captureView:()=>()=>true,frame:s=>html=s,signedDisplayImage:async(_,path)=>'photo-'+path,tr:x=>x,esc:x=>String(x??''),fmt:x=>x,equipmentInspectionTypes:{},reportSignaturesReport:()=>'<div>Saved signatures</div>',error:e=>{throw e}});
 vm.runInContext(fn('equipmentInspectionReport'),ctx);await ctx.equipmentInspectionReport();const dom=new JSDOM(html),doc=dom.window.document;
 assert.deepEqual([...doc.querySelectorAll('.eq-photo-page')].map(p=>p.querySelectorAll('img').length),Array.from({length:Math.ceil(count/6)},(_,i)=>Math.min(6,count-i*6)));
 assert.deepEqual([...doc.querySelectorAll('.eq-photos img')].map(img=>img.getAttribute('src')),Array.from({length:count},(_,i)=>'photo-'+i));
 for(const text of ['Existing check','Existing finding','Saved signatures','Test Area','EI-TEST'])assert.ok(doc.body.textContent.includes(text));
 dom.window.close();
});
test('equipment draft restores thumbnails, appends selections and saves only retained photos',async()=>{
 const dom=new JSDOM('<form id="equipment-form"><input type="file" name="evidence" multiple></form>');
 const previous={document:globalThis.document,MutationObserver:globalThis.MutationObserver};Object.assign(globalThis,{document:dom.window.document,MutationObserver:dom.window.MutationObserver});
 const form=document.querySelector('form'),input=form.querySelector('input'),fileState=new Map([['equipment',{evidence:[{path:'restored',name:'restored.jpg',type:'image/jpeg'}]}]]),removed=[],uploaded=[],errors=[],snapshots=[];
 const ctx=vm.createContext({document,attachJhaPhotos,jhaPhotoController,draftFileState:fileState,draftTimers:new Map(),draftUploads:new Map(),draftOwner:()=>({user:'owner',project:'project'}),formDraftKey:()=> 'equipment',localStorage:{setItem(){}},serializeDraftForm:()=>({}),setDraftStatus(){},restoreDraft:async()=>true,renderDraftFileBadges(){},persistDraft:async()=>snapshots.push(JSON.parse(JSON.stringify(fileState.get('equipment')))),normalizeReportImage:async file=>file,crypto:{randomUUID:()=>String(uploaded.length)},db:{storage:{from:()=>({upload:async path=>{uploaded.push(path);return{}},remove:async paths=>{removed.push(...paths);return{}},download:async()=>({data:new Blob(['saved'],{type:'image/jpeg'})})})}},signedDisplayImage:async()=> 'data:image/jpeg;base64,AA==',tr:x=>x,error:e=>errors.push(e),File,clearTimeout,setTimeout});
 vm.runInContext('let activeDraftFlush=null;'+fn('uploadDraftFiles')+'\n'+fn('enableAutoDraft')+'\n'+fn('draftFilesFor'),ctx);
 try{
  await ctx.enableAutoDraft(form,'equipment_inspection');assert.equal(form.querySelectorAll('.jha-photo-card').length,1);
  const select=names=>{Object.defineProperty(input,'files',{configurable:true,value:names.map(name=>new File(['image'],name,{type:'image/jpeg'}))});input.dispatchEvent(new dom.window.Event('change',{bubbles:true}))};
  select(['first.jpg','second.jpg']);await ctx.draftFilesFor(form,'equipment_inspection','default','evidence');select(['third.jpg']);
  assert.deepEqual((await ctx.draftFilesFor(form,'equipment_inspection','default','evidence')).map(f=>f.name),['restored.jpg','first.jpg','second.jpg','third.jpg']);assert.deepEqual(removed,[]);
  form.querySelectorAll('.jha-photo-card button')[1].click();
  assert.deepEqual((await ctx.draftFilesFor(form,'equipment_inspection','default','evidence')).map(f=>f.name),['restored.jpg','second.jpg','third.jpg']);assert.equal(removed.length,1);assert.equal(form.querySelectorAll('.jha-photo-card').length,3);assert.deepEqual(errors,[]);
  assert.deepEqual(snapshots.at(-1).evidence.map(p=>p.name),['restored.jpg','second.jpg','third.jpg']);
 }finally{for(const timer of ctx.draftTimers.values())clearTimeout(timer);form.remove();await Promise.resolve();Object.assign(globalThis,previous);dom.window.close()}
});
