// Optional editorial help for Incident / Accident / Near Miss draft narratives.
// It never changes an incident classification, OSHA determination, evidence or signatures.
export const INCIDENT_AI_FIELDS=[
  ['potential_outcome','Potential consequences','Posibles consecuencias'],
  ['activity_before','Activity before event','Actividad antes del evento'],
  ['what_happened','What happened','Qué sucedió'],
  ['injury_illness_description','Injury / illness description','Descripción de lesión / enfermedad'],
  ['w1_statement','Witness 1 statement','Declaración del testigo 1'],
  ['w2_statement','Witness 2 statement','Declaración del testigo 2'],
  ['immediate_actions','Immediate actions taken','Acciones inmediatas tomadas'],
  ['root_causes','Root causes','Causas raíz'],
  ['contributing_factors','Contributing factors','Factores contribuyentes'],
  ['corrective_actions','Corrective actions','Acciones correctivas']
];
const LABELS=new Map(INCIDENT_AI_FIELDS.map(([key,en,es])=>[key,{en,es}]));
const SAFETY_FIELDS=new Set(['potential_outcome','what_happened','immediate_actions','root_causes','contributing_factors','corrective_actions']);
const fieldOf=(form,name)=>form.elements.namedItem(name);
const valueOf=(form,name)=>String(fieldOf(form,name)?.value||'').trim();
const languageLabel=(key,lang)=>LABELS.get(key)?.[lang]||key;
export function incidentMissingFields(form){
  const kind=valueOf(form,'incident_type'),items=[
    ['incident_at','Incident date / time','Fecha y hora del incidente'],
    ['exact_location','Exact location','Ubicación exacta'],
    ['activity_before','Activity before event','Actividad antes del evento'],
    ['what_happened','What happened','Qué sucedió'],
    ['immediate_actions','Immediate actions taken','Acciones inmediatas tomadas'],
    ['root_causes','Root causes / investigation status','Causas raíz / estado de investigación'],
    ['corrective_actions','Corrective actions and responsible person','Acciones correctivas y responsable']
  ];
  if(kind==='near_miss')items.push(['potential_outcome','Potential consequences','Posibles consecuencias']);
  if(kind==='injury'||kind==='illness')items.push(['injury_illness_description','Injury / illness description','Descripción de lesión / enfermedad']);
  if(valueOf(form,'w1_name'))items.push(['w1_statement','Witness 1 statement','Declaración del testigo 1']);
  if(valueOf(form,'w2_name'))items.push(['w2_statement','Witness 2 statement','Declaración del testigo 2']);
  if(fieldOf(form,'emergency_room')?.checked||fieldOf(form,'hospitalized_overnight')?.checked)items.push(['medical_treatment_choice','Treatment selection','Selección de tratamiento']);
  return items.filter(([name])=>!valueOf(form,name)).map(([field,en,es])=>({field,en,es,messageEn:'Missing factual information; complete or explain that it is pending.',messageEs:'Falta información factual; complétela o explique que está pendiente.'}));
}
export function attachIncidentAI(form,{db,url,key,project,tr}){
  if(!form||form.dataset.incidentAiPro)return;
  form.dataset.incidentAiPro='true';
  const panel=document.createElement('section');
  panel.className='incident-card incident-ai-pro';
  panel.dataset.incidentAi='true';
  panel.innerHTML='<div class="incident-ai-head"><div><h2>AI QUICK REVIEW &amp; IMPROVE</h2><p>One action: flag missing information, check written facts, and suggest clearer English.</p></div></div><div class="incident-ai-options"><button type="button" data-incident-ai-action="quick">AI QUICK REVIEW &amp; IMPROVE</button></div><p class="incident-ai-privacy">Local checks run first. One optional AI request reviews only incident narrative notes. No photographs, identities, signatures or medical identifiers are sent. Suggested edits require your approval. Reports can be saved without AI.</p><div class="incident-ai-status" role="status" aria-live="polite"></div><div class="incident-ai-issues" aria-live="polite"></div>';
  form.querySelector('.incident-submit')?.before(panel);
  const lang={value:'en'};
  const status=panel.querySelector('.incident-ai-status'),issues=panel.querySelector('.incident-ai-issues');
  const buttons=[...panel.querySelectorAll('[data-incident-ai-action]')];
  let busy=false;
  function note(en,es){status.textContent=tr(en,es)}
  function clearFlags(){
    for(const field of form.querySelectorAll('.incident-ai-missing')){field.classList.remove('incident-ai-missing');field.removeAttribute('aria-invalid')}
  }
  function jump(field){
    const target=fieldOf(form,field);if(!target)return;
    const near=target.closest('[data-near-miss]');if(near?.hidden)return;
    target.scrollIntoView?.({behavior:'smooth',block:'center'});target.focus?.();
  }
  function showIssues(items){
    clearFlags();issues.replaceChildren();
    const distinct=new Set();
    const filtered=items.filter(item=>{if(!item.field||distinct.has(item.field)||!fieldOf(form,item.field))return false;distinct.add(item.field);return true});
    if(!filtered.length){note('No missing or unclear narrative details were identified. Review all facts before finalizing.','No se identificaron detalles narrativos faltantes o poco claros. Revise los hechos antes de finalizar.');return}
    const heading=document.createElement('p');heading.textContent=tr('Review these fields:','Revise estos campos:');issues.append(heading);
    for(const item of filtered){
      const target=fieldOf(form,item.field);
      if(target.closest('[data-near-miss]')?.hidden)continue;
      target.classList.add('incident-ai-missing');target.setAttribute('aria-invalid','true');
      const action=document.createElement('button');action.type='button';action.className='incident-ai-issue';action.textContent='↗ '+(item[lang.value==='es'?'es':'en']||languageLabel(item.field,lang.value))+': '+(item[lang.value==='es'?'messageEs':'messageEn']||item.message||'');
      action.onclick=()=>jump(item.field);issues.append(action);
    }
  }
  async function request(payload){
    if(!db||!url||!key)throw Error(tr('AI service is unavailable. Your draft was not changed.','El servicio de IA no está disponible. Su borrador no fue modificado.'));
    const session=await db.auth.getSession(),token=session.data?.session?.access_token;
    if(!token)throw Error(tr('Please sign in again to use AI.','Inicie sesión de nuevo para usar IA.'));
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),32000);
    try{
      const response=await fetch(url+'/functions/v1/improve-writing',{method:'POST',headers:{Authorization:'Bearer '+token,apikey:key,'Content-Type':'application/json'},body:JSON.stringify({...payload,action:'incident_pro',project_id:project,incident_type:valueOf(form,'incident_type'),language:'en'}),signal:controller.signal});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(body.error||tr('AI could not complete this request. Your draft is unchanged.','La IA no pudo completar la solicitud. Su borrador no cambió.'));
      return body;
    }finally{clearTimeout(timer)}
  }
  function filledFields(mode){
    return INCIDENT_AI_FIELDS.filter(([field])=>(mode!=='professional'||SAFETY_FIELDS.has(field))&&!!valueOf(form,field)&&!fieldOf(form,field)?.closest('[data-near-miss]')?.hidden).map(([field])=>({field,text:valueOf(form,field)}));
  }
  function proposalReview(original,entries){
    const byName=new Map(entries.filter(entry=>typeof entry?.field==='string'&&typeof entry?.text==='string').map(entry=>[entry.field,entry.text]));
    const dialog=document.createElement('dialog');dialog.className='incident-ai-dialog';
    const title=document.createElement('h2');title.textContent=tr('Review AI proposals','Revisar propuestas de IA');
    const explanation=document.createElement('p');explanation.textContent=tr('Select the edits you want, compare them with the original, and check every fact. No change is applied until you accept.','Seleccione los cambios, compárelos con el original y verifique todos los hechos. Nada se modifica hasta que acepte.');
    const list=document.createElement('div');list.className='incident-ai-proposals';
    const edits=[];
    for(const item of original){
      const proposal=byName.get(item.field);if(!proposal?.trim())continue;
      const input=fieldOf(form,item.field),max=Number(input?.maxLength)>0?Math.min(input.maxLength,3000):3000;
      const group=document.createElement('section');group.className='incident-ai-proposal';
      const check=document.createElement('input');check.type='checkbox';check.checked=true;
      const label=document.createElement('label');label.append(check,document.createTextNode(' '+languageLabel(item.field,lang.value)));group.append(label);
      const originalText=document.createElement('details');const summary=document.createElement('summary');summary.textContent=tr('View original','Ver original');const pre=document.createElement('p');pre.textContent=item.text;originalText.append(summary,pre);group.append(originalText);
      const textarea=document.createElement('textarea');textarea.value=proposal;textarea.maxLength=max;textarea.setAttribute('aria-label',languageLabel(item.field,lang.value));group.append(textarea);list.append(group);
      edits.push({input,item,check,textarea});
    }
    if(!edits.length){note('AI did not return complete proposals. Original text was kept.','La IA no devolvió propuestas completas. Se conservó el texto original.');return}
    const footer=document.createElement('div');footer.className='incident-ai-review-actions';
    const apply=document.createElement('button');apply.type='button';apply.textContent=tr('Apply selected edits','Aplicar cambios seleccionados');
    const discard=document.createElement('button');discard.type='button';discard.className='secondary';discard.textContent=tr('Discard','Descartar');
    const notice=document.createElement('p');notice.setAttribute('role','alert');
    apply.onclick=()=>{
      const selected=edits.filter(x=>x.check.checked);
      if(selected.some(x=>!x.input?.isConnected||x.input.value.trim()!==x.item.text||!x.textarea.value.trim()||x.textarea.value.length>(Number(x.input.maxLength)>0?Math.min(x.input.maxLength,3000):3000))){
        notice.textContent=tr('A field changed or a proposal is invalid. Refresh the AI review before applying.','Un campo cambió o una propuesta no es válida. Actualice la revisión de IA antes de aplicarla.');return;
      }
      for(const x of selected){if(x.input.dataset.aiOriginal===undefined)x.input.dataset.aiOriginal=x.input.value;x.input.value=x.textarea.value;x.input.dispatchEvent(new Event('input',{bubbles:true}))}
      dialog.close();note('Selected writing improvements applied to the draft. Review before submitting.','Cambios seleccionados aplicados al borrador. Revise antes de enviar.');
    };
    discard.onclick=()=>dialog.close();
    footer.append(apply,discard);dialog.append(title,explanation,list,notice,footer);
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
  }
  async function run(){
    if(busy)return;
    busy=true;buttons.forEach(b=>b.disabled=true);
    const local=incidentMissingFields(form);
    showIssues(local);
    const fields=filledFields('all');
    try{
      if(!fields.length){note('Missing fields are marked in red. Enter incident facts to improve writing.','Los campos faltantes aparecen en rojo.');return}
      note('Missing fields checked. Preparing writing suggestions…','Revisando redacción…');
      const originals=new Map(fields.map(item=>[item.field,fieldOf(form,item.field)?.value]));
      const result=await request({mode:'rewrite',fields,style:'all'});
      if(fields.some(item=>fieldOf(form,item.field)?.value!==originals.get(item.field))){
        note('Report changed during the review. Run quick review again.','El reporte cambió. Revíselo de nuevo.');return;
      }
      if(local.length)note(local.length+' field(s) need attention. Review suggestions before applying.','Revise los campos pendientes.');
      proposalReview(fields,result.entries||[]);
    }catch(err){
      note(err?.name==='AbortError'?'AI timed out. Missing fields are marked; the draft was not changed.':'AI unavailable. Missing fields are marked; you can complete the report normally.','IA no disponible. El borrador permanece intacto.');
    }finally{busy=false;buttons.forEach(b=>b.disabled=false)}
  }
  buttons.forEach(button=>button.addEventListener('click',run));
  form.addEventListener('input',event=>{if(event.target?.classList?.contains('incident-ai-missing')){event.target.classList.remove('incident-ai-missing');event.target.removeAttribute('aria-invalid')}});
  return panel;
}
