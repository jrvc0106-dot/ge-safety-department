export function orientationSnapshot(value){
 try{const o=typeof value==='string'?JSON.parse(value):value;if(!o||typeof o!=='object'||!o.sticker_number)return null;
 const fields=['id','sticker_number','employee_name','employee_company','employee_position','orientation_date','project_id','employee_profile_id','notes','orientation_photo_path','sticker_photo_path','orientation_document_photo_path'];
 return {...Object.fromEntries(fields.map(k=>[k,typeof o[k]==='string'?o[k]:null])),certificate_photo_paths:Array.isArray(o.certificate_photo_paths)?o.certificate_photo_paths.filter(p=>typeof p==='string'):[]};
 }catch{return null}
}
export async function orientationEvidence(o,sign,tr){
 const entries=[[tr('Employee Face ID','Foto del Empleado'),o.orientation_photo_path],[tr('G&E Sticker Number','G&E Sticker Number'),o.sticker_photo_path],[tr('Safety Orientation Document','Documento de Safety Orientation'),o.orientation_document_photo_path],...(o.certificate_photo_paths||[]).map((p,i)=>[tr('Certificate','Certificado')+' '+(i+1),p])];
 return Promise.all(entries.filter(([,path])=>path).map(async([label,path])=>({label,url:await sign('orientation-photos',path)})));
}
export function renderOrientationRecord(o,photos,{tr,esc}){
 const fields=[[tr('Sticker Number','Número de Sticker'),o.sticker_number],[tr('Employee Name','Nombre del Empleado'),o.employee_name],[tr('Company','Compañía'),o.employee_company],[tr('Position / Trade','Cargo / Oficio'),o.employee_position],[tr('Orientation Date','Fecha de Orientación'),o.orientation_date],[tr('Notes','Notas'),o.notes]];
 return '<dl class="ir-detail-grid">'+fields.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v||'—')+'</dd></div>').join('')+'</dl>'+(photos.length?'<div class="ir-photos">'+photos.map(p=>'<figure>'+(p.url?'<img src="'+esc(p.url)+'" alt="'+esc(p.label)+'">':'<p>'+tr('Image unavailable. Retry loading the record.','Imagen no disponible. Vuelva a cargar la ficha.')+'</p>')+'<figcaption>'+esc(p.label)+'</figcaption></figure>').join('')+'</div>':'');
}
export function attachIncidentEmployee(form,{db,tr,esc,sign,isCurrent,onError}){
 const picker=form.elements.namedItem('employee_sticker'),snapshot=form.elements.namedItem('employee_orientation_snapshot'),panel=form.querySelector('[data-employee-record]'),status=form.querySelector('[data-employee-status]'),button=form.querySelector('[data-employee-find]'),list=form.querySelector('#incident-sticker-list');let version=0,pending=false;
 const current=v=>isCurrent()&&v===version;
 const notify=()=>snapshot.dispatchEvent(new Event('input',{bubbles:true}));
 const display=async(o,v)=>{form.querySelector('.incident-employee-record').open=true;panel.innerHTML=renderOrientationRecord(o,[],{tr,esc});try{const photos=await orientationEvidence(o,sign,tr);if(current(v))panel.innerHTML=renderOrientationRecord(o,photos,{tr,esc});}catch{if(current(v))status.textContent=tr('Employee data loaded; photos could not be loaded. Select Load employee to retry.','Datos cargados; no se pudieron cargar las fotos. Seleccione Cargar empleado para reintentar.')}};
 const lookup=async()=>{
  const number=picker.value.trim().toUpperCase(),v=++version;pending=false;
  if(!number){snapshot.value='';panel.innerHTML='';status.textContent='';notify();return}
  const saved=orientationSnapshot(snapshot.value);if(saved?.sticker_number===number){await display(saved,v);return}
  snapshot.value='';panel.innerHTML='';notify();pending=true;status.textContent=tr('Loading employee…','Cargando empleado…');
  try{const q=await db.from('safety_orientations').select('*').eq('sticker_number',number).maybeSingle();if(!current(v))return;if(q.error)throw q.error;if(!q.data){status.textContent=tr('Sticker not found. Check the number or enter employee details manually.','Sticker no encontrado. Revise el número o ingrese los datos manualmente.');return}
   const o=orientationSnapshot(q.data);snapshot.value=JSON.stringify(o);picker.value=o.sticker_number;
   for(const [name,key] of [['employee_name','employee_name'],['employee_job_title','employee_position'],['employee_company','employee_company']]){const field=form.elements.namedItem(name);field.value=o[key]||'';field.dispatchEvent(new Event('input',{bubbles:true}))}
   notify();status.textContent=tr('Employee loaded from Team · Safety Orientation.','Empleado cargado desde Team · Safety Orientation.');await display(o,v);
  }catch(err){if(current(v)){status.textContent=tr('Employee could not be loaded. Retry or enter details manually.','No se pudo cargar el empleado. Reintente o ingrese los datos manualmente.');onError(err)}}finally{if(current(v))pending=false}
 };
 picker.addEventListener('input',()=>{version++;pending=false;if(snapshot.value){snapshot.value='';panel.innerHTML='';notify()}status.textContent=''});
 picker.addEventListener('change',lookup);button.onclick=lookup;
 picker.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookup()}});
 snapshot.addEventListener('change',()=>{const o=orientationSnapshot(snapshot.value);if(o){picker.value=o.sticker_number;display(o,++version)}});
 form.addEventListener('submit',e=>{if(pending){e.preventDefault();e.stopImmediatePropagation();status.textContent=tr('Wait for the employee record to finish loading.','Espere a que termine de cargar la ficha del empleado.')}},true);
 (async()=>{try{let offset=0;while(isCurrent()){const q=await db.from('safety_orientations').select('sticker_number,employee_name').order('sticker_number').range(offset,offset+499);if(!isCurrent())return;if(q.error)throw q.error;for(const o of q.data||[]){const option=document.createElement('option');option.value=o.sticker_number;option.label=o.employee_name;list.append(option)}if((q.data||[]).length<500)break;offset+=500}}catch{if(isCurrent())status.textContent=tr('Suggestions unavailable. Enter a sticker number and select Load employee.','Sugerencias no disponibles. Escriba un sticker y seleccione Cargar empleado.')}})();
}
