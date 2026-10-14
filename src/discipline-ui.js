/**
 * Presentation-only improvement of Employee Safety Discipline.
 * Preserve the original single scrollable form, all field nodes, their
 * listeners, RLS-aware sticker lookup, auto-drafts, approvals and submission.
 * No wizard, accordions, hidden secondary questions or new form fields.
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
   fields:['violation_type','incident_location','description','hazard_observed','company_rule','osha_reference']
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
  for(const key of group.fields){
   const node=find(key);
   if(!node)continue;
   const hint=key==='evidence'&&node.nextElementSibling?.tagName==='SMALL'?node.nextElementSibling:null;
   fields.append(node);
   if(hint)fields.append(hint);
   if(key==='description'||key==='immediate_action'||key==='employee_name'||key==='action_level')node.classList.add('discipline-priority-field');
   if(key==='employee_orientation_id')node.classList.add('discipline-manual-lookup');
   if(key==='employee_age'||key==='employee_id'||key==='osha_reference'||key==='company_rule')node.classList.add('discipline-secondary-field');
  }
  sections.push(section);
 }
 const finalFields=sections.at(-1).querySelector('.discipline-simple-fields');
 // Never discard future additions or report-signature controls.
 for(const remaining of Array.from(form.children)){
  if(remaining!==submit)finalFields.append(remaining);
 }
 const footer=doc.createElement('div');footer.className='discipline-simple-footer';
 const note=doc.createElement('p');note.textContent=tr('Review the details and signatures. Saving opens the finished report; no information is discarded.','Revise los datos y las firmas. Al guardar se abre el reporte final sin perder información.');
 footer.append(note,submit);
 form.append(...sections,footer);
 form.dataset.disciplineSimplified='true';
}
