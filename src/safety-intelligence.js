/** Read-only Safety Intelligence dashboard; only director/admin may change cadence. */
export const safetyTrendTotal = entries => Object.values(entries||{}).reduce((n,v)=>n+Number(v?.count||0),0);
export const safetyTrendDelta = (current,previous) => Number(current||0)-Number(previous||0);
export function mountSafetyIntelligence({db,profile,projectId,tr}){
 const t=(en,es)=>tr(en,es);
 const canConfigure=['admin','safety_director'].includes(profile?.role);
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
  if(m.limited)body.append(el('p','si-warning',t('Some category breakdowns are limited to the first 1,000 records per source.','Algunas categorías se resumen a partir de un máximo de 1,000 registros por fuente.')));
  body.append(el('p','si-footnote',t('Latest analysis: ','Último análisis: ')+date(run.computed_at)+' · '+t('Next eligible run: ','Próxima ejecución prevista: ')+date(setting?.next_run_at)));
  body.append(el('p','si-footnote',t('Record counts are not a safety score or proof of OSHA compliance.','Los conteos no constituyen una puntuación de seguridad ni prueban cumplimiento OSHA.')));
 }
 async function load(){
  const serial=++renderSerial;showEmpty(t('Loading project analysis…','Cargando análisis del proyecto…'));
  try{
   const [settingResult,runResult]=await Promise.all([
    db.from('safety_trend_settings').select('project_id,cadence,enabled,next_run_at,last_run_at').eq('project_id',selectedProject).maybeSingle(),
    db.from('safety_trend_results').select('cadence,period_start,period_end,computed_at,metrics,insights,ai_status').eq('project_id',selectedProject).order('computed_at',{ascending:false}).limit(1)
   ]);
   if(serial!==renderSerial)return;
   if(settingResult.error||runResult.error)throw(settingResult.error||runResult.error);
   const setting=settingResult.data,run=runResult.data?.[0];
   frequencySelect.disabled=!canConfigure||!setting;
   if(setting)frequencySelect.value=setting.cadence;
   setStatus(setting?(setting.enabled?t('Automatic analysis enabled','Análisis automático activado'):t('Automatic analysis paused','Análisis automático pausado')):t('This project has no automatic schedule yet','Este proyecto todavía no tiene programación automática'));
   if(!run){showEmpty(t('No analysis saved yet. It will appear automatically after the first scheduled run.','Todavía no hay análisis guardados. Aparecerán automáticamente después de la primera ejecución programada.'));return}
   showResults(run,setting);
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
