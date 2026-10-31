import {test} from 'node:test';
import assert from 'node:assert/strict';
import {uploadJhaPhotoBatch} from '../src/jha-evidence-batch.js';

const photo=(name,size=3000)=>({name,size,type:'image/jpeg'});
function setup(filesByItem,{storageUpload,insertPhotoRows,normalize,concurrency=3}={}){
 const stored=[],inserts=[],calls=[];
 const options={
  filesByItem,itemIds:new Map(filesByItem.map((_,i)=>[i,'item-'+i])),
  statuses:filesByItem.map((_,i)=>i%2?'unsafe':'safe'),userId:'safety-user',
  normalize:normalize|| (async file=>file),
  storageUpload:storageUpload|| (async(path)=>{calls.push(path);return {error:null}}),
  insertPhotoRows:insertPhotoRows|| (async rows=>{inserts.push(rows);return {error:null}}),
  makePath:(id,file)=>id+'/'+file.name,onStored:path=>stored.push(path),
  tooLargeError:()=>new Error('oversized JHA evidence'),
  concurrency
 };
 return {options,stored,inserts,calls};
}

test('multi-photo JHA uploads are bounded and write exactly one ordered metadata batch',async()=>{
 const files=[[photo('one.jpg'),photo('two.jpg')],[photo('three.jpg'),photo('four.jpg')],[photo('five.jpg'),photo('six.jpg')]];
 let active=0,maximum=0;
 const t=setup(files,{storageUpload:async()=>{active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setTimeout(resolve,4));active--;return {error:null}}});
 const rows=await uploadJhaPhotoBatch(t.options);
 assert.equal(maximum,3,'at most three photos decoded/uploaded concurrently');
 assert.ok(maximum>=2,'multiple uploads overlap instead of serial processing');
 assert.equal(rows.length,6);
 assert.equal(t.inserts.length,1,'write all photo metadata in one request');
 assert.deepEqual(rows.map(r=>r.path),['item-0/one.jpg','item-0/two.jpg','item-1/three.jpg','item-1/four.jpg','item-2/five.jpg','item-2/six.jpg']);
 assert.deepEqual(rows.map(r=>r.kind),['correction','correction','hazard','hazard','correction','correction']);
 assert.ok(rows.every(r=>r.uploaded_by==='safety-user'));
});

test('out-of-order storage completions preserve the worker-selected photo order',async()=>{
 const files=[[photo('slow.jpg'),photo('fast.jpg'),photo('medium.jpg')]];
 const t=setup(files,{storageUpload:async(path)=>{
  await new Promise(resolve=>setTimeout(resolve,path.includes('slow')?18:path.includes('medium')?9:1));
  return {error:null};
 }});
 const result=await uploadJhaPhotoBatch(t.options);
 assert.deepEqual(result.map(row=>row.path),['item-0/slow.jpg','item-0/fast.jpg','item-0/medium.jpg']);
 assert.deepEqual(t.inserts[0],result);
});

test('upload failure waits for every in-flight photo before allowing rollback',async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve});
 const t=setup([[photo('bad.jpg'),photo('good.jpg')]],{
  storageUpload:async(path)=>path.endsWith('bad.jpg')?{error:new Error('upload denied')}:(await gate,{error:null})
 });
 let finished=false;
 const operation=uploadJhaPhotoBatch(t.options).catch(error=>{finished=true;throw error});
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(finished,false,'rollback must not begin while another photo is uploading');
 release();
 await assert.rejects(operation,/upload denied/);
 assert.deepEqual(t.stored,['item-0/good.jpg'],'all uploaded file paths are available for cleanup');
 assert.equal(t.inserts.length,0,'never partially create evidence metadata');
});

test('any invalid optimized photo aborts metadata and returns all stored paths for cleanup',async()=>{
 const t=setup([[photo('good.jpg'),photo('too-big.jpg')]],{
  normalize:async file=>file.name==='too-big.jpg'?photo(file.name,11*1024*1024):file
 });
 await assert.rejects(uploadJhaPhotoBatch(t.options),/oversized JHA evidence/);
 assert.deepEqual(t.stored,['item-0/good.jpg']);
 assert.equal(t.inserts.length,0);
});

test('metadata insertion failure leaves all uploaded file paths available for rollback',async()=>{
 const t=setup([[photo('a.jpg'),photo('b.jpg')]],{insertPhotoRows:async()=>({error:new Error('database offline')})});
 await assert.rejects(uploadJhaPhotoBatch(t.options),/database offline/);
 assert.equal(t.stored.length,2);
});

test('empty photo evidence does not send a database request; every checklist item must exist',async()=>{
 const empty=setup([[],[]]);
 assert.deepEqual(await uploadJhaPhotoBatch(empty.options),[]);
 assert.equal(empty.inserts.length,0);
 const missing=setup([[photo('a.jpg')]]);
 missing.options.itemIds.clear();
 await assert.rejects(uploadJhaPhotoBatch(missing.options),/Checklist item was not saved/);
 assert.equal(missing.stored.length,0);
});
