// Reference suggestions are for review, NEVER automatic OSHA violation findings.
// Company discipline (e.g. whistle rules or conduct policies) may have no OSHA match.
export const DISCIPLINE_OSHA_REFERENCES=[{"code":"1926.20","label":"29 CFR 1926.20 — General Safety and Health"},{"code":"1926.21","label":"29 CFR 1926.21 — Safety Training"},{"code":"1926.25","label":"29 CFR 1926.25 — Housekeeping"},{"code":"1926.50","label":"29 CFR 1926.50 — First Aid"},{"code":"1926.59","label":"29 CFR 1926.59 — Hazard Communication"},{"code":"1926.95","label":"29 CFR 1926.95 — PPE Criteria"},{"code":"1926.100","label":"29 CFR 1926.100 — Head Protection"},{"code":"1926.101","label":"29 CFR 1926.101 — Hearing Protection"},{"code":"1926.102","label":"29 CFR 1926.102 — Eye and Face Protection"},{"code":"1926.103","label":"29 CFR 1926.103 — Respiratory Protection"},{"code":"1926.150","label":"29 CFR 1926.150 — Fire Protection"},{"code":"1926.151","label":"29 CFR 1926.151 — Fire Prevention"},{"code":"1926.200","label":"29 CFR 1926.200 — Signs and Tags"},{"code":"1926.201","label":"29 CFR 1926.201 — Signaling"},{"code":"1926.251","label":"29 CFR 1926.251 — Rigging Equipment"},{"code":"1926.300","label":"29 CFR 1926.300 — Hand and Power Tools"},{"code":"1926.302","label":"29 CFR 1926.302 — Power-operated Hand Tools"},{"code":"1926.350","label":"29 CFR 1926.350 — Gas Welding"},{"code":"1926.352","label":"29 CFR 1926.352 — Welding Fire Prevention"},{"code":"1926.404","label":"29 CFR 1926.404 — Electrical Wiring"},{"code":"1926.416","label":"29 CFR 1926.416 — Electrical Safety"},{"code":"1926.417","label":"29 CFR 1926.417 — Lockout of Circuits"},{"code":"1926.451","label":"29 CFR 1926.451 — Scaffolding"},{"code":"1926.452","label":"29 CFR 1926.452 — Specific Scaffolds"},{"code":"1926.453","label":"29 CFR 1926.453 — Aerial Lifts"},{"code":"1926.454","label":"29 CFR 1926.454 — Scaffold Training"},{"code":"1926.501","label":"29 CFR 1926.501 — Fall Protection Duty"},{"code":"1926.502","label":"29 CFR 1926.502 — Fall Protection Systems"},{"code":"1926.503","label":"29 CFR 1926.503 — Fall Protection Training"},{"code":"1926.602","label":"29 CFR 1926.602 — Material Handling Equipment"},{"code":"1926.651","label":"29 CFR 1926.651 — Excavations"},{"code":"1926.652","label":"29 CFR 1926.652 — Excavation Protective Systems"},{"code":"1926.760","label":"29 CFR 1926.760 — Steel Erection Fall Protection"},{"code":"1926.1052","label":"29 CFR 1926.1052 — Stairways"},{"code":"1926.1053","label":"29 CFR 1926.1053 — Ladders"},{"code":"1926.1060","label":"29 CFR 1926.1060 — Ladder / Stairway Training"},{"code":"1926.1153","label":"29 CFR 1926.1153 — Silica"},{"code":"1926.1203","label":"29 CFR 1926.1203 — Confined Spaces General"},{"code":"1926.1204","label":"29 CFR 1926.1204 — Permit-required Confined Spaces"},{"code":"1926.1207","label":"29 CFR 1926.1207 — Confined Space Training"},{"code":"1926.1408","label":"29 CFR 1926.1408 — Crane Power Lines"},{"code":"1926.1417","label":"29 CFR 1926.1417 — Crane Operations"},{"code":"1926.1425","label":"29 CFR 1926.1425 — Clear of Loads"},{"code":"1926.1430","label":"29 CFR 1926.1430 — Crane Training"}];
export const DISCIPLINE_OSHA_BY_VIOLATION={"Fall Protection":["1926.501","1926.502","1926.503"],"PPE":["1926.95","1926.100","1926.102","1926.101","1926.103"],"Ladders / Stairways":["1926.1053","1926.1052","1926.1060"],"Scaffolds / Swing Stage":["1926.451","1926.452","1926.454"],"Electrical":["1926.416","1926.404","1926.417"],"Tools / Power Tools":["1926.300","1926.302"],"Cranes / Rigging":["1926.1417","1926.1425","1926.251","1926.1430","1926.1408"],"Forklift / Heavy Equipment":["1926.602","1926.20","1926.21"],"Housekeeping":["1926.25"],"Traffic Control / MOT":["1926.200","1926.201"],"Unauthorized Unsafe Act":["1926.20","1926.21"],"Failure to Follow Safety Instruction":["1926.21","1926.20"],"No face shield":["1926.102","1926.95"],"No N95 respirator":["1926.103","1926.1153"],"No tagline / tag line":["1926.251","1926.1417"],"Improper high-visibility clothing":["1926.95","1926.201"],"Unsafe use of work equipment":["1926.602","1926.300","1926.20"],"Smoking in a prohibited area":["1926.151","1926.150"]};
export function relatedDisciplineOshaReferences(violation=''){
 return DISCIPLINE_OSHA_BY_VIOLATION[String(violation||'').trim()]||[];
}
export function prioritizeDisciplineOshaReferences(select,violation,tr=(en)=>en){
 if(!select?.ownerDocument)return [];
 const doc=select.ownerDocument,old=select.value,related=relatedDisciplineOshaReferences(violation);
 const option=(label,value)=>{const el=doc.createElement('option');el.value=value;el.textContent=label;return el};
 const priority=doc.createElement('optgroup'),other=doc.createElement('optgroup');
 priority.label=tr('Related to selected violation — check applicability','Relacionadas con la falta — verificar aplicabilidad');
 other.label=tr('Other construction standards','Otras normas de construcción');
 for(const ref of DISCIPLINE_OSHA_REFERENCES){
  (related.includes(ref.code)?priority:other).append(option(ref.label,ref.label));
 }
 other.append(option('Other / Review Required','Other / Review Required'));
 const nodes=[option(tr('Select only if applicable','Seleccione solo si aplica'),'')];
 if(priority.children.length)nodes.push(priority);
 nodes.push(other);select.replaceChildren(...nodes);
 // Preserve an explicit prior selection; never silently make an OSHA allegation.
 select.value=old&&[...select.options].some(x=>x.value===old)?old:'';
 return related;
}
export function attachDisciplineViolationControls(form,tr=(en)=>en){
 const choice=form?.elements?.namedItem('violation_type');
 const input=form?.elements?.namedItem('violation_custom');
 const osha=form?.elements?.namedItem('osha_reference');
 if(!choice||!input||!osha)return ()=>{};
 const refresh=()=>{
  const active=choice.value==='__custom__';
  const label=input.closest('label');
  if(label){label.hidden=!active;label.style.display=active?'':'none'}
  input.disabled=!active;input.required=active;
  prioritizeDisciplineOshaReferences(osha,active?input.value:choice.value,tr);
 };
 choice.addEventListener('change',refresh);
 input.addEventListener('input',()=>{if(choice.value==='__custom__')prioritizeDisciplineOshaReferences(osha,input.value,tr)});
 refresh();
 return refresh;
}
export function disciplineViolationForSave(formData){
 const selected=String(formData?.get?.('violation_type')||'').trim();
 return selected==='__custom__'?String(formData?.get?.('violation_custom')||'').trim():selected;
}
