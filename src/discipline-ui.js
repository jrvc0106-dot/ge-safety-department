/**
 * Keep Employee Safety Discipline as one continuous form, like the original.
 * Visual groupings only: original controls and their events, names and values
 * are moved intact. No accordions, wizard steps or hidden optional sections.
 */
export function simplifyDisciplineForm(form,tr){
 if(!form||form.dataset.disciplineSimplified==='true')return;
 const submit=form.querySelector('button[type="submit"]');
 const signature=form.querySelector('.jha-approval-fields');
 if(!submit||!signature)return;
 const doc=form.ownerDocument;
 const field=name=>form.elements.namedItem(name)?.closest?.('label')||null;
 const find=key=>key.startsWith('.')||key.startsWith('#')?form.querySelector(key):field(key);
 const sections=[
  {heading:tr('Employee Information','Información del trabajador'),keys:['employee_orientation_id','.discipline-sticker-lookup','employee_name','employee_id','employee_position','employee_age','#employee-discipline-summary']},
  {heading:tr('Safety Violation','Violación de seguridad'),keys:['violation_type','incident_location','description','company_rule','osha_reference','hazard_observed']},
  {heading:tr('Disciplinary Action','Acción disciplinaria'),keys:['action_level','custom_action','immediate_action','supervisor_name','retraining_required','retraining_topic','follow_up_required','follow_up_notes']},
  {heading:tr('Evidence & Signatures','Evidencia y firmas'),keys:['employee_comments','employee_acknowledged','evidence','.jha-approval-fields']}
 ];
 const blocks=[];
 for(const group of sections){
  const section=doc.createElement('section');
  section.className='discipline-simple-section';
  const heading=doc.createElement('h3');heading.className='discipline-simple-heading';heading.textContent=group.heading;
  const fields=doc.createElement('div');fields.className='discipline-simple-fields';
  section.append(heading,fields);
  for(const key of group.keys){
   const node=find(key);
   if(!node)continue;
   // The evidence helper belongs with the photo picker rather than remaining
   // among unrelated controls at the bottom of the form.
   const help=key==='evidence'&&node.nextElementSibling?.tagName==='SMALL'?node.nextElementSibling:null;
   fields.append(node);
   if(help)fields.append(help);
  }
  blocks.push(section);
 }
 const finalFields=blocks.at(-1).querySelector('.discipline-simple-fields');
 // Preserve unclassified fields introduced by future additions rather than
 // silently dropping them from the form or its draft/submit payload.
 for(const remaining of Array.from(form.children)){
  if(remaining!==submit)finalFields.append(remaining);
 }
 const footer=doc.createElement('div');footer.className='discipline-simple-footer';
 const note=doc.createElement('p');note.textContent=tr('Review the information and signatures before saving. The final professional report opens after saving.','Revise los datos y las firmas antes de guardar. El reporte profesional se abrirá al guardar.');
 footer.append(note,submit);
 form.append(...blocks,footer);
 form.dataset.disciplineSimplified='true';
}
