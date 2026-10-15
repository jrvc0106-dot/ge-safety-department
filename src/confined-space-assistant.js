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
  if(missing(name)||!Array.isArray(strokes)||!strokes.length)issues.push({name,problem:translate('Required name or signature missing','Falta nombre o firma obligatoria')+': '+role.replaceAll('_',' ')});
 }
 return issues;
}
export function mountConfinedSpaceAssistant(form,definition,translate=(en)=>en){
 const panel=document.createElement('section');
 panel.className='st-cs-assistant';
 const trigger=document.createElement('button');trigger.type='button';trigger.className='secondary';
 trigger.textContent=translate('✨ Quick AI-style permit review','✨ Asistente inteligente: revisar mi permiso');
 const status=document.createElement('p');status.setAttribute('role','status');
 const results=document.createElement('div');
 panel.append(trigger,status,results);form.prepend(panel);
 function review(){
  const problems=inspectConfinedSpace(form,definition,translate);
  results.replaceChildren();
  status.textContent=problems.length?translate('Items to review: ','Puntos por revisar: ')+problems.length:translate('All required entries appear complete. Supervisor must independently verify safe conditions before authorizing entry.','Los datos requeridos parecen completos. El supervisor debe verificar personalmente las condiciones antes de autorizar la entrada.');
  problems.forEach(item=>{
   const b=document.createElement('button');b.type='button';b.className='st-cs-assistant-item';b.textContent=item.problem;
   b.onclick=()=>{
    const target=Array.from(form.elements).find(el=>el.name===item.name);
    if(!target)return;
    target.scrollIntoView({behavior:'smooth',block:'center'});target.focus({preventScroll:true});
   };
   results.append(b);
  });
 }
 trigger.onclick=review;
 form.addEventListener('invalid',event=>{if(event.target?.name)review();},true);
 form.addEventListener('submit',()=>review(),true);
 form.addEventListener('change',()=>{if(results.childElementCount)review();});
 return {review};
}
