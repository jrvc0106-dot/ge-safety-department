// Storage downloads are shared within the signed-in session. Retired blob URLs
// are released after navigation, once no visible image still references them.
export function createImageCache({limit=64,now=Date.now,revoke=url=>URL.revokeObjectURL(url)}={}){
 const entries=new Map(),retired=new Set();
 function retire(entry){entry.promise.then(url=>{if(url?.startsWith('blob:'))retired.add(url)}).catch(()=>{})}
 return {
  get(key,load,ttl=300000){
   const old=entries.get(key);if(old&&(old.pending||old.expires>now())){entries.delete(key);entries.set(key,old);return old.promise}
   if(old){entries.delete(key);retire(old)}
   const entry={pending:true,expires:0,promise:null};
   entry.promise=Promise.resolve().then(load).then(url=>{entry.pending=false;entry.expires=now()+ttl;if(!url&&entries.get(key)===entry)entries.delete(key);return url},err=>{if(entries.get(key)===entry)entries.delete(key);throw err});
   entries.set(key,entry);
   while(entries.size>limit){const [first,value]=entries.entries().next().value;entries.delete(first);retire(value)}
   return entry.promise;
  },
  collect(active=new Set()){for(const url of retired)if(!active.has(url)){revoke(url);retired.delete(url)}},
  reset(){for(const entry of entries.values())retire(entry);entries.clear()},
  get size(){return entries.size}
 };
}

export function createTaskQueue(concurrency=4){
 let active=0;const pending=[];
 function drain(){while(active<concurrency&&pending.length){const {task,resolve,reject}=pending.shift();active++;Promise.resolve().then(task).then(resolve,reject).finally(()=>{active--;drain()})}}
 return task=>new Promise((resolve,reject)=>{pending.push({task,resolve,reject});drain()});
}
