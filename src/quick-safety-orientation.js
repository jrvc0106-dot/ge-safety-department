export const QUICK_ORIENTATION_HAZARDS = [
  {key:'falls',en:'Falls / edges / floor openings',es:'Caídas / bordes / aberturas',controlEn:'Use the fall-protection measures selected for this task and protect openings.',controlEs:'Use las medidas contra caídas seleccionadas para esta tarea y proteja las aberturas.'},
  {key:'struck_by',en:'Struck-by / falling objects',es:'Golpes / objetos que caen',controlEn:'Wear required head protection; stay outside controlled zones and clear of suspended loads.',controlEs:'Use la protección de cabeza requerida; manténgase fuera de zonas controladas y cargas suspendidas.'},
  {key:'caught_between',en:'Caught-in / between / pinch points',es:'Atrapamiento / puntos de pellizco',controlEn:'Keep clear of moving equipment, pinch points and unstable materials.',controlEs:'Manténgase alejado de equipos en movimiento, puntos de pellizco y materiales inestables.'},
  {key:'electrical',en:'Electrical / overhead lines',es:'Electricidad / líneas aéreas',controlEn:'Maintain required clearances and report damaged cords or exposed electrical hazards.',controlEs:'Mantenga las distancias requeridas y reporte cables dañados o peligros eléctricos expuestos.'},
  {key:'scaffolds',en:'Scaffolds / swing stages',es:'Andamios / swing stages',controlEn:'Use inspected equipment, safe access and the fall-protection controls required for the setup.',controlEs:'Use equipo inspeccionado, acceso seguro y los controles contra caídas requeridos para el montaje.'},
  {key:'ladders',en:'Ladders / stairways',es:'Escaleras portátiles / escaleras fijas',controlEn:'Inspect before use, set up securely and use the equipment as designed.',controlEs:'Inspeccione antes de usar, coloque de forma segura y use el equipo según su diseño.'},
  {key:'cranes_rigging',en:'Cranes / rigging / suspended loads',es:'Grúas / aparejos / cargas suspendidas',controlEn:'Follow the lift plan and signals; stay clear of suspended loads and swing areas.',controlEs:'Siga el plan de izaje y las señales; aléjese de cargas suspendidas y áreas de giro.'},
  {key:'excavations',en:'Excavations / trenches',es:'Excavaciones / zanjas',controlEn:'Follow the competent-person inspection, access and protective-system requirements.',controlEs:'Siga los requisitos de inspección por persona competente, acceso y sistema de protección.'},
  {key:'silica_dust',en:'Silica / dust / respiratory exposure',es:'Sílice / polvo / exposición respiratoria',controlEn:'Use the task-specific dust controls and respiratory protection when required.',controlEs:'Use los controles contra polvo específicos de la tarea y protección respiratoria cuando sea requerida.'},
  {key:'noise',en:'Noise / hearing exposure',es:'Ruido / exposición auditiva',controlEn:'Use required hearing protection and follow the site noise controls.',controlEs:'Use la protección auditiva requerida y siga los controles de ruido del sitio.'},
  {key:'heat',en:'Heat / dehydration',es:'Calor / deshidratación',controlEn:'Use available water and rest measures; promptly report heat-stress symptoms.',controlEs:'Use el agua y los descansos disponibles; reporte pronto síntomas de estrés por calor.'},
  {key:'chemicals',en:'Hazardous chemicals / SDS',es:'Químicos peligrosos / SDS',controlEn:'Review labels and Safety Data Sheets; follow handling and PPE instructions.',controlEs:'Revise etiquetas y hojas SDS; siga las instrucciones de manejo y PPE.'},
  {key:'confined_spaces',en:'Confined spaces / atmospheric hazards',es:'Espacios confinados / peligros atmosféricos',controlEn:'Do not enter unless the required evaluation, permit and controls are in place.',controlEs:'No entre sin la evaluación, permiso y controles requeridos.'},
  {key:'housekeeping',en:'Housekeeping / slips / trips',es:'Orden / resbalones / tropiezos',controlEn:'Keep walkways and access routes clear of debris, cords and materials.',controlEs:'Mantenga los pasillos y accesos libres de escombros, cables y materiales.'},
  {key:'fire_hot_work',en:'Fire / hot work',es:'Incendios / trabajos en caliente',controlEn:'Follow site hot-work, ignition-control and fire-protection requirements.',controlEs:'Siga los requisitos del sitio para trabajos en caliente, control de ignición y protección contra incendios.'},
  {key:'ppe_emergency',en:'Required PPE / emergency procedures',es:'PPE requerido / procedimientos de emergencia',controlEn:'Wear task-required PPE; know alarms, exits and the site muster point.',controlEs:'Use el PPE requerido para la tarea; conozca alarmas, salidas y punto de reunión.'}
];

