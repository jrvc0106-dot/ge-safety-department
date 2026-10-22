import {createSafetyIntelligencePdf,safetyPdfFilename} from './safety-intelligence-report.js';
/** Read-only Safety Intelligence dashboard; only director/admin may change cadence. */
export const safetyTrendTotal = entries => Object.values(entries||{}).reduce((n,v)=>n+Number(v?.count||0),0);
export const safetyTrendDelta = (current,previous) => Number(current||0)-Number(previous||0);
export const canViewSafetyAiFindings = role => role==='admin'||role==='safety_director';
export function mountSafetyIntelligence({db,profile,projectId,tr}){
 const t=(en,es)=>tr(en,es);
 const canConfigure=canViewSafetyAiFindings(profile?.role);
 const canViewFindings=canConfigure;
 const card=document.createElement('section');
 card.className='card safety-intelligence';
 const section=document.querySelector('.report-library');
 if(!section)return;
 section.before(card);
 const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x};
 const header=el('div','si-heading');
 const title=el('div');
 title.append(el('h2','',t('Safety Intelligence · AI','Inteligencia de Seguridad · IA')),
  el('p','',t('Automatic project analysis from report counts · No employee names or report narratives are shared with AI.','Análisis automático por obra basado en estadísticas · No se envían nombres ni textos de reportes a la IA.')));
 header.append(title);
 const controls=el('div','si-controls');
 const projectLabel=el('label','si-label',t('Jobsite','Proyecto'));
 const projectSelect=el('select','si-select');
 projectLabel.append(projectSelect);
 const frequencyLabel=el('label','si-label',t('Automatic frequency','Frecuencia automática'));
 const frequencySelect=el('select','si-select');
 for(const [value,en,es] of [['weekly','Weekly · last 7 days','Semanal · últimos 7 días'],['monthly','Monthly · last 30 days','Mensual · últimos 30 días']]){
  const option=el('option','',t(en,es));option.value=value;frequencySelect.append(option);
 }
 frequencySelect.disabled=!canConfigure;
 frequencyLabel.append(frequencySelect);
 controls.append(projectLabel,frequencyLabel);
 const status=el('p','si-status');
 const body=el('div','si-body');
 card.append(header,controls,status,body);
 let selectedProject=projectId,projects=[],renderSerial=0;
 const date=v=>v?new Date(v).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'—';
 const setStatus=(text,warning=false)=>{status.textContent=text;status.classList.toggle('si-warning',warning)};
 const metric=(label,value,subtitle='')=>{
  const box=el('div','si-metric');box.append(el('span','si-metric-label',label),el('strong','si-metric-value',String(value)),el('small','si-metric-note',subtitle));return box;
 };
 function showEmpty(message){body.replaceChildren(el('p','si-empty',message))}
 function showResults(run,setting){
  body.replaceChildren();
  const m=run.metrics||{},current=m.current||{},previous=m.previous||{};
  const total=safetyTrendTotal(current),prior=safetyTrendTotal(previous);
  const difference=safetyTrendDelta(total,prior);
  const stats=el('div','si-metrics');
  stats.append(
   metric(t('Records analyzed','Registros analizados'),total,t('Previous period','Período anterior')+': '+prior),
   metric(t('Period change','Cambio del período'),(difference>0?'+':'')+difference,t('Records vs. previous period','Registros frente al período anterior')),
   metric(t('Open observations','Observaciones abiertas'),m.open_observations_now??'—',t('Current open or pending verification','Abiertas o pendientes de verificación')),
   metric(t('Incident reports','Reportes de incidentes'),current.incidents?.count||0,t('Includes recorded near misses','Incluye Near Miss registrados'))
  );body.append(stats);
  const facts=el('div','si-facts');
  const categories=current.observations?.categories||[];
  const issues=categories.length?categories.slice(0,4).map(x=>x.label+' ('+x.count+')').join(' · '):t('No observation categories recorded','Sin categorías de observación registradas');
  facts.append(el('p','',t('Most frequent observation categories: ','Categorías de observación más frecuentes: ')+issues));
  facts.append(el('p','',t('Daily safety walks: ','Recorridos diarios: ')+(current.daily_reports?.count||0)+' · '+
   t('Equipment inspections: ','Inspecciones de equipos: ')+(current.equipment_inspections?.count||0)+' · '+
   t('Disciplinary reports: ','Reportes disciplinarios: ')+(current.disciplinary_actions?.count||0)+' · '+
   t('Safety tools: ','Herramientas de Safety: ')+(current.safety_tools?.count||0)));
  body.append(facts);
  if(canViewFindings){
  const ai=el('div','si-insights');
  ai.append(el('h3','',t('AI findings','Conclusiones de IA')));
  if(run.ai_status==='complete'&&Array.isArray(run.insights)&&run.insights.length){
   for(const entry of run.insights){
    const item=el('div','si-insight');
    item.append(el('strong','',entry.title),el('p','',entry.summary),el('small','',t('Review: ','Revisar: ')+entry.question));ai.append(item);
   }
  }else{
   ai.append(el('p','si-empty',run.ai_status==='unavailable'?
    t('The statistics were saved, but AI could not complete this analysis. The system will retry automatically.','Las estadísticas se guardaron, pero la IA no pudo completar el análisis. El sistema reintentará automáticamente.'):
    t('Not enough reports this period for reliable AI findings.','No hay suficientes registros en este período para conclusiones confiables de IA.')));
  }
  body.append(ai);
  }
  if(m.limited)body.append(el('p','si-warning',t('Some category breakdowns are limited to the first 1,000 records per source.','Algunas categorías se resumen a partir de un máximo de 1,000 registros por fuente.')));
  body.append(el('p','si-footnote',t('Latest analysis: ','Último análisis: ')+date(run.computed_at)+' · '+t('Next eligible run: ','Próxima ejecución prevista: ')+date(setting?.next_run_at)));
  body.append(el('p','si-footnote',t('Record counts are not a safety score or proof of OSHA compliance.','Los conteos no constituyen una puntuación de seguridad ni prueban cumplimiento OSHA.')));
  const actions=el('div','si-pdf-actions');
  const exportMessage=el('p','si-export-message');
  exportMessage.setAttribute('role','status');
  exportMessage.setAttribute('aria-live','polite');
  const projectName=projects.find(p=>p.id===selectedProject)?.name||selectedProject;
  const filename=safetyPdfFilename(projectName,run);
  const buttons=[];
  const addAction=(label,action)=>{
   const btn=el('button','si-pdf-button'+(action==='view'?' si-pdf-primary':''),label);
   btn.type='button';
   btn.onclick=()=>exportPdf(action,btn);
   buttons.push(btn);actions.append(btn);
  };
  let cachedPdf=null,exportBusy=false;
  const saveBlob=(blob)=>{
   const link=document.createElement('a'),href=URL.createObjectURL(blob);
   link.href=href;link.download=filename;document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(href),120000);
  };
  async function exportPdf(action,btn){
   if(exportBusy)return;
   // Reserve an actual tab while Safari still has user-click activation.
   let preview=null;
   if(action==='view'){
    try{preview=window.open('about:blank','_blank');if(preview)preview.opener=null}catch{}
   }
   exportBusy=true;
   for(const button of buttons)button.disabled=true;
   exportMessage.textContent=t('Preparing professional PDF…','Preparando PDF profesional…');
   try{
    const blob=cachedPdf||await createSafetyIntelligencePdf(run,projectName);
    cachedPdf=blob;
    if(action==='view'){
     if(preview){
      const href=URL.createObjectURL(blob);
      preview.location.href=href;
      setTimeout(()=>URL.revokeObjectURL(href),600000);
      exportMessage.textContent=t('Report opened in another tab.','Reporte abierto en otra pestaña.');
     }else{
      saveBlob(blob);
      exportMessage.textContent=t('Preview blocked; the PDF was downloaded instead.','La vista fue bloqueada; se descargó el PDF.');
     }
    }else if(action==='download'){
     saveBlob(blob);
     exportMessage.textContent=t('PDF download started.','Descarga del PDF iniciada.');
    }else if(action==='share'){
     const file=new File([blob],filename,{type:'application/pdf'});
     if(navigator.share&&navigator.canShare?.({files:[file]})){
      try{
       await navigator.share({title:'G&E Safety Intelligence - '+projectName,files:[file]});
       exportMessage.textContent=t('PDF shared.','PDF compartido.');
      }catch(error){
       if(error?.name==='AbortError')exportMessage.textContent=t('Sharing canceled.','Se canceló la opción de compartir.');
       else{saveBlob(blob);exportMessage.textContent=t('Sharing was unavailable; the PDF was downloaded.','No se pudo compartir; se descargó el PDF.')}
      }
     }else{
      saveBlob(blob);
      exportMessage.textContent=t('File sharing is unavailable here; the PDF was downloaded.','Este navegador no permite compartir archivos; se descargó el PDF.');
     }
    }
   }catch(error){
    if(preview&&!preview.closed)preview.close();
    exportMessage.textContent=t('Could not prepare the PDF. Please try again.','No se pudo preparar el PDF. Intenta nuevamente.');
    console.error('[Safety Intelligence PDF]',error?.message||error);
   }finally{
    exportBusy=false;
    for(const button of buttons)button.disabled=false;
   }
  }
  addAction(t('View report','Ver reporte'),'view');
  addAction(t('Download PDF','Descargar PDF'),'download');
  addAction(t('Share PDF','Compartir PDF'),'share');
  body.append(actions,exportMessage);
 }
 async function load(){
  const serial=++renderSerial;showEmpty(t('Loading project analysis…','Cargando análisis del proyecto…'));
  try{
   const [settingResult,runResult]=await Promise.all([
    db.from('safety_trend_settings').select('project_id,cadence,enabled,next_run_at,last_run_at').eq('project_id',selectedProject).maybeSingle(),
    db.from('safety_trend_results').select('id,cadence,period_start,period_end,computed_at,metrics,ai_status').eq('project_id',selectedProject).order('computed_at',{ascending:false}).limit(1)
   ]);
   if(serial!==renderSerial)return;
   if(settingResult.error||runResult.error)throw(settingResult.error||runResult.error);
   const setting=settingResult.data,run=runResult.data?.[0];
   frequencySelect.disabled=!canConfigure||!setting;
   if(setting)frequencySelect.value=setting.cadence;
   setStatus(setting?(setting.enabled?t('Automatic analysis enabled','Análisis automático activado'):t('Automatic analysis paused','Análisis automático pausado')):t('This project has no automatic schedule yet','Este proyecto todavía no tiene programación automática'));
   if(!run){showEmpty(t('No analysis saved yet. It will appear automatically after the first scheduled run.','Todavía no hay análisis guardados. Aparecerán automáticamente después de la primera ejecución programada.'));return}
   // Read sensitive AI findings only through the role-checked server RPC.
   // Safety/supervisor users receive aggregate metrics but never the insights JSON.
   let authorizedRun=run;
   if(canViewFindings){
    const findings=await db.rpc('get_safety_ai_findings',{p_result_id:run.id});
    if(serial!==renderSerial)return;
    if(findings.error)throw findings.error;
    authorizedRun={...run,insights:Array.isArray(findings.data)?findings.data:[]};
   }
   showResults(authorizedRun,setting);
  }catch(error){
   if(serial!==renderSerial)return;
   setStatus(t('Could not load analysis. Check your connection and access.','No se pudo cargar el análisis. Revisa la conexión y los permisos.'),true);
   showEmpty(t('Try opening Report Center again.','Intenta abrir Report Center nuevamente.'));
  }
 }
 projectSelect.onchange=()=>{selectedProject=projectSelect.value;load()};
 frequencySelect.onchange=async()=>{
  if(!canConfigure)return;
  const chosen=frequencySelect.value;
  frequencySelect.disabled=true;
  setStatus(t('Saving automatic schedule…','Guardando programación automática…'));
  const {data,error}=await db.from('safety_trend_settings').update({cadence:chosen,next_run_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('project_id',selectedProject).select('project_id').maybeSingle();
  if(error||!data){setStatus(t('The schedule could not be saved.','No se pudo guardar la programación.'),true)}
  else setStatus(t('Schedule saved. The new frequency starts on the next automatic run.','Programación guardada. La nueva frecuencia comienza en la próxima ejecución automática.'));
  await load();
 };
 (async()=>{
  try{
   const r=await db.from('projects').select('id,name,status').eq('status','active').order('name');
   if(r.error)throw r.error;
   projects=r.data||[];
   if(!projects.length){setStatus(t('No authorized active projects found.','No se encontraron proyectos activos autorizados.'),true);showEmpty('');return}
   projectSelect.replaceChildren();
   for(const p of projects){const option=el('option','',p.name);option.value=p.id;projectSelect.append(option)}
   if(!projects.some(p=>p.id===selectedProject))selectedProject=projects[0].id;
   projectSelect.value=selectedProject;
   await load();
  }catch(error){setStatus(t('Project list unavailable.','No se pudo cargar la lista de proyectos.'),true)}
 })();
}
