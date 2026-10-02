const controllers=new WeakMap();
export function jhaPhotoController(form){return controllers.get(form)}
export function attachJhaPhotos(form,{list,add,remove,preview,download,tr,onError}){
 if(controllers.has(form))return controllers.get(form);
 const fields=new Map();let queue=Promise.resolve();
 const enqueue=task=>{const pending=queue.then(task);queue=pending.catch(onError);return pending};
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
    button.onclick=()=>{if(form.dataset.submitting==='true'||entry.removing)return;entry.removing=true;button.disabled=true;enqueue(async()=>{try{if(entry.item)await remove(input.name,entry.item);const index=entries.indexOf(entry);if(index>=0)entries.splice(index,1);if(entry.url)URL.revokeObjectURL(entry.url);draw()}catch(err){entry.removing=false;draw();throw err}})};
    card.append(image,label,button);gallery.append(card);
    if(entry.item&&/\.hei[cf]$/i.test(entry.file?.name||''))preview(entry.item).then(url=>{if(url&&image.isConnected)image.src=url}).catch(()=>{});
    else if(entry.url)image.src=entry.url;
    else if(entry.file){entry.url=URL.createObjectURL(entry.file);image.src=entry.url}
    else if(entry.item)preview(entry.item).then(url=>{if(url&&image.isConnected)image.src=url}).catch(()=>{label.textContent=tr('Preview unavailable: ','Vista no disponible: ')+image.alt});
   }
  }
  input.addEventListener('change',()=>{
   if(form.dataset.submitting==='true')return;
   const selected=[...input.files].map(file=>({file}));if(!selected.length)return;input.value='';entries.push(...selected);draw();
   enqueue(async()=>{try{const saved=await add(input.name,selected.map(entry=>entry.file));saved.forEach((item,i)=>{selected[i].item=item;selected[i].error=null});draw()}catch(err){selected.forEach(entry=>entry.error=err);throw err}});
  });
  draw();
 }
 const controller={async files(name){await queue;const entries=fields.get(name)||[];if(entries.some(entry=>entry.error))throw entries.find(entry=>entry.error).error;return Promise.all(entries.map(entry=>entry.file||download(entry.item)))}};
 controllers.set(form,controller);
 const observer=new MutationObserver(()=>{if(form.isConnected)return;for(const entries of fields.values())for(const entry of entries)if(entry.url)URL.revokeObjectURL(entry.url);observer.disconnect()});observer.observe(document.body,{childList:true,subtree:true});
 return controller;
}
