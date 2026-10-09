import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {parseAst} from 'rollup/parseAst';
import {attachJhaPhotos} from '../src/jha-photos.js';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),ast=parseAst(source);
const fn=name=>{const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(node.start,node.end)};
test('observation thumbnails append camera/gallery batches and remove only the selected photo',async()=>{
 const dom=new JSDOM('<form id="observation"><input name="photo" type="file" multiple></form>');const previous={document:globalThis.document,MutationObserver:globalThis.MutationObserver};globalThis.document=dom.window.document;globalThis.MutationObserver=dom.window.MutationObserver;
 const form=document.querySelector('form'),input=form.querySelector('input'),removed=[],saved=[];
 const controller=attachJhaPhotos(form,{list:()=>[],add:async(_,files)=>{const items=files.map(file=>({path:file.name,name:file.name}));saved.push(...items);return items},remove:async(_,item)=>removed.push(item.path),preview:async()=>'',download:async()=>{},tr:en=>en,onError:err=>{throw err}});
 const select=names=>{Object.defineProperty(input,'files',{configurable:true,value:names.map(name=>Object.assign(new Blob(['photo'],{type:'image/jpeg'}),{name}))});input.dispatchEvent(new dom.window.Event('change',{bubbles:true}))};
 try{
  select(['gallery-one.jpg','gallery-two.jpg']);await controller.files('photo');select(['camera.jpg']);await controller.files('photo');
  assert.equal(form.querySelectorAll('.jha-photo-card img').length,3);form.querySelectorAll('.jha-photo-card button')[1].click();
  assert.deepEqual((await controller.files('photo')).map(file=>file.name),['gallery-one.jpg','camera.jpg']);assert.deepEqual(removed,['gallery-two.jpg']);assert.equal(form.querySelectorAll('.jha-photo-card img').length,2);
  form.querySelector('.jha-photo-card button').click();await controller.files('photo');form.querySelector('.jha-photo-card button').click();assert.deepEqual(await controller.files('photo'),[]);assert.equal(form.querySelectorAll('.jha-photo-card').length,0);
 }finally{form.remove();await Promise.resolve();Object.assign(globalThis,previous);dom.window.close()}
});
for(const failSecond of [false,true])test(`observation saves remaining photos${failSecond?' and cleans up on upload failure':''}`,async()=>{
 const dom=new JSDOM('<main id="app"></main>'),uploads=[],cleanup=[],errors=[],deleted=[],cleared=[];
 const files=['kept-one.jpg','kept-two.jpg'].map(name=>new File(['photo'],name,{type:'image/jpeg'}));
 const db={from(table){const q={select(){return q},eq(){return q},insert(){return q},delete(){deleted.push(table);return q},single:async()=>({data:{id:'obs'},error:null}),then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}};return q},storage:{from:()=>({remove:async paths=>{cleanup.push(...paths);return {error:null}}})}};
 const context=vm.createContext({state:{project:'job',profile:{id:'safety'}},db,document:dom.window.document,File,FormData:dom.window.FormData,frame:html=>dom.window.document.querySelector('#app').innerHTML=html,captureView:()=>()=>true,localDateKey:()=> '2026-10-09',tr:en=>en,esc:value=>String(value??''),back(){},mountReportSignatures(){},reportApprovals:()=>({}),draftFilesFor:async()=>files,upload:async(id,kind,file,owner)=>{uploads.push({id,kind,name:file.name,owner});if(failSecond&&uploads.length===2)throw Error('Upload failed');return {id:file.name,path:file.name}},clearDraft:async()=>cleared.push(true),confirmAction(){},load:async()=>{},render(){},error:err=>errors.push(err.message),console});
 vm.runInContext(fn('newObservation'),context);await context.newObservation();const form=dom.window.document.querySelector('#observation');form.elements.area.value='Floor 3';form.elements.description.value='Unprotected floor opening';assert.equal(form.querySelector('[name="photo"]').multiple,true);
 await form.onsubmit({preventDefault(){},target:form});assert.deepEqual(uploads.map(photo=>photo.name),['kept-one.jpg','kept-two.jpg']);assert.ok(uploads.every(photo=>photo.kind==='before'&&photo.owner.project==='job'&&photo.owner.user==='safety'));
 assert.deepEqual(errors,failSecond?['Upload failed']:[]);assert.deepEqual(cleanup,failSecond?['kept-one.jpg']:[]);assert.equal(deleted.includes('observations'),failSecond);assert.equal(cleared.length,failSecond?0:1);assert.equal(form.querySelector('[type="submit"]').disabled,false);
 dom.window.close();
});
