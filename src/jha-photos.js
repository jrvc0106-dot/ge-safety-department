const controllers=new WeakMap();
export function jhaPhotoController(form){return controllers.get(form)}
export function attachJhaPhotos(form,{list,add,remove,preview,download,tr,onError,allowLocalFinalUpload=false}){
 if(controllers.has(form))return controllers.get(form);
 const fields=new Map();let queue=Promise.resolve();
 const enqueue=task=>{const pending=queue.then(task);queue=pending.catch(onError);return pending};
 for(const input of form.querySelectorAll('input[type=file][name]')){
  const required=input.required;
  if(required)input.required=false;
  const entries=(list(input.name)||[]).map(item=>({item}));
  const gallery=document.createElement('div');gallery.className='jha-photo-gallery';input.after(gallery);fields.set(input.name,entries);
  function loadStoredPreview(entry,image,label){
   // Reuse preview requests so offline blob URLs survive redraws without leaks.
   if(entry.url){image.src=entry.url;return}
   if(!entry.previewTask)entry.previewTask=Promise.resolve().then(()=>preview(entry.item));
   entry.previewTask.then(url=>{
    if(!url)throw Error('Preview unavailable');
    if(url.startsWith('blob:')){
     if(!form.isConnected||!entries.includes(entry)){URL.revokeObjectURL(url);return}
     entry.url=url;
    }
    if(image.isConnected)image.src=url;
   }).catch(()=>{if(image.isConnected)label.textContent=tr('Preview unavailable: ','Vista no disponible: ')+image.alt});
  }
  function draw(){
   if(!form.isConnected)return;
   gallery.replaceChildren();
   if(allowLocalFinalUpload&&entries.some(entry=>entry.localOnly&&entry.file)){
    const status=document.createElement('p');
    status.className='jha-photo-local-warning';
    status.setAttribute('role','status');
    status.textContent=tr('Photo retained on this device. Complete the report to attach it; do not reload this page.','Foto conservada en este dispositivo. Complete el reporte para adjuntarla; no recargue la página.');
    gallery.append(status);
   }
   for(const entry of entries){
    const card=document.createElement('div');card.className='jha-photo-card';
    const image=document.createElement('img');image.alt=entry.file?.name||entry.item?.name||tr('Attached photo','Foto adjunta');
    const label=document.createElement('span');label.textContent=image.alt;
    const button=document.createElement('button');button.type='button';button.textContent=tr('Remove photo','Eliminar foto');button.disabled=form.dataset.submitting==='true';
    button.onclick=()=>{if(form.dataset.submitting==='true'||entry.removing)return;entry.removing=true;button.disabled=true;enqueue(async()=>{try{if(entry.item)await remove(input.name,entry.item);const index=entries.indexOf(entry);if(index>=0)entries.splice(index,1);if(entry.url)URL.revokeObjectURL(entry.url);draw()}catch(err){entry.removing=false;draw();throw err}})};
    card.append(image,label,button);gallery.append(card);
    if(entry.item&&/\.hei[cf]$/i.test(entry.file?.name||''))loadStoredPreview(entry,image,label);
    else if(entry.url)image.src=entry.url;
    else if(entry.file){entry.url=URL.createObjectURL(entry.file);image.src=entry.url}
    else if(entry.item)loadStoredPreview(entry,image,label);
    image.addEventListener('error',()=>{if(image.isConnected)label.textContent=tr('Preview unavailable: ','Vista no disponible: ')+image.alt});
   }
  }
  function selectFiles(files){
   if(form.dataset.submitting==='true'||!files.length)return;
   if(!input.multiple&&(required||form.id==='correction')&&entries.length){
    onError(new Error(tr('Remove the current photo before replacing it.','Quita la foto actual antes de reemplazarla.')));return;
   }
   const selected=files.map(file=>({file}));entries.push(...selected);draw();
   enqueue(async()=>{try{const saved=await add(input.name,selected.map(entry=>entry.file));
    if(!Array.isArray(saved)||saved.length!==selected.length||saved.some(item=>!item?.path&&!item?.localId))throw Error('JHA draft photo sync returned incomplete evidence');
    saved.forEach((item,i)=>{
     const previewFile=item.previewFile;
     delete item.previewFile;
     const entry=selected[i];entry.item=item;entry.error=null;entry.localOnly=false;
     if(previewFile&&previewFile!==entry.file){
      if(entry.url)URL.revokeObjectURL(entry.url);
      entry.url=null;entry.file=previewFile;
     }
    });draw()}catch(err){
    // A draft-storage failure must not permanently reject a selected JHA photo.
    // Its original File is still in memory and is uploaded with the final report.
    // Restored draft items without local files retain strict integrity checks.
    if(allowLocalFinalUpload){
     selected.forEach(entry=>{entry.error=null;entry.localOnly=true});
     draw();
     return;
    }
    selected.forEach(entry=>entry.error=err);throw err
   }});
  }
  input.addEventListener('change',()=>{const files=[...input.files];input.value='';selectFiles(files)});
  if(!input.hasAttribute('capture')&&!form.querySelector('input[type=file][name="camera_'+input.name+'"],input[type=file][name="'+input.name+'_camera"]')){
   const camera=document.createElement('input');camera.type='file';camera.accept='image/*';camera.setAttribute('capture','environment');camera.hidden=true;
   const capture=document.createElement('button');capture.type='button';capture.className='secondary report-photo-camera';capture.textContent=tr('Take photo','Tomar foto');
   capture.onclick=()=>{if(form.dataset.submitting!=='true')camera.click()};
   camera.addEventListener('change',()=>{const files=[...camera.files];camera.value='';selectFiles(files)});
   gallery.before(capture,camera);
  }
  draw();
 }
 const controller={async ready(){
  await queue;
  const failed=[...fields.values()].flat().find(entry=>entry.error);
  if(failed)throw failed.error;
 },async files(name){await queue;const entries=fields.get(name)||[];if(entries.some(entry=>entry.error&&(!allowLocalFinalUpload||!entry.file)))throw entries.find(entry=>entry.error&&(!allowLocalFinalUpload||!entry.file)).error;return Promise.all(entries.map(async entry=>{if(entry.file)return entry.file;try{return await download(entry.item)}catch(err){const message=String(err?.message||err||'');if(/object not found|not found|404/i.test(message))throw Error('A previously saved draft photo is missing from storage. Please remove that unavailable photo and attach it again before finalizing. Your report text and signatures remain on this screen.');throw err}}))}};
 controllers.set(form,controller);
 const observer=new MutationObserver(()=>{if(form.isConnected)return;for(const entries of fields.values())for(const entry of entries)if(entry.url)URL.revokeObjectURL(entry.url);observer.disconnect()});observer.observe(document.body,{childList:true,subtree:true});
 return controller;
}
