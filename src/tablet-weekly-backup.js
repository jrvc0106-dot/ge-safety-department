
import {prepareLocalBackup} from './local-backup.js';

// Backups stored here belong to this browser profile on this tablet.
// iPadOS may clear website data; exporting a ZIP to Files remains an explicit user action.
const DB_NAME='ge-one-verified-tablet-backups';
const ONE_WEEK=7*24*60*60*1000;
export const weeklyBackupDue=(latest,now=Date.now())=>!latest||!Number.isFinite(Date.parse(latest.savedAt))||now-Date.parse(latest.savedAt)>=ONE_WEEK;

function openDatabase(){
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(Error('Local backup storage is unavailable on this device.'));return}
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains('metadata'))db.createObjectStore('metadata',{keyPath:'key'});
   if(!db.objectStoreNames.contains('archives'))db.createObjectStore('archives',{keyPath:'key'});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error('Cannot open tablet backup storage'));
  request.onblocked=()=>reject(Error('Tablet backup storage is blocked by another app window'));
 });
}
function runTransaction(db,names,mode,work){
 return new Promise((resolve,reject)=>{
  let value;
  const tx=db.transaction(names,mode);
  tx.oncomplete=()=>resolve(value);
  tx.onerror=()=>reject(tx.error||Error('Tablet backup transaction failed'));
  tx.onabort=()=>reject(tx.error||Error('Tablet backup transaction aborted'));
  work(tx,result=>{value=result});
 });
}
export const tabletBackupScope=(userId,projectId)=>String(userId)+'|'+String(projectId);
export async function listTabletBackups(userId,projectId){
 const db=await openDatabase();
 try{
  const rows=await runTransaction(db,['metadata'],'readonly',(tx,set)=>{
   const request=tx.objectStore('metadata').getAll();
   request.onsuccess=()=>set(request.result||[]);
  });
  return rows.filter(row=>row.scope===tabletBackupScope(userId,projectId))
   .sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)));
 }finally{db.close()}
}
export async function latestTabletBackup(userId,projectId){
 return (await listTabletBackups(userId,projectId))[0]||null;
}
export async function getTabletBackup(key){
 const db=await openDatabase();
 try{
  const record=await runTransaction(db,['archives'],'readonly',(tx,set)=>{
   const request=tx.objectStore('archives').get(key);
   request.onsuccess=()=>set(request.result||null);
  });
  if(!record?.blob||record.blob.size!==record.size)throw Error('The tablet backup is missing or incomplete.');
  return record;
 }finally{db.close()}
}
export async function saveTabletBackup({userId,projectId,backupId,name,blob,source='manual',savedAt=new Date().toISOString()}){
 if(!userId||!projectId||!backupId||!(blob instanceof Blob)||!blob.size||!name)throw Error('Incomplete verified backup');
 const scope=tabletBackupScope(userId,projectId),key=scope+'|'+backupId;
 const metadata={key,scope,projectId,userId,backupId,name,source,size:blob.size,savedAt};
 const db=await openDatabase();
 try{
  await runTransaction(db,['metadata','archives'],'readwrite',tx=>{
   tx.objectStore('archives').put({key,blob,size:blob.size});
   tx.objectStore('metadata').put(metadata);
  });
  // Retain the newest two device copies per user and project. Clean up only AFTER
  // confirming the new archive has committed, so a failed write never loses a copy.
  const keep=await listTabletBackups(userId,projectId);
  const stale=keep.slice(2);
  if(stale.length){
   try{await runTransaction(db,['metadata','archives'],'readwrite',tx=>{
    for(const old of stale){tx.objectStore('metadata').delete(old.key);tx.objectStore('archives').delete(old.key)}
   })}catch{/* Cleanup failure must never invalidate a successfully saved backup. */}
  }
  return metadata;
 }finally{db.close()}
}
export async function createVerifiedTabletBackup({db,userId,projectId,source='automatic',progress=()=>{}}){
 if(!userId||!projectId)throw Error('Missing backup owner or project');
 const created=await db.functions.invoke('create-cloud-backup',{body:{project_id:projectId}});
 if(created.error||!created.data?.ok||!created.data?.id)throw Error(created.data?.error||created.error?.message||'Project backup creation failed');
 const payload=await db.functions.invoke('backup-cloud',{body:{action:'local_download',project_id:projectId,backup_id:created.data.id}});
 if(payload.error||payload.data?.error||!Array.isArray(payload.data?.files))throw Error(payload.data?.error||payload.error?.message||'Verified backup download could not begin');
 const zip=await prepareLocalBackup(payload.data,progress); // SHA-256 every source file.
 if(!zip.blob.size)throw Error('Empty verified backup ZIP');
 const metadata=await saveTabletBackup({userId,projectId,backupId:created.data.id,name:zip.name,blob:zip.blob,source});
 return metadata; // A successful server snapshot alone is NOT local success.
}
