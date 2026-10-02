import {createTaskQueue} from './image-cache.js';

export function photoDimensions(width,height){
 const scale=Math.min(1,3072/Math.max(width,height),Math.sqrt(6000000/(width*height)));
 return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
async function decodePhoto(file){
 if(typeof createImageBitmap==='function'){
  try{return await createImageBitmap(file)}catch{}
 }
 const url=URL.createObjectURL(file),image=new Image();
 try{
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url});
  return {width:image.naturalWidth,height:image.naturalHeight,image,close(){image.src=''}};
 }finally{URL.revokeObjectURL(url)}
}
export function createPhotoOptimizer({decode=decodePhoto,canvas=()=>document.createElement('canvas'),makeFile=(blob,file)=>new File([blob],file.name,{type:file.type,lastModified:file.lastModified}),queue=createTaskQueue(1)}={}){
 const prepared=new WeakMap();
 return function optimize(file){
  // Keep documents, screenshots, transparency and small images unchanged.
  if(!file||file.size<1024*1024||!['image/jpeg','image/webp'].includes(file.type))return Promise.resolve(file);
  if(prepared.has(file))return prepared.get(file);
  const pending=queue(async()=>{
   let bitmap,surface;
   try{
    bitmap=await decode(file);if(!bitmap.width||!bitmap.height)return file;
    const dimensions=photoDimensions(bitmap.width,bitmap.height);
    surface=canvas();surface.width=dimensions.width;surface.height=dimensions.height;
    const context=surface.getContext('2d');if(!context)return file;
    context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    context.drawImage(bitmap.image||bitmap,0,0,dimensions.width,dimensions.height);
    const blob=await new Promise(resolve=>surface.toBlob(resolve,file.type,.94));
    if(!blob?.size||blob.type!==file.type||blob.size>=file.size*.85)return file;
    const result=makeFile(blob,file);prepared.set(result,Promise.resolve(result));return result;
   }catch{return file}finally{
    bitmap?.close?.();if(surface){surface.width=0;surface.height=0}
   }
  });
  prepared.set(file,pending);return pending;
 };
}
export const optimizePhoto=createPhotoOptimizer();
