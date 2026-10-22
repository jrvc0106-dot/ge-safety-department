import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadRegisteredOrientationEvidence} from '../src/registered-orientation-photo-loader.js';

const t=(en,es)=>en;
const record={
 orientation_photo_path:'u/project/face.jpg',
 sticker_photo_path:'u/project/sticker.jpg',
 orientation_document_photo_path:'u/project/orientation.jpg',
 certificate_photo_paths:['u/project/certificate-a.jpg','u/project/certificate-b.jpg']
};
test('Register Safety Orientation PDF loads face, sticker, document and all linked certificates',async()=>{
 const calls=[];
 const photos=await loadRegisteredOrientationEvidence(record,{tr:t,fetchImage:async p=>{calls.push(p);return 'blob:'+p},delay:async()=>{}});
 assert.equal(photos.face,'blob:u/project/face.jpg');
 assert.equal(photos.sticker,'blob:u/project/sticker.jpg');
 assert.equal(photos.document,'blob:u/project/orientation.jpg');
 assert.deepEqual(photos.certificates,['blob:u/project/certificate-a.jpg','blob:u/project/certificate-b.jpg']);
 assert.equal(calls.length,5);
});
test('orientation photo downloads retry once after a transient Supabase empty response',async()=>{
 let attempts=0;
 const r=await loadRegisteredOrientationEvidence({orientation_photo_path:'u/p/face.jpg'},{
  fetchImage:async()=>{attempts++;return attempts===1?'':'blob:valid'},tr:t,delay:async()=>{}
 });
 assert.equal(attempts,2);assert.equal(r.face,'blob:valid');
 assert.equal(r.sticker,'');
});
test('orientation photo downloads retry once after a transient network exception',async()=>{
 let attempts=0;
 const r=await loadRegisteredOrientationEvidence({sticker_photo_path:'u/p/sticker.jpg'},{
  fetchImage:async()=>{if(++attempts===1)throw Error('temporary offline');return 'blob:sticker'},
  tr:t,delay:async()=>{}
 });
 assert.equal(attempts,2);assert.equal(r.sticker,'blob:sticker');
});
test('permanently unavailable evidence produces a specific message rather than silently omitting a required photo',async()=>{
 let attempts=0;
 await assert.rejects(loadRegisteredOrientationEvidence(record,{
  fetchImage:async path=>{attempts++;return path.includes('sticker')?'':'blob:'+path},tr:t,delay:async()=>{}
 }),/Sticker Number Photo/);
 assert.ok(attempts>=2);
});
test('optional paths absent from an old record do not cause false errors',async()=>{
 const r=await loadRegisteredOrientationEvidence({},{
  fetchImage:async()=>{throw Error('should not fetch')},tr:t,delay:async()=>{}
 });
 assert.deepEqual(r,{face:'',sticker:'',document:'',certificates:[]});
});
test('SQL policy permits only original orientation evidence paths, for the authorized jobsite or Admin',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261022035000_fix_registered_orientation_photo_read_access.sql',import.meta.url),'utf8');
 for(const col of ['orientation_photo_path','sticker_photo_path','orientation_document_photo_path','certificate_photo_paths'])
  assert.ok(sql.includes('so.'+col),col);
 assert.match(sql,/bucket_id = 'orientation-photos'/);
 assert.match(sql,/pm\.project_id = so\.project_id/);
 assert.match(sql,/pm\.user_id = \(select auth\.uid\(\)\)/);
 assert.match(sql,/p\.role = 'admin'/);
 assert.doesNotMatch(sql,/create policy.+using \(true\)/i);
 assert.doesNotMatch(sql,/to public|to anon|grant select to anon/i);
 const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(src,/loadRegisteredOrientationEvidence\(record,/);
 assert.match(src,/fetchImage:path=>signedDisplayImage\('orientation-photos',path,3600\)/);
});