export const QUICK_ORIENTATION_ACK = {
  en:'By signing, I acknowledge that the hazards, safety controls, required PPE, and emergency procedures applicable to my work were reviewed with me. I agree to follow site safety requirements, ask questions if a task or hazard is unclear, and report unsafe conditions.',
  es:'Al firmar, reconozco que revisaron conmigo los riesgos, controles de seguridad, PPE requerido y procedimientos de emergencia aplicables a mi trabajo. Estoy de acuerdo en seguir los requisitos de seguridad del sitio, hacer preguntas si una tarea o riesgo no está claro y reportar condiciones inseguras.'
};

// Quick Orientation has one employee identity: the signature name follows Employee Name.
// Keep the signature name read-only (not disabled) so FormData and signed PDFs retain it.
export function attachQuickEmployeeSignatureName(form){
 const employee=form?.elements?.namedItem('employee_name');
 const signer=form?.elements?.namedItem('jha_employee_name');
 if(!employee||!signer)return ()=>{};
 signer.readOnly=true;
 const sync=()=>{
  const next=String(employee.value||'').trim();
  if(signer.value!==next){
   // If the employee identity changes after signing, require that worker to sign again.
   const strokes=form.elements.namedItem('jha_employee_signature');
   if(strokes?.value&&strokes.value!=='[]')form.querySelector('[data-jha-clear="employee"]')?.click();
   signer.value=next;
  }
 };
 employee.addEventListener('input',sync);
 employee.addEventListener('change',sync);
 form.addEventListener('reset',()=>form.ownerDocument.defaultView.queueMicrotask(sync));
 sync();
 return sync;
}

export function quickSafetyAccountName(profile, accountEmail=''){
 const name=String(profile?.name||profile?.email||accountEmail||'').trim(),position=String(profile?.position||'').trim();
 return [name,position].filter(Boolean).join(' — ');
}

export function attachQuickHazardSelection(form,tr){
 const inputs=[...form.querySelectorAll('[name="hazards"]')],toggle=form.querySelector('#quick-hazard-toggle-all'),count=form.querySelector('#quick-hazard-selected');
 if(!toggle||!count)return ()=>{};
 const update=()=>{const selected=inputs.filter(input=>input.checked).length,allSelected=inputs.length>0&&selected===inputs.length;count.textContent=String(selected);toggle.textContent=allSelected?tr('Clear all','Quitar todos'):tr('Select all','Seleccionar todos');toggle.setAttribute('aria-pressed',String(allSelected))};
 inputs.forEach(input=>input.addEventListener('change',update));
 toggle.addEventListener('click',()=>{const allSelected=inputs.length>0&&inputs.every(input=>input.checked);inputs.forEach(input=>{input.checked=!allSelected});update()});
 update();
 return update;
}

