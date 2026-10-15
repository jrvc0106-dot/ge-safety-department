// Local, immediate permit completeness assistant. Advisory only; never authorizes entry.
export function inspectConfinedSpace(form,definition,translate=(en)=>en){
 const issues=[];
 const data=new FormData(form);
 const missing=(name)=>!String(data.get(name)||'').trim();
 const required=['space_id','location','purpose','classification','hazards','isolation','acceptable_conditions','atmospheric_tests','entrants','attendants','entry_supervisor','rescue_service','rescue_procedure','entry_conditions_verified','authorization','entry_date','entry_start','entry_end'];
 for(const name of required)if(missing(name)){
  const item=definition.fields.find(f=>f[0]===name);
  issues.push({name,problem:translate('Missing','Falta')+': '+(item?translate(item[1],item[2]):name)});
 }
 const operational=['monitoring','ventilation','equipment','coordination'];
 for(const name of operational)if(missing(name)){const item=definition.fields.find(f=>f[0]===name);issues.push({name,problem:translate('Missing selection','Falta seleccionar')+': '+(item?translate(item[1],item[2]):name)});}
 const unsafe=['notready','pending','nonpermit'];
 for(const name of ['classification','isolation','acceptable_conditions','monitoring','ventilation','equipment','coordination','entry_conditions_verified','authorization']){
  if(unsafe.includes(String(data.get(name)||''))){
   const item=definition.fields.find(f=>f[0]===name);
   issues.push({name,problem:translate('Requires corrective action','Requiere corrección')+': '+(item?translate(item[1],item[2]):name)});
  }
 }
 definition.checklist.forEach(([en,es],i)=>{
  const value=data.get('check_'+i);
  if(!value||value==='follow_up')issues.push({name:'check_'+i,problem:(value?translate('Not resolved','No resuelto'):translate('Not answered','Sin responder'))+': '+translate(en,es)});
 });
 for(const role of ['entry_supervisor','attendant','safety']){
  const name='jha_'+role+'_name',sig='jha_'+role+'_signature';
  let strokes=[];try{strokes=JSON.parse(data.get(sig)||'[]')}catch{}
  if(missing(name)||!Array.isArray(strokes)||!strokes.length)issues.push({name:missing(name)?name:sig,problem:translate('Required name or signature missing','Falta nombre o firma obligatoria')+': '+role.replaceAll('_',' ')});
 }
 return issues;
}
export function mountConfinedSpaceAssistant(form,definition,translate=(en)=>en){
 const panel=document.createElement('section');
 panel.className='st-cs-assistant';
 const trigger=document.createElement('button');trigger.type='button';trigger.className='secondary';
 trigger.textContent=translate('✨ Quick AI-style permit review','✨ Asistente inteligente: revisar mi permiso');
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const results=document.createElement('div');
 panel.append(trigger,status,results);form.prepend(panel);
 let currentIssues=[];
 let currentIndex=0;
 const gotoIssue=(item)=>{
  const target=Array.from(form.elements).find(el=>el.name===item.name);
  if(!target)return;
  target.scrollIntoView({behavior:'smooth',block:'center'});
  target.focus({preventScroll:true});
 };
 const next=document.createElement('button');next.type='button';next.className='secondary';
 next.textContent=translate('Next missing item →','Siguiente pendiente →');next.hidden=true;
 panel.append(next);
 next.onclick=()=>{if(!currentIssues.length)return;gotoIssue(currentIssues[currentIndex%currentIssues.length]);currentIndex++};
 function review(){
  const problems=inspectConfinedSpace(form,definition,translate);
  results.replaceChildren();
  panel.classList.toggle('st-cs-assistant-alert',problems.length>0);
  currentIssues=problems;currentIndex=0;next.hidden=!problems.length;
  form.querySelectorAll('.st-cs-needs-attention').forEach(el=>{el.classList.remove('st-cs-needs-attention');el.removeAttribute('data-cs-missing')});
  problems.forEach(item=>{const target=Array.from(form.elements).find(el=>el.name===item.name);if(target){const section=target.closest('.st-cs-check-row, label, .jha-signature-block, .report-signature-field')||target;section.classList.add('st-cs-needs-attention');section.setAttribute('data-cs-missing','true')}});
  status.textContent=problems.length?translate('Items to review: ','Puntos por revisar: ')+problems.length:translate('All required entries appear complete. Supervisor must independently verify safe conditions before authorizing entry.','Los datos requeridos parecen completos. El supervisor debe verificar personalmente las condiciones antes de autorizar la entrada.');
  problems.forEach(item=>{
   const b=document.createElement('button');b.type='button';b.className='st-cs-assistant-item';b.textContent=item.problem;
   b.onclick=()=>gotoIssue(item);
   results.append(b);
  });
  return problems;
 }
 trigger.onclick=()=>{review();if(currentIssues.length)gotoIssue(currentIssues[0]);};
 form.addEventListener('invalid',event=>{if(event.target?.name)review();},true);
 form.addEventListener('submit',()=>review(),true);
 form.addEventListener('change',review);
 let queued=false;
 form.addEventListener('input',()=>{if(!currentIssues.length||queued)return;queued=true;requestAnimationFrame(()=>{queued=false;if(form.isConnected)review();});});
 review();
 return {review,goFirst:()=>{const pending=review();if(pending.length)gotoIssue(pending[0]);}};
}
