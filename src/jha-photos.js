const controllers=new WeakMap();
export function jhaPhotoController(form){return controllers.get(form)}
export function attachJhaPhotos(form,{list,add,remove,preview,download,tr,onError}){
 if(controllers.has(form))return controllers.get(form);
 const fields=new Map();let queue=Promise.resolve();
 const enqueue=task=>{const pending=queue.then(task);queue=pending.catch(err=>{try{onError?.(err)}catch(e){console.warn('Photo error notification failed',e)}});return queue};
 for(const input of form.querySelectorAll('input[type=file]')){
  const entries=(list(input.name)||[]).map(item=>({item}));
  const gallery=document.createElement('div');gallery.className='jha-photo-gallery';input.after(gallery);fields.set(input.name,entries);
  function draw(){
   if(!form.isConnected)return;
   gallery.replaceChildren();
   for(const entry of entries){
    const card=document.createElement('div');card.className='jha-photo-card';
    const image=document.createElement('img');image.alt=entry.file?.name||entry.item?.name||tr('Attached photo','Foto adjunta');
    const label=document.createElement('span');label.textContent=image.alt;
    const button=document.createElement('button');button.type='button';button.textContent=tr('Remove photo','Eliminar foto');button.disabled=form.dataset.submitting==='true';
    button.onclick=()=>{if(form.dataset.submitting==='true'||entry.removing)return;entry.removing=true;button.disabled=true;enqueue(async()=>{try{if(entry.item)await remove(input.name,entry.item);const index=entries.indexOf(entry);if(index>=0)entries.splice(index,1);if(entry.url)URL.revokeObjectURL(entry.url);if(entry.previewUrl)URL.revokeObjectURL(entry.previewUrl);draw()}catch(err){entry.removing=false;draw();throw err}})};
    card.append(image,label,button);gallery.append(card);
    const status=document.createElement('small');status.className=entry.error?'jha-photo-error':'jha-photo-status';
    status.textContent=entry.error?tr('Photo not saved. Please retry.','Foto sin guardar. Intente nuevamente.'):!entry.item?tr('Saving photo…','Guardando foto…'):entry.item.localId?tr('Saved on this iPad','Guardada en este iPad'):tr('Photo attached','Foto adjunta');
    card.append(status);
    if(entry.error&&entry.file){
     const retry=document.createElement('button');retry.type='button';retry.textContent=tr('Retry photo','Reintentar foto');
     retry.disabled=form.dataset.submitting==='true';
     retry.onclick=()=>{if(form.dataset.submitting==='true')return;entry.error=null;draw();enqueue(async()=>{try{const saved=await add(input.name,[entry.file]);if(!saved?.[0])throw Error(tr('Photo was not saved.','No se guardó la foto.'));entry.item=saved[0];draw()}catch(err){entry.error=err;draw();throw err}})};
     card.append(retry);
    }
    const showPreview=url=>{
     if(!url)return;
     if(entry.item?.localId&&url.startsWith('blob:')){if(entry.previewUrl&&entry.previewUrl!==url)URL.revokeObjectURL(entry.previewUrl);entry.previewUrl=url}
     if(image.isConnected)image.src=url;
     else if(entry.item?.localId&&url.startsWith('blob:')){URL.revokeObjectURL(url);if(entry.previewUrl===url)entry.previewUrl=null}
    };
    if(entry.previewUrl)image.src=entry.previewUrl;
    else if(entry.item&&/\.hei[cf]$/i.test(entry.file?.name||''))preview(entry.item).then(showPreview).catch(()=>{});
    else if(entry.url)image.src=entry.url;
    else if(entry.file){try{entry.url=URL.createObjectURL(entry.file);image.src=entry.url}catch{if(!entry.error)status.textContent=tr('Preview unavailable; photo selected','Vista no disponible; foto seleccionada')}}
    else if(entry.item)preview(entry.item).then(showPreview).catch(()=>{label.textContent=tr('Preview unavailable: ','Vista no disponible: ')+image.alt});
   }
  }
  input.addEventListener('change',()=>{
   if(form.dataset.submitting==='true')return;
   const selected=[...input.files].map(file=>({file}));if(!selected.length)return;input.value='';entries.push(...selected);draw();
   enqueue(async()=>{try{const saved=await add(input.name,selected.map(entry=>entry.file));if(!Array.isArray(saved)||saved.length!==selected.length)throw Error(tr('Some photos were not saved. Please retry.','No se guardaron todas las fotos. Intente nuevamente.'));saved.forEach((item,i)=>{selected[i].item=item;selected[i].error=null});draw()}catch(err){selected.forEach(entry=>entry.error=err);draw();throw err}});
  });
  draw();
 }
 const controller={async files(name){await queue;const entries=fields.get(name)||[];if(entries.some(entry=>entry.error))throw entries.find(entry=>entry.error).error;return Promise.all(entries.map(entry=>entry.file||download(entry.item)))}};
 controllers.set(form,controller);
 const observer=new MutationObserver(()=>{if(form.isConnected)return;for(const entries of fields.values())for(const entry of entries)if(entry.url)URL.revokeObjectURL(entry.url);for(const entries of fields.values())for(const entry of entries)if(entry.previewUrl)URL.revokeObjectURL(entry.previewUrl);observer.disconnect()});observer.observe(document.body,{childList:true,subtree:true});
 return controller;
}
