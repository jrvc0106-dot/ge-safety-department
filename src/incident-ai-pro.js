// Optional editorial help for Incident / Accident / Near Miss draft narratives.
// It never changes an incident classification, OSHA determination, evidence or signatures.
export const INCIDENT_AI_FIELDS=[
  ['potential_outcome','Potential consequences','Posibles consecuencias'],
  ['activity_before','Activity before event','Actividad antes del evento'],
  ['what_happened','What happened','Qué sucedió'],
  ['injury_illness_description','Injury / illness description','Descripción de lesión / enfermedad'],
  ['medical_treatment','Documented treatment','Tratamiento documentado'],
  ['w1_statement','Witness 1 statement','Declaración del testigo 1'],
  ['w2_statement','Witness 2 statement','Declaración del testigo 2'],
  ['immediate_actions','Immediate actions taken','Acciones inmediatas tomadas'],
  ['root_causes','Root causes','Causas raíz'],
  ['contributing_factors','Contributing factors','Factores contribuyentes'],
  ['corrective_actions','Corrective actions','Acciones correctivas'],
  ['employee_statement','Employee statement','Declaración del empleado']
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
  if(fieldOf(form,'emergency_room')?.checked||fieldOf(form,'hospitalized_overnight')?.checked)items.push(['medical_treatment','Documented treatment','Tratamiento documentado']);
  return items.filter(([name])=>!valueOf(form,name)).map(([field,en,es])=>({field,en,es,messageEn:'Missing factual information; complete or explain that it is pending.',messageEs:'Falta información factual; complétela o explique que está pendiente.'}));
}
export function attachIncidentAI(form,{db,url,key,project,tr}){
  if(!form||form.dataset.incidentAiPro)return;
  form.dataset.incidentAiPro='true';
  const panel=document.createElement('section');
  panel.className='incident-card incident-ai-pro';
  panel.dataset.incidentAi='true';
  panel.innerHTML='<div class="incident-ai-head"><span aria-hidden="true">✨</span><div><h2>Improve Writing PRO – Incident / Accident Report</h2><p>'+tr('AI Writing Assistant · Review before completing the report.','Asistente de redacción IA · Revise antes de completar el reporte.')+'</p></div></div><label class="incident-ai-language">'+tr('Final writing language','Idioma final de redacción')+'<select data-incident-ai-language><option value="en">English</option><option value="es">Español</option></select></label><div class="incident-ai-options"><button type="button" data-incident-ai-action="all">'+tr('Improve Full Incident Report','Mejorar todo el reporte de incidente')+'<small>'+tr('Edit all filled narratives in one review.','Mejorar todos los textos completados en una revisión.')+'</small></button><button type="button" data-incident-ai-action="missing">'+tr('Find Missing Information','Encontrar información faltante')+'<small>'+tr('Mark fields in red and jump to each one.','Marcar campos en rojo y abrirlos directamente.')+'</small></button><button type="button" data-incident-ai-action="professional">'+tr('Professional Safety Writing','Redacción profesional de seguridad')+'<small>'+tr('Focus on event facts, investigation and corrective actions.','Enfocar hechos, investigación y acciones correctivas.')+'</small></button></div><p class="incident-ai-privacy">'+tr('Only written incident notes are sent to the configured Gemini service. Avoid unnecessary employee identifiers. AI cannot establish root causes, certify facts, or determine OSHA recordability.','Solo las notas escritas del incidente se envían al servicio Gemini configurado. Evite identificadores innecesarios del empleado. La IA no puede determinar causas raíz, certificar hechos ni decidir la recordabilidad OSHA.')+'</p><div class="incident-ai-status" role="status" aria-live="polite"></div><div class="incident-ai-issues" aria-live="polite"></div>';
  form.querySelector('.incident-submit')?.before(panel);
  const lang=panel.querySelector('[data-incident-ai-language]');
  lang.value=tr('en','es');
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
      const response=await fetch(url+'/functions/v1/improve-writing',{method:'POST',headers:{Authorization:'Bearer '+token,apikey:key,'Content-Type':'application/json'},body:JSON.stringify({...payload,action:'incident_pro',project_id:project,incident_type:valueOf(form,'incident_type'),language:lang.value}),signal:controller.signal});
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
  async function run(action){
    if(busy)return;busy=true;buttons.forEach(b=>b.disabled=true);
    const mode=action==='professional'?'professional':'all',fields=filledFields(mode);
    try{
      if(action==='missing'){
        const local=incidentMissingFields(form);showIssues(local);
        if(!fields.length){note('Fields requiring attention are marked in red.','Los campos que requieren atención están marcados en rojo.');return}
        note('Checking the written facts for unclear details…','Revisando los hechos escritos para detectar detalles poco claros…');
        const remote=await request({mode:'review',fields,style:'all'});
        const more=(Array.isArray(remote.suggestions)?remote.suggestions:[]).filter(x=>typeof x.field==='string'&&typeof x.message==='string').map(x=>({field:x.field,en:languageLabel(x.field,'en'),es:languageLabel(x.field,'es'),message:x.message}));
        showIssues([...local,...more]);if(local.length||more.length)note('Select an issue to go directly to that field.','Seleccione un aviso para ir directamente al campo.');
      }else{
        if(!fields.length){note('Write at least one narrative field before requesting AI improvements.','Escriba al menos un campo narrativo antes de solicitar mejoras con IA.');return}
        note('Preparing professional writing proposals…','Preparando propuestas de redacción profesional…');
        const originals=new Map(fields.map(x=>[x.field,fieldOf(form,x.field)?.value]));
        const response=await request({mode:'rewrite',fields,style:mode});
        if(fields.some(x=>fieldOf(form,x.field)?.value!==originals.get(x.field))){note('The draft changed while AI was preparing. Run the review again.','El borrador cambió mientras se preparaba la IA. Repita la revisión.');return}
        proposalReview(fields,response.entries||[]);
      }
    }catch(err){note(err?.name==='AbortError'?'AI request timed out. The draft was not changed.':'AI could not complete the request. The draft was not changed.',err?.name==='AbortError'?'La solicitud de IA agotó el tiempo. El borrador no cambió.':'La IA no pudo completar la solicitud. El borrador no cambió.');const details=document.createElement('small');details.textContent=err.message||'';status.append(details)}
    finally{busy=false;buttons.forEach(b=>b.disabled=false)}
  }
  buttons.forEach(button=>button.addEventListener('click',()=>run(button.dataset.incidentAiAction)));
  form.addEventListener('input',event=>{if(event.target?.classList?.contains('incident-ai-missing')){event.target.classList.remove('incident-ai-missing');event.target.removeAttribute('aria-invalid')}});
  return panel;
}
