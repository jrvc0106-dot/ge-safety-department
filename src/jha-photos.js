const controllers=new WeakMap();
export function jhaPhotoController(form){return controllers.get(form)}
export function attachJhaPhotos(form,{list,add,remove,preview,download,tr,onError,allowLocalFinalUpload=false}){
 if(controllers.has(form))return controllers.get(form);
 const fields=new Map();let queue=Promise.resolve();
 const enqueue=task=>{const pending=queue.then(task);queue=pending.catch(onError);return pending};
 for(const input of form.querySelectorAll('input[type=file]')){
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
  input.addEventListener('change',()=>{
   if(form.dataset.submitting==='true')return;
   const selected=[...input.files].map(file=>({file}));if(!selected.length)return;input.value='';entries.push(...selected);draw();
   enqueue(async()=>{try{const saved=await add(input.name,selected.map(entry=>entry.file));
    if(!Array.isArray(saved)||saved.length!==selected.length||saved.some(item=>!item?.path&&!item?.localId))throw Error('JHA draft photo sync returned incomplete evidence');
    saved.forEach((item,i)=>{selected[i].item=item;selected[i].error=null;selected[i].localOnly=false});draw()}catch(err){
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
  });
  draw();
 }
 const controller={async files(name){await queue;const entries=fields.get(name)||[];if(entries.some(entry=>entry.error&&(!allowLocalFinalUpload||!entry.file)))throw entries.find(entry=>entry.error&&(!allowLocalFinalUpload||!entry.file)).error;return Promise.all(entries.map(entry=>entry.file||download(entry.item)))}};
 controllers.set(form,controller);
 const observer=new MutationObserver(()=>{if(form.isConnected)return;for(const entries of fields.values())for(const entry of entries)if(entry.url)URL.revokeObjectURL(entry.url);observer.disconnect()});observer.observe(document.body,{childList:true,subtree:true});
 return controller;
}
