import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {JSDOM} from 'jsdom';
import {attachJhaPhotos,jhaPhotoController} from '../src/jha-photos.js';
import {putOfflineDraftFile,getOfflineDraftFile,deleteOfflineDraftFiles} from '../src/offline-draft-store.js';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const ast=parseAst(source);
const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='enableAutoDraft');
if(!node)throw Error('GE ONE draft activation not found');
const enableSource=source.slice(node.start,node.end);

test('iPhone IndexedDB temporary open failure is recoverable, saved evidence round-trips and upgrades reopen',async()=>{
 const previous=globalThis.indexedDB,records=new Map();
 let opens=0,closes=0,database;
 const store={
  put(row){records.set(row.id,row);return{}},
  get(id){const request={};queueMicrotask(()=>{request.result=records.get(id);request.onsuccess?.()});return request},
  delete(id){records.delete(id);return{}}
 };
 const db={
  objectStoreNames:{contains:()=>true},
  transaction(_name,_mode){const tx={objectStore:()=>store};queueMicrotask(()=>tx.oncomplete?.());return tx},
  close(){closes++}
 };
 globalThis.indexedDB={open(){
  opens++;const request={};
  queueMicrotask(()=>{
   if(opens===1){request.error=Error('Temporary iOS IndexedDB startup');request.onerror?.()}
   else{database=db;request.result=db;request.onsuccess?.()}
  });
  return request;
 }};
 try{
  const file=new File([new Uint8Array([1,2,3,4])],'evidence.jpg',{type:'image/jpeg',lastModified:1234});
  await assert.rejects(putOfflineDraftFile('photo-1',file),/Temporary iOS IndexedDB startup/);
  await putOfflineDraftFile('photo-1',file);
  let restored=await getOfflineDraftFile('photo-1');
  assert.equal(restored.name,'evidence.jpg');
  assert.equal(restored.type,'image/jpeg');
  assert.equal(restored.lastModified,1234);
  assert.deepEqual(new Uint8Array(await restored.arrayBuffer()),new Uint8Array([1,2,3,4]));
  assert.equal(opens,2);
  database.onversionchange();
  assert.equal(closes,1);
  restored=await getOfflineDraftFile('photo-1');
  assert.equal(restored.name,'evidence.jpg');
  assert.equal(opens,3);
  await deleteOfflineDraftFiles(['photo-1']);
  assert.equal(await getOfflineDraftFile('photo-1'),null);
 }finally{globalThis.indexedDB=previous;database?.onversionchange?.()}
});

test('offline restored JHA evidence shows a local preview and exports its saved File without cloud access',async()=>{
 const dom=new JSDOM('<form id="walk-form"><input type="file" name="photos_0" multiple></form>',{url:'https://example.test'});
 const prior={document:globalThis.document,MutationObserver:globalThis.MutationObserver,URL:globalThis.URL};
 const {document:doc,window:win}=dom.window,form=doc.querySelector('form');
 const blobs=[],revoked=[],failures=[],localDeletes=[],file=new win.File(['saved offline'],'site-photo.jpg',{type:'image/jpeg'});
 let cloudCalls=0,networkPreviews=0;
 const fakeURL={createObjectURL:()=>{const value='blob:offline-'+(blobs.length+1);blobs.push(value);return value},revokeObjectURL:value=>revoked.push(value)};
 Object.assign(globalThis,{document:doc,MutationObserver:win.MutationObserver,URL:fakeURL});
 const files=new Map([['draft-key',{photos_0:[{path:'unreachable-cloud-photo',localId:'local-only',name:'site-photo.jpg',type:'image/jpeg'}]}]]);
 const ctx=vm.createContext({
  document:doc,window:win,URL:fakeURL,formDraftKey:()=> 'draft-key',draftOwner:()=>({user:'safety',project:'jobsite'}),
  draftFileState:files,draftUploads:new Map(),draftTimers:new Map(),draftLocalTimers:new Map(),
  restoreDraft:async()=>false,setDraftStatus(){},renderDraftFileBadges(){},persistDraft:async()=>{},
  getOfflineDraftFile:async(id)=>id==='local-only'?file:null,
  deleteOfflineDraftFiles:async ids=>localDeletes.push(...ids),
  signedDisplayImage:async()=>{networkPreviews++;throw Error('Cloud unavailable')},
  db:{storage:{from(){return{download:async()=>{cloudCalls++;throw Error('Offline')}}}}},
  attachJhaPhotos,jhaPhotoController,tr:en=>en,error:e=>failures.push(e),setTimeout,clearTimeout,
  localStorage:{setItem(){}},serializeDraftForm:()=>({}),Event:win.Event,
 });
 try{
  vm.runInContext('let activeDraftFlush=null;\n'+enableSource,ctx);
  await ctx.enableAutoDraft(form,'daily_safety_walk');
  const controller=jhaPhotoController(form);
  assert.ok(controller);
  const recovered=await controller.files('photos_0');
  assert.equal(recovered.length,1);
  assert.equal(recovered[0].name,'site-photo.jpg');
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(form.querySelector('.jha-photo-card img')?.src,blobs[0]);
  assert.equal(cloudCalls,0);
  assert.equal(networkPreviews,0);
  assert.equal(failures.length,0);
  // Removing the photo while still offline updates draft metadata and IndexedDB only.
  form.querySelector('.jha-photo-card button').click();
  assert.deepEqual(await controller.files('photos_0'),[]);
  assert.deepEqual(localDeletes,['local-only']);
  assert.equal(files.get('draft-key').photos_0.length,0);
  assert.equal(cloudCalls,0);
  form.remove();
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(revoked.includes(blobs[0]));
 }finally{
  Object.assign(globalThis,prior);
  dom.window.close();
 }
});


test('iPad offline draft save reports IndexedDB transaction abort instead of hanging',async()=>{
 const prior=globalThis.indexedDB;
 const database={
  objectStoreNames:{contains:()=>true},
  transaction(){
   const tx={objectStore:()=>({put:()=>queueMicrotask(()=>tx.onabort?.())})};
   return tx;
  },
  close(){}
 };
 globalThis.indexedDB={open(){
  const request={result:database};
  queueMicrotask(()=>request.onsuccess?.());
  return request;
 }};
 try{
  const file=new File(['photo data'],'proof.jpg',{type:'image/jpeg'});
  await assert.rejects(putOfflineDraftFile('unsaved-photo',file),/save aborted/);
 }finally{
  database.onversionchange?.();
  globalThis.indexedDB=prior;
 }
});
