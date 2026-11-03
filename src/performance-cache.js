// Lightweight, session-scoped request deduplication for non-critical UI badges.
// Never cache reports, medical data, photographs or mutation responses.
export function createExpiringRequestCache({ttl=8000,limit=2,now=Date.now}={}){
 const entries=new Map();
 function trim(){
  const max=Math.max(1,Number.isFinite(limit)?Math.floor(limit):2);
  // Discard completed, expired badges first, preserving active requests.
  if(entries.size>max){
   const time=now();
   for(const [key,entry] of entries){
    if(entries.size<=max)break;
    if(!entry.pending&&entry.expires<=time)entries.delete(key);
   }
  }
  while(entries.size>max){
   // Keep in-flight requests available for deduplication when possible.
   const completed=[...entries].find(([,entry])=>!entry.pending);
   entries.delete(completed?completed[0]:entries.keys().next().value);
  }
 }
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
