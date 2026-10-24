const DB_NAME='ge-offline-drafts-v1',STORE='evidence';
let dbPromise;
function openDb(){
 if(!('indexedDB' in globalThis))return Promise.reject(new Error('IndexedDB unavailable'));
 if(!dbPromise){
  const pending=new Promise((resolve,reject)=>{
   let rejected=false;
   const request=indexedDB.open(DB_NAME,1);
   request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'})};
   request.onerror=()=>{rejected=true;reject(request.error||new Error('IndexedDB open failed'))};
   request.onblocked=()=>{rejected=true;reject(new Error('Offline storage is blocked by another tab. Close other GE ONE tabs and retry.'))};
   request.onsuccess=()=>{
    const db=request.result;
    if(rejected){db.close();return}
    db.onversionchange=()=>{
     db.close();
     dbPromise=null; // A new session can reopen the upgraded store.
    };
    resolve(db);
   };
  });
  // iOS can transiently reject IndexedDB opens. Never cache a rejected promise
  // indefinitely; allow an explicit retry without losing the draft form.
  dbPromise=pending.catch(err=>{dbPromise=null;throw err});
 }
 return dbPromise;
}
export async function putOfflineDraftFile(id,file){
 const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({id,blob:file,name:file.name||'evidence',type:file.type||'application/octet-stream',lastModified:file.lastModified||Date.now()});tx.oncomplete=()=>resolve(id);tx.onerror=()=>reject(tx.error||new Error('IndexedDB save failed'))});
}
export async function getOfflineDraftFile(id){
 const db=await openDb();return new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).get(id);req.onsuccess=()=>{const row=req.result;resolve(row?new File([row.blob],row.name,{type:row.type,lastModified:row.lastModified}):null)};req.onerror=()=>reject(req.error||new Error('IndexedDB read failed'))});
}
export async function deleteOfflineDraftFiles(ids=[]){
 if(!ids.length)return;const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);for(const id of ids)store.delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('IndexedDB cleanup failed'))});
}
