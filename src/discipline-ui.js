/**
 * Non-destructive, iPad-friendly presentation of the existing discipline form.
 * Moves every original field node; field names, events and save payloads remain intact.
 */
export function simplifyDisciplineForm(form,tr){
 if(!form||form.dataset.disciplineSimplified==='true')return;
 const doc=form.ownerDocument;
 const t=(en,es)=>tr(en,es);
 const findField=name=>{
  const field=form.elements.namedItem(name);
  return field?.closest?.('label')||null;
 };
 const sections=[
  {title:t('Employee Information','Información del trabajador'),note:t('Find the sticker or enter employee information.','Busque el sticker o registre los datos del trabajador.'),main:['employee_orientation_id','.discipline-sticker-lookup','employee_name','employee_id','employee_position','employee_age','#employee-discipline-summary'],extra:[]},
  {title:t('Safety Violation','Violación de seguridad'),note:t('Select the violation and record the objective facts.','Seleccione la violación y registre los hechos objetivos.'),main:['violation_type','incident_location','description'],extra:['company_rule','osha_reference','hazard_observed']},
  {title:t('Disciplinary Action','Acción disciplinaria'),note:t('Choose the action and document the immediate correction.','Seleccione la medida y documente la corrección inmediata.'),main:['action_level','custom_action','immediate_action'],extra:['supervisor_name','retraining_required','retraining_topic','follow_up_required','follow_up_notes']},
  {title:t('Evidence & Signatures','Evidencia y firmas'),note:t('Add evidence, capture signatures and save the final report.','Adjunte evidencia, obtenga las firmas y guarde el reporte final.'),main:['employee_comments','employee_acknowledged','evidence','.jha-approval-fields'],extra:[]}
 ];
 const findNode=key=>key.startsWith('.')||key.startsWith('#')?form.querySelector(key):findField(key);
 const nextButton=form.querySelector('button[type="submit"]');
 const signature=form.querySelector('.jha-approval-fields');
 if(!nextButton||!signature)return;
 const steps=[];
 const navigators=[];
 const nav=doc.createElement('div');nav.className='discipline-step-progress';nav.setAttribute('aria-label',t('Disciplinary report sections','Secciones del reporte disciplinario'));
 for(let index=0;index<sections.length;index++){
  const item=sections[index],details=doc.createElement('details');details.className='discipline-step';details.dataset.step=String(index+1);details.open=index===0;
  const summary=doc.createElement('summary');
  const badge=doc.createElement('span');badge.className='discipline-step-number';badge.textContent=String(index+1).padStart(2,'0');
  const copy=doc.createElement('span');copy.className='discipline-step-heading';
  const heading=doc.createElement('strong');heading.textContent=item.title;
  const hint=doc.createElement('small');hint.textContent=item.note;
  copy.append(heading,hint);summary.append(badge,copy);
  const content=doc.createElement('div');content.className='discipline-step-body';
  const fields=doc.createElement('div');fields.className='discipline-step-fields';
  for(const key of item.main){const node=findNode(key);if(node)fields.append(node);
   if(key==='evidence'&&node?.nextElementSibling?.tagName==='SMALL')fields.append(node.nextElementSibling);
  }
  content.append(fields);
  if(item.extra.length){
   const additional=doc.createElement('details');additional.className='discipline-extra';
   const additionalSummary=doc.createElement('summary');additionalSummary.textContent=t('Additional details · optional','Detalles adicionales · opcionales');
   const extraFields=doc.createElement('div');extraFields.className='discipline-step-fields';
   for(const key of item.extra){const node=findNode(key);if(node)extraFields.append(node)}
   additional.append(additionalSummary,extraFields);content.append(additional);
  }
  const actions=doc.createElement('div');actions.className='discipline-step-nav';
  if(index>0){const back=doc.createElement('button');back.type='button';back.className='secondary';back.textContent='← '+t('Previous section','Sección anterior');back.addEventListener('click',()=>showStep(index-1));actions.append(back)}
  if(index<sections.length-1){const next=doc.createElement('button');next.type='button';next.className='secondary discipline-step-next';next.textContent=t('Continue','Continuar')+' →';next.addEventListener('click',()=>showStep(index+1));actions.append(next)}
  if(index===sections.length-1){
   const notice=doc.createElement('p');notice.className='discipline-final-note';notice.textContent=t('Review the employee information, disciplinary action and signatures. Saving creates the professional final PDF report.','Revise los datos del trabajador, la medida disciplinaria y las firmas. Al guardar se genera el reporte PDF profesional.');
   content.append(notice);
   actions.append(nextButton);
  }
  content.append(actions);details.append(summary,content);
  details.addEventListener('toggle',()=>{if(details.open)updateProgress(index)});
  steps.push(details);
  const segment=doc.createElement('span');segment.className='discipline-progress-label';segment.textContent=String(index+1).padStart(2,'0')+' · '+item.title;navigators.push(segment);nav.append(segment);
 }
 // Keep any future fields/extensions in the report, even if a new field was not
 // explicitly classified here. No existing data or field is discarded.
 for(const remaining of Array.from(form.children)){
  if(remaining!==nav)steps[3].querySelector('.discipline-step-fields').append(remaining);
 }
 form.prepend(nav);
 for(const step of steps)form.append(step);
 function updateProgress(active){navigators.forEach((el,i)=>el.classList.toggle('active',i===active))}
 function showStep(index){
  steps.forEach((step,i)=>{step.open=i===index});
  updateProgress(index);
  steps[index].scrollIntoView?.({block:'start',behavior:'smooth'});
 }
 form.addEventListener('invalid',event=>{
  let parent=event.target.closest('details');
  while(parent&&form.contains(parent)){
   parent.open=true;parent=parent.parentElement?.closest('details');
  }
  const step=event.target.closest('.discipline-step');if(step)updateProgress(Math.max(0,Number(step.dataset.step)-1));
 },true);
 form.addEventListener('focusin',event=>{
  let parent=event.target.closest('details');
  while(parent&&form.contains(parent)){parent.open=true;parent=parent.parentElement?.closest('details')}
 });
 updateProgress(0);
 form.dataset.disciplineSimplified='true';
}
