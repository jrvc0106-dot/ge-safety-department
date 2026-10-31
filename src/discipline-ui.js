/**
 * Presentation-only improvement of Employee Safety Discipline.
 * Preserve the original single scrollable form, all field nodes, their
 * listeners, RLS-aware sticker lookup, auto-drafts, approvals and submission.
 * Keep four continuous sections, with optional details collapsed only when unused.
 * Never erase field values, regenerate signatures, or create invented incident facts.
 */
export function simplifyDisciplineForm(form,tr){
 if(!form||form.dataset.disciplineSimplified==='true')return;
 const submit=form.querySelector('button[type="submit"]');
 const signatures=form.querySelector('.jha-approval-fields');
 if(!submit||!signatures)return;
 const doc=form.ownerDocument;
 const field=name=>form.elements.namedItem(name)?.closest?.('label')||null;
 const find=key=>key.startsWith('.')||key.startsWith('#')?form.querySelector(key):field(key);
 const groups=[
  {
   name:tr('Employee Information','Información del trabajador'),
   info:tr('First find the sticker to fill the worker’s information. You may also enter the details manually.','Primero busque el sticker para completar los datos del trabajador. También puede ingresarlos manualmente.'),
   fields:['.discipline-sticker-lookup','employee_name','employee_position','employee_orientation_id','employee_id','employee_age','#employee-discipline-summary']
  },
  {
   name:tr('Safety Violation','Violación de seguridad'),
   info:tr('Describe what happened and where. Record objective facts, not assumptions.','Describa qué ocurrió y dónde. Registre hechos objetivos, no suposiciones.'),
   fields:['violation_type','violation_custom','incident_location','description','hazard_observed','company_rule','osha_reference']
  },
  {
   name:tr('Disciplinary Action','Acción disciplinaria'),
   info:tr('Choose the measure taken, then document corrections and any required follow-up.','Seleccione la medida aplicada y documente las correcciones y el seguimiento necesario.'),
   fields:['action_level','supervisor_name','custom_action','immediate_action','retraining_required','retraining_topic','follow_up_required','follow_up_notes']
  },
  {
   name:tr('Evidence & Signatures','Evidencia y firmas'),
   info:tr('Attach evidence, capture signatures and review before saving the professional report.','Adjunte evidencia, registre las firmas y revise todo antes de guardar el reporte profesional.'),
   fields:['employee_comments','employee_acknowledged','evidence','.jha-approval-fields']
  }
 ];
 const optionalBySection={
  0:['employee_id','employee_age'],
  1:['osha_reference'],
  2:[],
  3:['employee_comments']
 };
 const sections=[];
 for(const [index,group] of groups.entries()){
  const section=doc.createElement('section');section.className='discipline-simple-section';
  section.dataset.section=String(index+1);
  const header=doc.createElement('div');header.className='discipline-section-header';
  const number=doc.createElement('span');number.className='discipline-section-number';number.textContent=String(index+1).padStart(2,'0');number.setAttribute('aria-hidden','true');
  const headingText=doc.createElement('div');headingText.className='discipline-section-copy';
  const heading=doc.createElement('h3');heading.className='discipline-simple-heading';heading.textContent=group.name;
  const info=doc.createElement('p');info.className='discipline-section-hint';info.textContent=group.info;
  headingText.append(heading,info);header.append(number,headingText);
  const fields=doc.createElement('div');fields.className='discipline-simple-fields';
  section.append(header,fields);
  const secondary=[];
  for(const key of group.fields){
   const node=find(key);
   if(!node)continue;
   const hint=key==='evidence'&&node.nextElementSibling?.tagName==='SMALL'?node.nextElementSibling:null;
   if(optionalBySection[index].includes(key))secondary.push(node);
   else fields.append(node);
   if(hint)fields.append(hint);
   if(key==='description'||key==='immediate_action'||key==='employee_name'||key==='action_level')node.classList.add('discipline-priority-field');
   if(key==='employee_orientation_id')node.classList.add('discipline-manual-lookup');
   if(key==='employee_age'||key==='employee_id'||key==='osha_reference')node.classList.add('discipline-secondary-field');
  }
  if(secondary.length){
   const details=doc.createElement('details');details.className='discipline-optional-details';
   const summary=doc.createElement('summary');
   summary.textContent=tr('Additional information (optional)','Información adicional (opcional)');
   const panel=doc.createElement('div');panel.className='discipline-optional-grid';
   panel.append(...secondary);details.append(summary,panel);fields.append(details);
   // Saved and restored draft values must remain discoverable, never hidden.
   const openForValues=()=>{
    if(secondary.some(label=>[...label.querySelectorAll('input,select,textarea')].some(input=>input.type==='checkbox'?input.checked:Boolean(String(input.value||'').trim()))))details.open=true;
   };
   form.addEventListener('input',openForValues);
   form.addEventListener('change',openForValues);
   openForValues();
  }
  sections.push(section);
 }
 const assistant=form.querySelector('.discipline-ai-guide');
 const finalFields=sections.at(-1).querySelector('.discipline-simple-fields');
 // Never discard future additions or report-signature controls.
 for(const remaining of Array.from(form.children)){
  if(remaining!==submit)finalFields.append(remaining);
 }
 const footer=doc.createElement('div');footer.className='discipline-simple-footer';
 const note=doc.createElement('p');note.textContent=tr('Review the details and signatures. Saving opens the finished report; no information is discarded.','Revise los datos y las firmas. Al guardar se abre el reporte final sin perder información.');
 footer.append(note,submit);
 form.append(...sections,footer);
 // Contextual writing guidance only: never insert assumed violations or OSHA citations.
 const violation=form.elements.namedItem('violation_type');
 const facts=form.elements.namedItem('description')?.closest('label');
 if(violation&&facts){
  const guide=doc.createElement('p');guide.className='discipline-violation-guide';
  guide.setAttribute('aria-live','polite');
  facts.append(guide);
  const setGuide=()=>{
   const value=String(violation.value||'').toLowerCase();
   let text=tr('Describe only the facts observed: the act, location, task, and available evidence.','Describa solamente los hechos observados: acto, lugar, trabajo y evidencia disponible.');
   if(/ppe|face shield|n95|clothing|respirator/.test(value))text=tr('State which protective equipment was required and what you observed; do not assume why it was missing.','Indique qué protección se requería y qué observó; no suponga por qué faltaba.');
   else if(/fall|scaffold|ladder/.test(value))text=tr('Record the actual work position, exposure, and observed protection or access condition.','Registre la posición del trabajo, la exposición y la condición observada de protección o acceso.');
   else if(/crane|rigging|forklift|equipment|tagline/.test(value))text=tr('Record the equipment, operation, location, and unsafe act actually observed.','Registre el equipo, la operación, el lugar y el acto inseguro observado.');
   else if(/respect|fighting|theft|drug|alcohol/.test(value))text=tr('Record observable conduct, witnesses and facts without speculation or diagnosis.','Registre conductas observables, testigos y hechos, sin suposiciones ni diagnósticos.');
   guide.textContent=text;
  };
  violation.addEventListener('change',setGuide);setGuide();
 }
 const conditional=[
  ['retraining_required','retraining_topic'],
  ['follow_up_required','follow_up_notes']
 ];
 const syncConditional=()=>{
  for(const [toggleName,fieldName] of conditional){
   const checkbox=form.elements.namedItem(toggleName);
   const input=form.elements.namedItem(fieldName);
   const label=input?.closest('label');
   if(!checkbox||!label)continue;
   const show=checkbox.checked||Boolean(String(input.value||'').trim());
   label.classList.toggle('discipline-conditional-muted',!show);
   label.style.display=show?'':'none';
   // These fields are stored as before and values are never cleared.
  }
 };
 form.addEventListener('change',syncConditional);
 form.addEventListener('input',syncConditional);
 form.addEventListener('reset',()=>doc.defaultView?.queueMicrotask(syncConditional));

 syncConditional();
 if(assistant)form.prepend(assistant); // Put missing-field review before the form.
 form.dataset.disciplineSimplified='true';
}

