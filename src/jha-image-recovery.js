import {photoDimensions} from './photo-optimizer.js';

// Safari can decode some HEIC camera images locally even when the optional
// heic2any CDN fails. Keep this fallback exclusively for Daily Report / JHA.
export async function nativeJhaHeicToJpeg(file,{env=globalThis}={}){
 const heic=/image\\/hei[cf]/i.test(file?.type||'')||/\\.hei[cf]$/i.test(file?.name||'');
 if(!heic)throw Error('Not a HEIC camera image');
 let image=null,url='',surface=null;
 try{
  if(typeof env.createImageBitmap==='function'){
   try{image=await env.createImageBitmap(file)}catch{}
  }
  if(!image){
   if(!env.URL?.createObjectURL||!env.Image)throw Error('HEIC decoder unavailable');
   url=env.URL.createObjectURL(file);
   image=new env.Image();
   await new Promise((resolve,reject)=>{
    image.onload=resolve;image.onerror=()=>reject(Error('iPad could not decode this HEIC photo'));
    image.src=url;
   });
  }
  const w=image.width||image.naturalWidth,h=image.height||image.naturalHeight;
  if(!w||!h)throw Error('HEIC photo has no valid dimensions');
  surface=env.document.createElement('canvas');
  const dimensions=photoDimensions(w,h);
  surface.width=dimensions.width;surface.height=dimensions.height;
  const ctx=surface.getContext?.('2d');
  if(!ctx)throw Error('Canvas unavailable for JHA camera photo');
  ctx.drawImage(image,0,0,dimensions.width,dimensions.height);
  const blob=await new Promise(resolve=>surface.toBlob(resolve,'image/jpeg',.88));
  if(!blob?.size)throw Error('iPad HEIC conversion did not create an image');
  return new env.File([blob],String(file.name||'JHA-photo').replace(/\\.hei[cf]$/i,'')+'.jpg',
    {type:'image/jpeg',lastModified:file.lastModified||Date.now()});
 }finally{
  image?.close?.();
  if(url)env.URL.revokeObjectURL(url);
  if(surface){surface.width=0;surface.height=0}
 }
}
export async function normalizeJhaPhoto(file,{normalize,fallback=nativeJhaHeicToJpeg}={}){
 if(typeof normalize!=='function')throw Error('Photo normalizer missing');
 try{return await normalize(file)}
 catch(error){
  if(!/\\.hei[cf]$/i.test(file?.name||'')&&!/image\\/hei[cf]/i.test(file?.type||''))throw error;
  try{return await fallback(file)}
  catch{throw new Error('Unable to convert this iPad HEIC photo. Export it as JPEG and retry.',{cause:error})}
 }
}
