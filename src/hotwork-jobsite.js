// HOTWORK JOBSIDE is a permit, not a machine inspection. Keep all other equipment paths unchanged.
export const HOTWORK_TYPE='hotwork_jobsite';
export const HOTWORK_CHECKS=[
'Combustibles removed or protected; sparks and slag contained.',
'Floors, openings, shafts and opposite sides of walls inspected.',
'Suitable extinguisher immediately available and ready for use.',
'Fire watch assigned when conditions warrant; communications established.',
'Fire watch has required training and clear stop-work authority.',
'Gas cylinders upright / secured; hoses and regulators inspected.',
'Equipment, cables, grounding and guards inspected for defects.',
'Ventilation / fumes and coatings evaluated; controls in place.',
'PPE verified: eye/face, gloves, clothing and respiratory as needed.',
'Adjacent workers protected by screens, barriers and warnings.',
'No prohibited / uncontrolled flammable atmosphere or materials.'
];
export const HOTWORK_OSHA='29 CFR 1926.350, 1926.351, 1926.352, 1926.353; Subpart F';
const field=(label,name,type='text',required=false)=>`<label>${label}<input type="${type}" name="hw_${name}" ${required?'required':''}></label>`;
const area=(label,name)=>`<label class="hw-wide">${label}<textarea name="hw_${name}" rows="2"></textarea></label>`;
const choice=(name,values)=>`<fieldset class="hw-choice"><legend>${name.replaceAll('_',' ').toUpperCase()}</legend>${values.map(v=>`<label><input type="radio" name="hw_${name}" value="${v}">${v.toUpperCase()}</label>`).join('')}</fieldset>`;
export function hotworkFormMarkup(){
 return `<section class="equipment-card hw-fields" id="hotwork-fields" hidden>
 <h2 class="hw-red">HOTWORK JOBSIDE · HOT WORK PERMIT</h2>
 <p class="hw-note">OSHA 29 CFR 1926.350–.353. Work may not start before approval. All applicable NO answers require corrections before approval.</p>
 <h3>01 · JOBSITE / WORK INFORMATION</h3><div class="equipment-grid">
 ${field('Contractor / Subcontractor','contractor','text',true)}
 ${field('Foreman / Supervisor','supervisor','text',true)}
 ${field('Work Start (planned)','start','datetime-local',true)}
 ${field('Expected End','end','datetime-local',true)}
 ${field('Permit Expires','expires','datetime-local',true)}
 ${area('Work Description / Materials (optional notes)','description')}
 </div>
 <fieldset class="hw-choice"><legend>TYPE OF HOT WORK</legend>${['welding','cutting','grinding','heating','other'].map(v=>`<label><input type="checkbox" name="hw_type" value="${v}">${v.toUpperCase()}</label>`).join('')}</fieldset>
 <h3>03 · SPECIAL CONDITIONS · QUICK CHECKLIST</h3>
 <div class="equipment-grid">
 ${choice('combustibles_35ft',['yes','no','na'])}
 ${choice('confined_space',['yes','no'])}
 ${choice('atmosphere_test',['yes','no','na'])}
 ${area('Gas Test / Measurements / Ventilation','gas_details')}
 ${area('Additional Controls / Special Hazards','controls')}
 </div>
 <h3>04 · FIRE WATCH · CONTACT / TIMES</h3><div class="equipment-grid">
 ${field('Fire Watch Name','watch_name')}
 ${field('Fire Watch Contact / Radio','watch_contact')}
 ${field('Fire Watch Start','watch_start','datetime-local')}
 ${field('Hot Work Stop','work_stop','datetime-local')}
 ${field('Fire Watch End','watch_end','datetime-local')}
 </div>
 <p class="hw-note">Observe adjacent/lower levels. Keep fire watch after work for a sufficient period; follow the jobsite's minimum 30-minute rule if adopted. 35-ft clearance and 30-minute watch are site safeguards, not universal numeric requirements of 29 CFR 1926.352.</p>
 <h3>05 · PERMIT AUTHORIZATION</h3>
 ${choice('permit_status',['approved','not_approved','on_hold'])}
 <h3>06 · COMPLETION / CLOSEOUT · QUICK CHECKLIST</h3>
 <div class="hw-choice">${[['work_complete','Work complete'],['area_rechecked','Area rechecked'],['no_embers','No smoke / embers']].map(([n,l])=>`<label><input type="checkbox" name="hw_${n}">${l}</label>`).join('')}</div>
 ${area('Final Inspection / Comments / Findings / Corrective Actions','closeout_notes')}
 <p class="hw-note">Only two mandatory digital signatures: the Safety completing the report and the responsible Foreman. Fire Watch is documented by name, not a third signature.</p>
 </section>`;
}
export function collectHotworkDetails(d){
 const v=n=>String(d.get('hw_'+n)||'').trim();
 const bool=n=>d.get('hw_'+n)==='on';
 return {contractor:v('contractor'),supervisor:v('supervisor'),start:v('start'),end:v('end'),expires:v('expires'),description:v('description'),
 types:d.getAll('hw_type').map(String),combustibles_35ft:v('combustibles_35ft'),confined_space:v('confined_space'),atmosphere_test:v('atmosphere_test'),
 gas_details:v('gas_details'),controls:v('controls'),watch_name:v('watch_name'),watch_contact:v('watch_contact'),
 watch_start:v('watch_start'),work_stop:v('work_stop'),watch_end:v('watch_end'),permit_status:v('permit_status'),
 work_complete:bool('work_complete'),area_rechecked:bool('area_rechecked'),no_embers:bool('no_embers'),closeout_notes:v('closeout_notes')};
}
export function validateHotwork(details,checks){
 if(!details.contractor||!details.supervisor||!details.start||!details.end||!details.expires||!details.types.length||!details.permit_status)
  throw Error('HOTWORK: complete contractor, supervisor, hot work type, dates, and permit decision.');
 if(new Date(details.end)<=new Date(details.start)||new Date(details.expires)<=new Date(details.start))
  throw Error('HOTWORK: planned end and permit expiration must be later than the start.');
 if(!details.combustibles_35ft||!details.confined_space||!details.atmosphere_test)
  throw Error('HOTWORK: complete the special condition questions.');
 const requiresWatch=checks[3]?.result==='pass'||checks[4]?.result==='pass';
 if(details.permit_status==='approved'){
  if(checks.some(c=>c.result!=='pass'&&c.result!=='na'))throw Error('HOTWORK cannot be approved while any pre-work item is NO / FAIL.');
  if(details.confined_space==='yes')throw Error('HOTWORK in a confined space requires separate entry review; place the permit ON HOLD until resolved.');
  if(details.atmosphere_test==='yes'&&!details.gas_details)throw Error('HOTWORK: record atmosphere test readings and ventilation controls.');
  if(requiresWatch&&!details.watch_name)throw Error('HOTWORK: enter the required Fire Watch name.');
 }
 if(details.work_complete&&(!details.area_rechecked||!details.no_embers))throw Error('HOTWORK: complete all closeout safety checks.');
 return true;
}
export function setHotworkPresentation(form,enabled){
 const fields=form.querySelector('#hotwork-fields'); if(!fields)return;
 fields.hidden=!enabled;
 fields.querySelectorAll('input,textarea,select').forEach(el=>{el.disabled=!enabled});
 const unit=form.elements.namedItem('equipment_name');
 if(unit){if(enabled){if(!unit.value.trim())unit.value='HOT WORK PERMIT';unit.closest('label').hidden=true}else{unit.closest('label').hidden=false;if(unit.value==='HOT WORK PERMIT')unit.value=''}}
 for(const n of ['asset_id','manufacturer','model','serial_number']){const el=form.elements.namedItem(n);if(el)el.closest('label').hidden=enabled}
 const cards=[...form.querySelectorAll('.equipment-card')];
 const firstTitle=cards[0]?.querySelector('h2');
 const inspectorTitle=cards[1]?.querySelector('h2');
 const checklistTitle=cards[2]?.querySelector('h2');
 const evidenceTitle=cards[3]?.querySelector('h2');
 if(firstTitle)firstTitle.textContent=enabled?'1. HOTWORK JOBSIDE · JOB INFORMATION':'1. Select Equipment';
 if(inspectorTitle)inspectorTitle.textContent=enabled?'2. SAFETY / PERMIT AUTHORIZER':'2. Inspector Information';
 if(checklistTitle)checklistTitle.textContent=enabled?'3. HOT WORK · PRE-WORK SAFETY CHECKLIST':'3. Inspection Checklist';
 if(evidenceTitle)evidenceTitle.textContent=enabled?'4. HOT WORK · PHOTO EVIDENCE & CONTROLS':'4. Evidence & Corrective Action';
 const hero=form.closest('.equipment-shell')?.querySelector('.equipment-hero');
 if(hero){const heading=hero.querySelector('h1'),subtitle=hero.querySelector('p');
  if(heading)heading.textContent=enabled?'HOTWORK JOBSIDE':'Equipment Inspections';
  if(subtitle)subtitle.textContent=enabled?'Complete the Hot Work permit, fire prevention checklist, authorization, digital signatures and closeout.':'Select equipment, complete the inspection, document defects and create the final PDF.';
 }
 const evidenceFields=form.querySelector('.equipment-evidence-field');
 const findings=evidenceFields?.closest('.equipment-card');
 if(findings){
  for(const name of ['assigned_to','due_date']){
   const control=form.elements.namedItem(name);
   if(control){control.closest('label').hidden=enabled;control.disabled=enabled}
  }
  for(const name of ['defects_found','corrective_action']){
   const control=form.elements.namedItem(name);
   if(control){const label=control.closest('label');if(label)label.hidden=enabled;control.disabled=enabled}
  }
 }
 const action=form.querySelector('.equipment-submit');if(action)action.textContent=enabled?'Finalize HOTWORK JOBSIDE Permit':'Complete Equipment Inspection';
 const safety=form.querySelector('[data-jha-signature="safety"]')?.closest('section');
 const operator=form.querySelector('[data-jha-signature="foreman"]')?.closest('section');
 if(safety)safety.querySelector('label').firstChild.textContent=enabled?'SAFETY / PERMIT AUTHORIZER':'Assigned Safety';
 if(operator)operator.querySelector('label').firstChild.textContent=enabled?'RESPONSIBLE FOREMAN':'Responsible Foreman / Supervisor';
}
const val=(v,e)=>e(v||'—');
const row=(a,b,e)=>`<span><small>${a}</small><b>${val(b,e)}</b></span>`;
export function renderHotworkReport(r,photos,esc,signatureHtml,reportDate){
 const h=r.hotwork_details||{},checks=Array.isArray(r.checklist)?r.checklist:[],decision=h.permit_status||'on_hold';
 const safe=v=>val(v,esc),mark=v=>v?'YES':'NO';
 const section=(num,title)=>`<h2 class="hw-section">${num} · ${title}</h2>`;
 return `<article data-ge-report-date="${esc(r.inspection_at||r.created_at)}" class="report professional-report equipment-pdf hotwork-pdf">
 <header class="hw-pdf-header"><div class="hw-header-company"><b>G&E FLORIDA CONTRACTORS</b><small>SAFETY DEPARTMENT · CONSTRUCTION</small></div><div class="hw-header-title"><h1>HOTWORK JOBSIDE</h1><b>HOT WORK PERMIT · WELDING · CUTTING · GRINDING · HEATING</b></div><img src="/ge-logo.png" alt="G&E Florida Contractors" class="hw-header-logo"></header>
 ${section('01','JOBSITE / WORK INFORMATION')}
 <div class="hw-pdf-grid">${row('PROJECT / JOBSITE',r.project?.name,esc)}${row('PERMIT NO.',r.report_number,esc)}${row('EXACT LOCATION / FLOOR / AREA',r.location,esc)}${row('DATE',reportDate,esc)}${row('CONTRACTOR / SUBCONTRACTOR',h.contractor,esc)}${row('FOREMAN / SUPERVISOR',h.supervisor,esc)}${row('START TIME',h.start,esc)}${row('EXPECTED END',h.end,esc)}${row('PERMIT EXPIRES',h.expires,esc)}${row('TYPE OF HOT WORK',(h.types||[]).join(', ').toUpperCase(),esc)}</div>
 <div class="hw-pdf-description"><small>WORK DESCRIPTION / MATERIALS</small><p>${safe(h.description)}</p></div>
 ${section('02','PRE-WORK SAFETY INSPECTION')}
 <table class="eq-table hw-table"><thead><tr><th>#</th><th>Inspection / Precaution</th><th>YES / NO / N/A</th><th>Finding</th></tr></thead><tbody>${checks.map((c,i)=>`<tr><td>${i+1}</td><td>${esc(c.item)}</td><td><b class="${c.result==='fail'?'hw-fail':''}">${c.result==='pass'?'YES':c.result==='fail'?'NO':'N/A'}</b></td><td>${safe(c.note)}</td></tr>`).join('')}</tbody></table>
 <p class="hw-stop">STOP WORK / NO AUTHORIZATION: any applicable NO, uncontrolled hazard, or missing safeguard.</p>
 ${section('03','SPECIAL CONDITIONS AND CONTROLS')}
 <div class="hw-pdf-grid">${row('COMBUSTIBLES WITHIN 35 FT',h.combustibles_35ft,esc)}${row('CONFINED SPACE REVIEW',h.confined_space,esc)}${row('ATMOSPHERIC TEST REQUIRED',h.atmosphere_test,esc)}${row('ADDITIONAL CONTROLS',h.controls,esc)}${row('GAS TEST / VENTILATION',h.gas_details,esc)}${row('OSHA REFERENCES',r.osha_reference||HOTWORK_OSHA,esc)}</div>
 ${section('04','FIRE WATCH / FIRE PREVENTION')}
 <div class="hw-pdf-grid">${row('FIRE WATCH NAME',h.watch_name,esc)}${row('FIRE WATCH CONTACT / RADIO',h.watch_contact,esc)}${row('FIRE WATCH START',h.watch_start,esc)}${row('HOT WORK STOP',h.work_stop,esc)}${row('FIRE WATCH END',h.watch_end,esc)}</div>
 <p class="hw-note">Fire watch must monitor affected areas and stay for a sufficient post-work period. Follow site-specific safeguards.</p>
 ${section('05','AUTHORIZATION BEFORE WORK')}
 <div class="hw-permit-status ${esc(decision)}">PERMIT STATUS: ${esc(decision.replaceAll('_',' ').toUpperCase())}</div>
 ${signatureHtml.replace('Responsible Foreman / Supervisor','Responsible Foreman')}
 ${section('06','COMPLETION / CLOSEOUT')}
 <div class="hw-pdf-grid">${row('WORK COMPLETE',mark(h.work_complete),esc)}${row('AREA RECHECKED',mark(h.area_rechecked),esc)}${row('NO SMOKE / EMBERS',mark(h.no_embers),esc)}${row('FINAL INSPECTION / CORRECTIVE ACTIONS',h.closeout_notes,esc)}</div>
 ${photos.length?`<section class="hw-evidence">${section('07','PHOTO EVIDENCE')}<div class="eq-photos">${photos.map((src,i)=>`<figure><div class="eq-photo-frame"><img src="${esc(src)}" alt="Hot Work Evidence ${i+1}"></div><figcaption>Evidence ${i+1}</figcaption></figure>`).join('')}</div></section>`:''}
 <footer>G&E SAFETY DEPARTMENT · HOT WORK CONTROL · OSHA 29 CFR 1926 <b>${esc(r.report_number)}</b></footer>
 </article>`;
}
