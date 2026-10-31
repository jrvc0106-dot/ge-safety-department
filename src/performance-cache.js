// Lightweight, session-scoped request deduplication for non-critical UI badges.
// Never cache reports, medical data, photographs or mutation responses.
export function createExpiringRequestCache({ttl=8000,limit=2,now=Date.now}={}){
 const entries=new Map();
 function trim(){while(entries.size>Math.max(1,limit)){entries.delete(entries.keys().next().value)}}
 return {
  get(key,fetch){
   if(!key||typeof fetch!=='function')return Promise.reject(new TypeError('A key and request are required'));
   const previous=entries.get(key);
   if(previous&&(previous.pending||previous.expires>now())){
    entries.delete(key);entries.set(key,previous);
    return previous.promise;
   }
   const entry={pending:true,expires:0,promise:null};
   entry.promise=Promise.resolve().then(fetch).then(result=>{
    if(result?.error)throw result.error;
    if(entries.get(key)===entry){entry.pending=false;entry.expires=now()+ttl}
    return result;
   },error=>{if(entries.get(key)===entry)entries.delete(key);throw error});
   entries.delete(key);entries.set(key,entry);trim();
   return entry.promise;
  },
  invalidate(key){if(key)entries.delete(key);else entries.clear()},
  get size(){return entries.size}
 };
}
