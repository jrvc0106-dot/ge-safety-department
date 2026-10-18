import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {weeklyBackupDue,tabletBackupScope,createVerifiedTabletBackup} from '../src/tablet-weekly-backup.js';

const DAY=24*60*60*1000;
test('weekly tablet backup triggers first use and every seven days, never before due date',()=>{
 const now=Date.parse('2026-10-18T03:00:00Z');
 assert.equal(weeklyBackupDue(null,now),true);
 assert.equal(weeklyBackupDue({savedAt:new Date(now-7*DAY+1).toISOString()},now),false);
 assert.equal(weeklyBackupDue({savedAt:new Date(now-7*DAY).toISOString()},now),true);
 assert.equal(weeklyBackupDue({savedAt:new Date(now-2*DAY).toISOString()},now),false);
 assert.equal(tabletBackupScope('admin-a','site-b'),'admin-a|site-b');
});
test('automatic snapshot confirms backend, downloads verified archive and persists on tablet before success',async()=>{
 const calls=[],saveData=[];
 const db={functions:{invoke:async(name,{body})=>{
  calls.push({name,body});
  if(name==='create-cloud-backup')return {data:{ok:true,id:'snapshot-1'}};
  if(name==='backup-cloud')return {data:{files:[{name:'manifest.json'}],total_bytes:15,backup_number:'GE-2026-10-18'}};
  throw Error('unexpected service');
 }}};
 const info=await createVerifiedTabletBackup({db,userId:'admin',projectId:'job-a',
  prepare:async result=>{assert.equal(result.files.length,1);return {blob:new Blob(['verified ZIP'],{type:'application/zip'}),name:'GE-2026-10-18.zip'}},
  save:async value=>{saveData.push(value);return {...value,savedAt:'2026-10-18T03:00:00Z'}}
 });
 assert.equal(info.source,'automatic');
 assert.equal(info.name,'GE-2026-10-18.zip');
 assert.equal(saveData.length,1);
 assert.equal(saveData[0].userId,'admin');
 assert.equal(saveData[0].projectId,'job-a');
 assert.deepEqual(calls.map(x=>x.name),['create-cloud-backup','backup-cloud']);
 assert.equal(calls[1].body.backup_id,'snapshot-1');
});
test('server or verification errors never claim an automatically stored backup',async()=>{
 let writes=0;
 const brokenServer={functions:{invoke:async()=>({data:{ok:false,error:'Server unavailable'}})}};
 await assert.rejects(createVerifiedTabletBackup({db:brokenServer,userId:'admin',projectId:'job',save:async()=>{writes++}}),/Server unavailable/);
 const db={functions:{invoke:async name=>name==='create-cloud-backup'?{data:{ok:true,id:'b1'}}:{data:{files:[]}}}};
 await assert.rejects(createVerifiedTabletBackup({db,userId:'admin',projectId:'job',prepare:async()=>{throw Error('SHA-256 mismatch')},save:async()=>{writes++}}),/SHA-256 mismatch/);
 assert.equal(writes,0);
});
test('local storage failure is not reported as completed, even if snapshot succeeded',async()=>{
 const db={functions:{invoke:async name=>name==='create-cloud-backup'?{data:{ok:true,id:'b1'}}:{data:{files:[]}}}};
 await assert.rejects(createVerifiedTabletBackup({db,userId:'admin',projectId:'job',
  prepare:async()=>({name:'report.zip',blob:new Blob(['archive'])}),
  save:async()=>{throw Error('iPad quota exceeded')}
 }),/iPad quota exceeded/);
});
test('weekly automation is limited to admin sessions and existing manual Cloud Backup remains available',()=>{
 const code=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(code,/state\.profile\?\.role!=='admin'/);
 assert.match(code,/document\.hidden/);
 assert.match(code,/weeklyBackupDue\(existing\)/);
 assert.match(code,/data-tablet-download/);
 assert.match(code,/id="create-cloud-backup"/);
 assert.match(code,/backupCloudCall\(\{action:'local_download'/);
 assert.match(code,/saveTabletBackup\(\{userId:state\.session\.user\.id/);
});