// Show clear red borders only for items flagged by the report-quality review.
// Do not disable fields or change any submitted values.
export function markDisciplineMissingFields(form,missing,{active=true}={}){
 if(!form?.querySelectorAll)return 0;
 for(const node of form.querySelectorAll('.discipline-ai-incomplete')){
  node.classList.remove('discipline-ai-incomplete');
 }
 for(const node of form.querySelectorAll('[data-discipline-ai-invalid]')){
  node.removeAttribute('data-discipline-ai-invalid');
  node.removeAttribute('aria-invalid');
 }
 if(!active)return 0;
 let count=0;
 for(const item of missing||[]){
  const name=Array.isArray(item)?item[0]:item;
  const input=form.elements?.namedItem(name);
  if(!input||input.disabled)continue;
  const box=input.closest('label')||input.closest('[data-jha-signature]')||input.closest('.jha-approval')||input.closest('section');
  if(!box)continue;
  box.classList.add('discipline-ai-incomplete');
  if(input.type==='hidden'||name.endsWith('_signature')){
   // Highlight signature canvas/section, not an invisible hidden input.
   const panel=input.closest('[data-jha-signature]')||input.closest('.jha-approval')||box;
   panel.classList.add('discipline-ai-incomplete');
  }else{
   input.classList.add('discipline-ai-incomplete');
   input.dataset.disciplineAiInvalid='true';
   // Recommended fields remain recommendations; not a native validation error.
  }
  count++;
 }
 return count;
}
