import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {attachJhaPhotos} from '../src/jha-photos.js';
test('JHA previews restored and newly added photos, appends batches and removes exactly the chosen photo',async()=>{
 const dom=new JSDOM('<form id="walk-form"><input type="file" name="photos_0" multiple><input type="file" name="photos_1" multiple></form>');
 const previous={document:globalThis.document,MutationObserver:globalThis.MutationObserver};globalThis.document=dom.window.document;globalThis.MutationObserver=dom.window.MutationObserver;
 const form=document.querySelector('form'),inputs=form.querySelectorAll('input'),removed=[],errors=[],saved={photos_0:[{path:'restored',name:'restored.jpg'}],photos_1:[]};
 const controller=attachJhaPhotos(form,{list:name=>saved[name],add:async(name,files)=>{const items=files.map(file=>({name:file.name,path:file.name}));saved[name].push(...items);return items},remove:async(name,item)=>{removed.push(item.path);saved[name]=saved[name].filter(x=>x!==item)},preview:async item=>'https://example.com/'+item.path,download:async item=>({name:item.name}),tr:x=>x,onError:e=>errors.push(e)});
 function select(input,names){Object.defineProperty(input,'files',{configurable:true,value:names.map(name=>Object.assign(new Blob(['image'],{type:'image/jpeg'}),{name}))});input.dispatchEvent(new dom.window.Event('change',{bubbles:true}))}
 try{
  select(inputs[0],['first.jpg']);await controller.files('photos_0');select(inputs[0],['second.jpg']);select(inputs[1],['other.jpg']);await controller.files('photos_1');
  assert.equal(form.querySelectorAll('.jha-photo-card').length,4);assert.equal(form.querySelectorAll('.jha-photo-card img').length,4);
  assert.deepEqual((await controller.files('photos_0')).map(x=>x.name),['restored.jpg','first.jpg','second.jpg']);
  form.querySelectorAll('.jha-photo-card button')[1].click();assert.deepEqual((await controller.files('photos_0')).map(x=>x.name),['restored.jpg','second.jpg']);assert.deepEqual(removed,['first.jpg']);
  form.querySelector('.jha-photo-card button').click();assert.deepEqual((await controller.files('photos_0')).map(x=>x.name),['second.jpg']);assert.deepEqual((await controller.files('photos_1')).map(x=>x.name),['other.jpg']);
  form.dataset.submitting='true';form.querySelector('.jha-photo-card button').click();assert.equal((await controller.files('photos_0')).length,1);assert.deepEqual(errors,[]);
 }finally{form.remove();await Promise.resolve();Object.assign(globalThis,previous);dom.window.close()}
});
test('removing a photo during upload waits for its storage ID and prevents it from being saved',async()=>{
 const dom=new JSDOM('<form><input type="file" name="photos_0"></form>');const previous={document:globalThis.document,MutationObserver:globalThis.MutationObserver};globalThis.document=dom.window.document;globalThis.MutationObserver=dom.window.MutationObserver;
 let resolve;const gate=new Promise(r=>resolve=r),removed=[],errors=[],form=document.querySelector('form'),input=form.querySelector('input');
 const controller=attachJhaPhotos(form,{list:()=>[],add:async()=>{await gate;return [{path:'uploaded',name:'image.jpg'}]},remove:async(_,item)=>removed.push(item.path),preview:async()=>'',download:async()=>{},tr:x=>x,onError:e=>errors.push(e)});
 try{Object.defineProperty(input,'files',{value:[Object.assign(new Blob(['image']),{name:'image.jpg'})]});input.dispatchEvent(new dom.window.Event('change'));form.querySelector('button').click();resolve();assert.deepEqual(await controller.files('photos_0'),[]);assert.deepEqual(removed,['uploaded']);assert.deepEqual(errors,[])}finally{form.remove();await Promise.resolve();Object.assign(globalThis,previous);dom.window.close()}
});
