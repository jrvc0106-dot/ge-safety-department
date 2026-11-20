import {createTaskQueue} from './image-cache.js';

// JHA-only photo reduction. Preserve the original aspect ratio, never crop.
// A failed browser decode/encode returns the input unchanged.
export const jhaPhotoSize={maxEdge:1920,quality:0.84,minBytes:750000};
const queue=createTaskQueue(1);
export function jhaScaledSize(width,height,maxEdge=jhaPhotoSize.maxEdge){
 const scale=Math.min(1,maxEdge/Math.max(width,height));
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
export function optimizeJhaPhoto(file){
 if(!file||file.type!=='image/jpeg'||file.size<jhaPhotoSize.minBytes)return Promise.resolve(file);
 return queue(async()=>{
  let bitmap=null,canvas=null,url='';
  try{
   if(typeof createImageBitmap==='function'){
    try{bitmap=await createImageBitmap(file)}catch{}
   }
   if(!bitmap){
    if(typeof document==='undefined'||typeof Image==='undefined')return file;
    url=URL.createObjectURL(file);
    const image=new Image();
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url});
    bitmap={width:image.naturalWidth,height:image.naturalHeight,image};
   }
   const size=jhaScaledSize(bitmap.width,bitmap.height);
   if(!size.width||!size.height)return file;
   canvas=document.createElement('canvas');
   canvas.width=size.width;canvas.height=size.height;
   const context=canvas.getContext('2d');
   if(!context)return file;
   context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
   context.drawImage(bitmap.image||bitmap,0,0,size.width,size.height);
   const result=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',jhaPhotoSize.quality));
   if(!result?.size||result.size>=file.size*.9)return file;
   if(typeof File!=='undefined'&&file instanceof File)
    return new File([result],file.name.replace(/\.(jpeg|jpg)$/i,'')+'.jpg',{type:'image/jpeg',lastModified:file.lastModified||Date.now()});
   return result;
  }catch{return file}
  finally{
   bitmap?.close?.();
   if(url)URL.revokeObjectURL(url);
   if(canvas){canvas.width=0;canvas.height=0}
  }
 });
}
