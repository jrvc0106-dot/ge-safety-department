import {createTaskQueue} from './image-cache.js';

// Bounded uploads are faster than sending photos sequentially, without
// retaining an unbounded number of decoded files on an iPad.
// Only write ordered database rows AFTER every storage upload succeeds.
// On any failure all in-flight jobs settle before control returns to the
// report's existing rollback, preventing orphaned evidence objects.
export async function uploadJhaPhotoBatch({
 filesByItem,itemIds,statuses,userId,normalize,storageUpload,insertPhotoRows,
 makePath,onStored=()=>{},tooLargeError=()=>new Error('JHA photo exceeds 10 MB'),
 concurrency=3
}){
 if(!Array.isArray(filesByItem)||!itemIds?.get||!Array.isArray(statuses)||
   typeof normalize!=='function'||typeof storageUpload!=='function'||
   typeof insertPhotoRows!=='function'||typeof makePath!=='function')
  throw new TypeError('Invalid JHA evidence upload inputs');
 const jobs=[];
 for(let index=0;index<filesByItem.length;index++){
  const itemId=itemIds.get(index);
  if(!itemId)throw new Error('Checklist item was not saved');
  for(const original of filesByItem[index]||[]){
   jobs.push({original,itemId,kind:statuses[index]==='unsafe'?'hazard':'correction'});
  }
 }
 if(!jobs.length)return [];
 const queue=createTaskQueue(Math.max(1,Math.min(3,Math.floor(Number(concurrency)||3))));
 const settled=await Promise.allSettled(jobs.map(job=>queue(async()=>{
  const file=await normalize(job.original);
  if(!file?.size||file.size>10*1024*1024)throw tooLargeError();
  const path=makePath(job.itemId,file);
  const stored=await storageUpload(path,file);
  if(stored?.error)throw stored.error;
  onStored(path);
  return {item_id:job.itemId,path,kind:job.kind,uploaded_by:userId};
 })));
 const failed=settled.find(result=>result.status==='rejected');
 if(failed)throw failed.reason;
 // allSettled preserves original photo ordering even if uploads finish out of order
 const rows=settled.map(result=>result.value);
 const recorded=await insertPhotoRows(rows);
 if(recorded?.error)throw recorded.error;
 return rows;
}