export function quickSafetyOrientationForm({tr,esc,project,profile}){
 const hazards=QUICK_ORIENTATION_HAZARDS.map(h=>`<label class="quick-hazard-option"><input type="checkbox" name="hazards" value="${h.key}"><span><b>${esc(tr(h.en,h.es))}</b><small>${esc(tr(h.controlEn,h.controlEs))}</small></span></label>`).join('');
 return `<section class="quick-orientation-shell"><div class="section-heading"><div><small>TEAM FIELD</small><h1>${tr('Quick Safety Orientation','Rápida Safety Orientación')}</h1><p>${tr('Fast employee registration and site-specific hazard review.','Registro rápido del empleado y revisión de riesgos específicos del sitio.')}</p></div><button type="button" class="secondary" id="quick-orientation-back">← ${tr('Team Field','Team Field')}</button></div><div class="quick-orientation-project card"><span>${tr('CURRENT JOBSITE','JOBSITE ACTUAL')}</span><strong>${esc(project?.name||'—')}</strong><small>${esc(project?.general_contractor||'')}</small></div><form id="quick-orientation-form" class="quick-orientation-form"><section class="quick-orientation-card"><h2>${tr('Employee Information','Información del Empleado')}</h2><div class="quick-employee-grid"><label class="quick-employee-field">${tr('Employee Name','Nombre del Empleado')}<input name="employee_name" maxlength="120" required autocomplete="name"></label><label class="quick-employee-field">${tr('Sticker Number','Número de Sticker')}<input name="sticker_number" maxlength="64" required autocomplete="off"></label><label class="quick-employee-field">${tr('Position / Trade','Posición / Oficio')}<select name="employee_trade" required><option value="" selected disabled>${tr('Select Position / Trade','Seleccione Posición / Oficio')}</option><option value="Carpintero">Carpintero</option><option value="IronWork">IronWork</option><option value="Rigger">Rigger</option><option value="Foreman">Foreman</option><option value="Labor">Labor</option><option value="MOT">MOT</option><option value="Layout">Layout</option><option value="Superintendente">Superintendente</option><option value="ConexMan">ConexMan</option><option value="__custom__">${tr('Custom Trade (write your own)','Oficio personalizado (escribir)')}</option></select><input name="employee_custom_trade" maxlength="120" autocomplete="off" required disabled hidden style="display:none" placeholder="${esc(tr('Enter position / trade','Escriba la posición / oficio'))}"></label><label class="quick-employee-field">${tr('Company','Compañía')}<input name="employee_company" maxlength="120" required value="G&E Florida Contractors"></label><label class="quick-employee-field quick-employee-phone">${tr('Employee Phone (optional)','Teléfono del Empleado (opcional)')}<input type="tel" name="employee_phone" autocomplete="tel" inputmode="tel" maxlength="32" placeholder="${esc(tr('Example: (305) 555-0123','Ejemplo: (305) 555-0123'))}"></label><label class="quick-employee-field quick-employee-emergency">${tr('Contact in case of emergency','Contacto en caso de emergencia')}<input type="text" name="emergency_contact" maxlength="160" autocomplete="off"></label></div><div class="quick-face-id"><div><h3>${tr('Employee Face ID','Foto del rostro del empleado')} <span class="quick-face-required">*</span></h3><p>${tr('Take one clear employee face photo for Sticker Number Verify. This photo is separate from the four jobsite photos.','Tome una foto clara del rostro para verificar el sticker. Esta foto es independiente de las cuatro fotos del jobsite.')} </p></div><div class="quick-face-controls"><label class="quick-photo-button">📷 ${tr('Take Face Photo','Tomar foto del rostro')}<input type="file" id="quick-face-camera" accept="image/*,.heic,.heif" capture="environment" hidden></label></div><div id="quick-face-preview" class="quick-face-preview" aria-live="polite"><span>${tr('Employee Face ID photo required','Se requiere foto del rostro del empleado')}</span></div></div></section><section class="quick-orientation-card"><div class="quick-card-heading"><div><h2>${tr('Jobsite Hazards & Safety Controls','Riesgos del Jobsite y Controles de Seguridad')}</h2><p>${tr('Select the hazards that apply to this employee’s work today. These examples do not replace a task-specific JHA or site safety plan.','Seleccione los riesgos que aplican al trabajo de este empleado hoy. Estos ejemplos no reemplazan un JHA específico de la tarea ni el plan de seguridad del sitio.')}</p></div><div class="quick-hazard-actions"><button type="button" class="secondary quick-hazard-toggle" id="quick-hazard-toggle-all" aria-pressed="false">${tr('Select all','Seleccionar todos')}</button><span class="quick-hazard-count"><b id="quick-hazard-selected">0</b> ${tr('selected','seleccionados')}</span></div></div><div class="quick-hazard-grid">${hazards}</div></section><section class="quick-orientation-card quick-ack-card"><h2>${tr('Employee Acknowledgment','Reconocimiento del Empleado')}</h2><p>${esc(tr(QUICK_ORIENTATION_ACK.en,QUICK_ORIENTATION_ACK.es))}</p><label class="quick-ack-check"><input type="checkbox" name="acknowledged" required><span>${tr('I have reviewed and agree to follow the hazards and safety requirements discussed above.','He revisado y estoy de acuerdo en seguir los riesgos y requisitos de seguridad explicados.')}</span></label></section><button type="submit" class="quick-orientation-save">${tr('Save & Create Final Report','Guardar y Crear Reporte Final')}</button></form><section class="quick-orientation-card quick-recent-card"><h2>${tr('Recent Quick Orientations','Orientaciones Rápidas Recientes')}</h2><div id="quick-orientation-recent" class="quick-orientation-recent"><span>${tr('Loading records…','Cargando registros…')}</span></div></section></section>`;
}

