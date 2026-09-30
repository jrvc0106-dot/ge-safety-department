import {test} from 'node:test';import assert from 'node:assert/strict';import {createBackupZip,prepareLocalBackup} from '../src/local-backup.js';
test('local ZIP stores UTF-8 filenames, payloads and a standard ZIP directory',async()=>{
 const payload=new TextEncoder().encode('123456789'),zip=createBackupZip([{name:'evidencia/seguridad_ñ.txt',bytes:payload}]);const bytes=new Uint8Array(await zip.arrayBuffer()),view=new DataView(bytes.buffer),nameLength=view.getUint16(26,true);
 assert.equal(view.getUint32(0,true),0x04034b50);assert.equal(view.getUint32(14,true),0xcbf43926);assert.equal(new TextDecoder().decode(bytes.slice(30,30+nameLength)),'evidencia/seguridad_ñ.txt');assert.deepEqual(bytes.slice(30+nameLength,30+nameLength+payload.length),payload);assert.equal(view.getUint32(bytes.length-22,true),0x06054b50);assert.equal(view.getUint16(bytes.length-12,true),1);
});
test('local ZIP rejects duplicate paths and directory traversal',()=>{
 for(const name of ['../escape','/absolute','a/../b','a\\b','a//b'])assert.throws(()=>createBackupZip([{name,bytes:new Uint8Array()}]),/filename/);
 assert.throws(()=>createBackupZip([{name:'same',bytes:new Uint8Array()},{name:'same',bytes:new Uint8Array()}]),/filename/);
});
test('local backup refuses altered evidence and reports successful file verification',async()=>{
 const originalFetch=globalThis.fetch,bytes=new TextEncoder().encode('safety evidence'),hash=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex'),progress=[];
 globalThis.fetch=async()=>new Response(bytes);try{
  const input={backup_number:'BACKUP-1',total_bytes:bytes.length,files:[{url:'https://example.test/file',size:bytes.length,name:'data.json',sha256:hash}]};
  const result=await prepareLocalBackup(input,(...value)=>progress.push(value));assert.equal(result.name,'BACKUP-1.zip');assert.equal(result.blob.type,'application/zip');assert.deepEqual(progress,[[1,1]]);
  input.files[0].sha256='bad';await assert.rejects(prepareLocalBackup(input),/verification failed/);
 }finally{globalThis.fetch=originalFetch}
});