// Custom trade is part of the existing Position / Trade field, not a new workflow.
export function attachQuickCustomTrade(form){
 const select=form?.elements?.namedItem('employee_trade');
 const custom=form?.elements?.namedItem('employee_custom_trade');
 if(!select||!custom)return ()=>{};
 const sync=()=>{
  const active=select.value==='__custom__';
  custom.hidden=!active;
  custom.style.display=active?'block':'none';
  custom.disabled=!active;
  custom.required=active;
  if(!active)custom.value='';
 };
 select.addEventListener('change',sync);
 form.addEventListener('reset',()=>form.ownerDocument.defaultView.queueMicrotask(sync));
 sync();
 return sync;
}

export function quickSafetyOrientationReport(record,{tr,esc,fmt,project,photos,facePhotoUrl='',signatureMarkup}){
 const selected=new Set((record.hazards||[]).map(h=>h.key)),hazards=QUICK_ORIENTATION_HAZARDS.filter(h=>selected.has(h.key));
 const half=Math.ceil(hazards.length/2),columns=[hazards.slice(0,half),hazards.slice(half)];
 const date=fmt(record.orientation_at||record.created_at),reportNumber='QSO-'+new Date(record.orientation_at||record.created_at).toISOString().slice(0,10).replaceAll('-','')+'-'+String(record.id).slice(0,6).toUpperCase();
 const hazardRows=columns.map(list=>`<div class="quick-report-hazard-column">${list.length?list.map(h=>`<div class="quick-report-hazard"><span class="quick-report-check">✓</span><div><b>${esc(tr(h.en,h.es))}</b><small>${esc(tr(h.controlEn,h.controlEs))}</small></div></div>`).join(''):`<div class="quick-report-hazard-empty">${tr('No additional hazards selected','No se seleccionaron más riesgos')}</div>`}</div>`).join('');
 // Employee Face ID is independent from optional site evidence photos. Only the
 // signed, stored image supplied by the report view is displayed in this PDF.
 const identityPhoto=typeof facePhotoUrl==='string'?facePhotoUrl.trim():'';
 const facePhotoMarkup=identityPhoto?`<div class="quick-report-employee-photo"><span>${tr('Employee Photo','Foto del Empleado')}</span><img src="${esc(identityPhoto)}" alt="${esc(tr('Employee identification photo','Foto de identificación del empleado'))}"></div>`:'';
 const photoMarkup=photos?.length?`<div class="quick-report-photos">${photos.slice(0,4).map((photo,index)=>`<figure><img src="${esc(photo.url)}" alt="${esc(tr('Orientation photo','Foto de orientación'))} ${index+1}"><figcaption>${tr('Photo','Foto')} ${index+1}</figcaption></figure>`).join('')}</div>` :'';
 return `<article class="report print-report professional-report quick-safety-orientation-report"><div class="print-report-watermark"><img src="/ge-logo.png" alt=""></div><header class="quick-report-header"><img src="/ge-logo.png" alt="G&E Florida Contractors"><div><small>G&E FLORIDA CONTRACTORS · TEAM FIELD</small><h1>${tr('Safety Orientation Report','Reporte de Safety Orientation')}</h1><p>${esc(reportNumber)}</p></div><span class="quick-report-complete">✓ ${tr('Completed','Completado')}</span></header><section class="quick-report-employee${identityPhoto?' has-face-photo':''}"><div><span>${tr('Employee Name','Nombre del Empleado')}</span><b>${esc(record.employee_name)}</b>${record.employee_phone?`<span class="quick-report-phone-label">${tr('Employee Phone','Teléfono del Empleado')}</span><b>${esc(record.employee_phone)}</b>`:''}</div><div><span>${tr('Sticker #','Sticker #')}</span><b>${esc(record.sticker_number)}</b></div><div><span>${tr('Trade / Position','Oficio / Posición')}</span><b>${esc(record.employee_trade)}</b></div><div><span>${tr('Company','Compañía')}</span><b>${esc(record.employee_company)}</b></div><div><span>${tr('Project / Jobsite','Proyecto / Jobsite')}</span><b>${esc(project?.name||'—')}</b></div><div><span>${tr('Orientation Date','Fecha de Orientación')}</span><b>${esc(date)}</b></div>${facePhotoMarkup}${record.emergency_contact?`<div class="quick-report-emergency-contact"><span>${tr('Contact in case of emergency','Contacto en caso de emergencia')}</span><b>${esc(record.emergency_contact)}</b></div>`:''}</section><section class="quick-report-hazards"><header><div><h2>${tr('Jobsite Hazards & Safety Controls','Riesgos del Jobsite y Controles de Seguridad')}</h2><p>${tr('Applicable hazards selected for this work and site.','Riesgos aplicables seleccionados para este trabajo y sitio.')}</p></div><strong>${hazards.length} ${tr('selected','seleccionados')}</strong></header><div class="quick-report-hazard-columns">${hazardRows}</div><small class="quick-report-site-note">${tr('Review the site-specific safety plan and task JHA. Use controls required for the actual work and conditions.','Revise el plan de seguridad del sitio y el JHA de la tarea. Use los controles requeridos para el trabajo y las condiciones reales.')}</small></section>${photoMarkup?`<section class="quick-report-photo-section"><h2>${tr('Orientation Photos','Fotos de Orientación')}</h2>${photoMarkup}</section>`:''}<section class="quick-report-acknowledgment"><h2>${tr('Employee Acknowledgment','Reconocimiento del Empleado')}</h2><p>${esc(tr(QUICK_ORIENTATION_ACK.en,QUICK_ORIENTATION_ACK.es))}</p></section><section class="quick-report-signatures"><h2>${tr('Signatures','Firmas')}</h2>${signatureMarkup}</section><footer class="quick-report-footer"><span>G&E SAFETY DEPARTMENT</span><b>${tr('Safety Today · A Safer Tomorrow','Seguridad hoy · Un mañana más seguro')}</b><span>${esc(reportNumber)}</span></footer><div class="no-print report-print-actions"><button type="button" class="secondary" id="quick-report-back">← ${tr('Back to Quick Safety Orientation','Volver a Rápida Safety Orientación')}</button></div></article>`;
}


// Distinct verified view for a Quick Orientation sticker. A quick record does not
// carry the four mandatory evidence categories of Register Safety Orientation.
// For a historical Quick Orientation, keep its first uploaded photo as the
// profile picture. New registrations save Face ID separately and have no
// Jobsite Photos, so they use face_photo_path instead.
export function quickOrientationPrimaryPhotoPath(record){
 const firstPhoto=Array.isArray(record?.photo_paths)?record.photo_paths[0]:null;
 if(typeof firstPhoto==='string'&&firstPhoto.trim())return firstPhoto.trim();
 return typeof record?.face_photo_path==='string'?record.face_photo_path.trim():'';
}

export function quickStickerVerificationMarkup(record,{tr,esc,fmt,projectName='',photos=[],facePhotoUrl='',signatures=''}) {
 const selected=new Set((Array.isArray(record.hazards)?record.hazards:[]).map(x=>x?.key));
 const hazardList=QUICK_ORIENTATION_HAZARDS.filter(x=>selected.has(x.key));
 const detail=(title,value)=>`<div><small>${title}</small><strong>${esc(value||'—')}</strong></div>`;
 const employeeName=String(record.employee_name||'').trim();
 return `<article class="card orientation-record quick-sticker-record">
 <div class="orientation-valid">✓ ${tr('QUICK SAFETY ORIENTATION VERIFIED','ORIENTACIÓN RÁPIDA VERIFICADA')}</div>
 <div class="orientation-person">${facePhotoUrl?`<img class="quick-sticker-face" src="${esc(facePhotoUrl)}" alt="${esc(tr('Employee Face ID','Foto del rostro del empleado'))}">`:`<div class="orientation-photo-empty" aria-label="${esc(tr('Employee face photo not registered','Foto del rostro no registrada'))}">👤</div>`}<div class="orientation-person-summary"><div class="orientation-person-heading"><div><small>${tr('STICKER NO.','N.º DE STICKER')}</small><h2>${esc(record.sticker_number)}</h2><h3>${esc(employeeName)}</h3></div></div><p>${esc([record.employee_trade,record.employee_company].filter(Boolean).join(' · ')||'—')}</p></div></div>
 <section class="orientation-record-section"><div class="orientation-record-heading"><div><small>QUICK SAFETY ORIENTATION</small><h3>${tr('Employee Information','Información del Empleado')}</h3></div></div><div class="orientation-detail-grid">
 ${detail(tr('FULL NAME','NOMBRE COMPLETO'),employeeName)}
 ${detail(tr('STICKER NUMBER','NÚMERO DE STICKER'),record.sticker_number)}
 ${detail(tr('COMPANY','COMPAÑÍA'),record.employee_company)}
 ${detail(tr('POSITION / TRADE','POSICIÓN / OFICIO'),record.employee_trade)}
 ${detail(tr('PROJECT / JOBSITE','PROYECTO / JOBSITE'),projectName)}
 ${detail(tr('ORIENTATION DATE','FECHA DE ORIENTACIÓN'),record.orientation_at?fmt(record.orientation_at):'—')}
 ${detail(tr('EMPLOYEE PHONE','TELÉFONO DEL EMPLEADO'),record.employee_phone)}
 ${detail(tr('CONTACT IN CASE OF EMERGENCY','CONTACTO EN CASO DE EMERGENCIA'),record.emergency_contact)}
 </div></section>
 <section class="orientation-record-section"><div class="orientation-record-heading"><div><small>JOBSITE SAFETY</small><h3>${tr('Hazards & Safety Controls Reviewed','Riesgos y controles de seguridad revisados')}</h3></div></div>
 ${hazardList.length?`<div class="warning-list">${hazardList.map(h=>`<article><strong>✓ ${esc(tr(h.en,h.es))}</strong><p>${esc(tr(h.controlEn,h.controlEs))}</p></article>`).join('')}</div>`:`<p>${tr('No hazard selections were recorded.','No se registraron riesgos seleccionados.')}</p>`}
 </section>
 ${photos.some(Boolean)?`<section class="orientation-record-section"><div class="orientation-record-heading"><div><small>QUICK ORIENTATION EVIDENCE</small><h3>${tr('Jobsite Photos','Fotos del Jobsite')}</h3></div><span class="orientation-evidence-count">${photos.filter(Boolean).length} ${tr('photos','fotos')}</span></div>
 ${photos.some(Boolean)?`<div class="orientation-evidence-grid">${photos.map((url,i)=>url?`<figure><b>${tr('PHOTO','FOTO')} ${i+1}</b><img src="${esc(url)}" alt="${esc(tr('Quick orientation photo','Foto de orientación rápida'))} ${i+1}"></figure>`:'').join('')}</div>`:`<p>${tr('No jobsite photos were attached to this quick orientation.','No se adjuntaron fotos del jobsite a esta orientación rápida.')}</p>`}
 <small>${tr('Quick Orientation photos are jobsite evidence, not verified face ID, sticker image, orientation document, or training certificates.','Las fotos de orientación rápida son evidencia del jobsite, no identificación facial, foto del sticker, documento de orientación ni certificados verificados.')}</small>
 </section>
 `:''}<section class="orientation-record-section">${signatures}</section>
 <button type="button" class="secondary quick-sticker-open-report" data-quick-verify-report="${esc(record.id)}">${tr('View Final Quick Orientation Report','Ver reporte final de orientación rápida')}</button>
 </article>`;
}

export function quickStickerDuplicateMarkup(records,{tr,esc,fmt}) {
 return `<section class="card orientation-record quick-sticker-conflict" role="alert">
 <strong>${tr('More than one Quick Orientation uses this sticker number.','Más de una orientación rápida usa este número de sticker.')}</strong>
 <p>${tr('The records cannot be verified as a single employee. Review the individual reports before taking action.','No se pueden verificar estos registros como un único empleado. Revise los reportes individuales antes de tomar medidas.')}</p>
 ${records.map(r=>`<div class="discipline-record"><strong>${esc(r.employee_name)}</strong><small>${esc(r.orientation_at?fmt(r.orientation_at):'—')}</small><button type="button" class="secondary quick-sticker-open-report" data-quick-verify-report="${esc(r.id)}">${tr('View Quick Orientation Report','Ver reporte de orientación rápida')}</button></div>`).join('')}
 </section>`;
}
