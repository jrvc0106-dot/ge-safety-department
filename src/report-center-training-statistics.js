// Read-only metrics inside Report Center; never modifies source orientation/training records.
export const TRAINING_STATS_CATEGORIES = Object.freeze([
 {id:'quick',en:'Quick Safety Orientation',es:'Orientación rápida',unitEn:'Registered workers',unitEs:'Trabajadores registrados',icon:'◉'},
 {id:'registered',en:'Register Safety Orientation',es:'Orientación completa',unitEn:'Registered workers',unitEs:'Trabajadores registrados',icon:'☑'},
 {id:'toolbox',en:'Toolbox Talks',es:'Toolbox Talks',unitEn:'Sessions conducted',unitEs:'Charlas realizadas',icon:'▤'},
 {id:'training',en:'G&E Safety Training',es:'Entrenamientos G&E',unitEn:'Sessions conducted',unitEs:'Entrenamientos realizados',icon:'◎'}
]);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('en-US').replace(/\s+/g,' ');
const asArray=value=>{
 if(Array.isArray(value))return value;
 if(typeof value!=='string'||!value.trim().startsWith('['))return [];
 try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return []}
};
export function namedAttendance(payload){
 const participants=asArray(payload?.attendance_signatures);
 // A free-text estimate in "attendees" does not establish an attendance count.
 return new Set(participants.map(p=>normalize(typeof p==='string'?p:p?.name)).filter(Boolean)).size;
}
const dateParts=timestamp=>{
 const date=new Date(timestamp);
 if(!Number.isFinite(date.getTime()))return '';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(p=>[p.type,p.value]));
 return [parts.year,parts.month,parts.day].join('-');
};
const dayKey=value=>{
 if(/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return String(value);
 return dateParts(value);
};
const displayDate=value=>{
 const key=dayKey(value);
 return /^\d{4}-\d{2}-\d{2}$/.test(key)?key.slice(5,7)+'/'+key.slice(8,10)+'/'+key.slice(0,4):'—';
};
function withinPeriod(date,preset,now){
 const key=dayKey(date);
 if(preset==='all')return true;
 if(!key)return false;
 const nowKey=dateParts(now);
 if(preset==='year')return key.slice(0,4)===nowKey.slice(0,4);
 if(preset==='today')return key===nowKey;
 if(!['7d','30d'].includes(preset))return true;
 const dateUTC=Date.parse(key+'T12:00:00Z'),endUTC=Date.parse(nowKey+'T12:00:00Z');
 const days=Math.round((endUTC-dateUTC)/86400000);
 return days>=0&&days<(preset==='7d'?7:30);
}
export function trainingStatsRows(data){
 return [
  ...(data.quick||[]).filter(x=>x.status==='final'||x.status===null||x.status===undefined).map(x=>({
   kind:'quick',id:x.id,project_id:x.project_id,date:x.orientation_at||x.created_at,
   name:x.employee_name||'',company:x.employee_company||'',sticker:x.sticker_number||'',creator_id:x.created_by||'',attendees:null,
   detail:x.sticker_number?'Sticker #'+x.sticker_number:'',report_number:''})),
  ...(data.registered||[]).map(x=>({
   kind:'registered',id:x.id,project_id:x.project_id,date:x.orientation_date||x.created_at,
   name:x.employee_name||'',company:x.employee_company||'',sticker:x.sticker_number||'',creator_id:x.created_by||'',attendees:null,
   detail:x.sticker_number?'Sticker #'+x.sticker_number:'',report_number:''})),
  ...(data.tools||[]).filter(x=>x.kind==='toolbox'||x.kind==='training').map(x=>({
   kind:x.kind,id:x.id,project_id:x.project_id,
   date:x.kind==='training'?(x.payload?.training_date||x.created_at):x.created_at,
   name:x.payload?.instructor||'',company:'',sticker:'',creator_id:x.created_by||'',
   attendees:namedAttendance(x.payload),detail:x.kind==='training'?(x.payload?.training_type||x.payload?.topics||''):(x.payload?.topic||x.payload?.topics||''),
   report_number:x.report_number||''
  }))
 ];
}
export function summarizeTrainingStats(data,{project='all',period='all',now=new Date()}={}){
 const filtered=trainingStatsRows(data).filter(row=>(project==='all'||row.project_id===project)&&withinPeriod(row.date,period,now));
 const groups=Object.fromEntries(TRAINING_STATS_CATEGORIES.map(c=>[c.id,filtered.filter(r=>r.kind===c.id).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))]));
 const attendance=groups.toolbox.reduce((n,r)=>n+r.attendees,0)+groups.training.reduce((n,r)=>n+r.attendees,0);
 // Only identical, non-empty sticker numbers can safely be merged. Other records stay separate.
 const orientationRows=[...groups.quick,...groups.registered],identities=new Set();
 for(const row of orientationRows)identities.add(row.sticker?'sticker:'+normalize(row.sticker):row.kind+':'+row.id);
 return {groups,attendance,orientationRecords:orientationRows.length,nonDuplicatedRegistrations:identities.size,
  incompleteIds:orientationRows.filter(r=>!rowHasSticker(r)).length};
}
const rowHasSticker=row=>Boolean(normalize(row.sticker));
async function fetchAll(db,table,columns,projects,filterKind=false){
 const rows=[],size=500;
 for(let index=0;index<projects.length;index+=50){
  const ids=projects.slice(index,index+50);
  for(let offset=0;;offset+=size){
   let query=db.from(table).select(columns).in('project_id',ids).order('created_at',{ascending:false}).range(offset,offset+size-1);
   if(filterKind)query=query.in('kind',['toolbox','training']);
   const response=await query;
   if(response.error)throw new Error('Unable to load statistics from '+table+': '+response.error.message);
   const batch=response.data||[];
   rows.push(...batch);
   if(batch.length<size)break;
   if(offset>100000)throw new Error('Too many statistics records. Narrow the project scope.');
  }
 }
 return rows;
}
export async function loadTrainingStatsData(db,projects){
 if(!projects.length)return {quick:[],registered:[],tools:[]};
 const [quick,registered,tools]=await Promise.all([
  fetchAll(db,'quick_safety_orientations','id,project_id,created_by,employee_name,employee_company,sticker_number,orientation_at,created_at,status',projects),
  fetchAll(db,'safety_orientations','id,project_id,created_by,employee_name,employee_company,sticker_number,orientation_date,created_at',projects),
  fetchAll(db,'safety_tool_records','id,project_id,created_by,kind,report_number,payload,created_at',projects,true)
 ]);
 return {quick,registered,tools};
}
const makeEl=(tag,cls='',txt='')=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt)e.textContent=txt;return e};
export function mountReportCenterTrainingStatistics({db,root,projects,currentProjectId,tr,isCurrent,onOpen}){
 if(!root)return;
 const accessible=(projects||[]).filter(p=>p?.id),ids=accessible.map(p=>p.id);
 root.className='ge-training-stats';
 root.innerHTML='<div class="ge-stats-heading"><div><small>G&E · SAFETY DEPARTMENT</small><h2>'+esc(tr('Safety Personnel & Training Statistics','Estadísticas de personal y capacitación'))+'</h2><p>'+esc(tr('Registered orientations, Toolbox Talks and G&E training, based on saved records.','Orientaciones, charlas y entrenamientos G&E basados en registros guardados.'))+'</p></div><button type="button" class="ge-stats-refresh">'+esc(tr('Refresh','Actualizar'))+'</button></div><div class="ge-stats-controls"><label>'+esc(tr('Project','Proyecto'))+' <select class="ge-stats-project"></select></label><label>'+esc(tr('Period','Período'))+' <select class="ge-stats-period"><option value="all">'+esc(tr('All dates','Todas las fechas'))+'</option><option value="today">'+esc(tr('Today','Hoy'))+'</option><option value="7d">'+esc(tr('Last 7 days','Últimos 7 días'))+'</option><option value="30d">'+esc(tr('Last 30 days','Últimos 30 días'))+'</option><option value="year">'+esc(tr('This year','Este año'))+'</option></select></label></div><div class="ge-stats-status" role="status" aria-live="polite"></div><div class="ge-stats-grid"></div><div class="ge-stats-summary"></div><div class="ge-stats-detail" hidden></div>';
 const projectSelect=root.querySelector('.ge-stats-project'),periodSelect=root.querySelector('.ge-stats-period');
 projectSelect.append(new Option(tr('All accessible projects','Todos los proyectos accesibles'),'all'));
 for(const project of accessible)projectSelect.append(new Option(project.name||'Project',project.id));
 projectSelect.value=ids.includes(currentProjectId)?currentProjectId:'all';
 const grid=root.querySelector('.ge-stats-grid'),summary=root.querySelector('.ge-stats-summary'),detail=root.querySelector('.ge-stats-detail'),status=root.querySelector('.ge-stats-status'),refresh=root.querySelector('.ge-stats-refresh');
 let cache=null,loading=false,selected=null;
 const labels=new Map(accessible.map(p=>[p.id,p.name||'Project']));
 const active=()=>root.isConnected&&(!isCurrent||isCurrent());
 function card(cat,group){
  const button=makeEl('button','ge-stats-card');button.type='button';button.dataset.kind=cat.id;button.setAttribute('aria-pressed',String(selected===cat.id));
  button.innerHTML='<span class="ge-stats-card-icon">'+cat.icon+'</span><span class="ge-stats-card-title">'+esc(tr(cat.en,cat.es))+'</span><strong>'+group.length+'</strong><small>'+esc(tr(cat.unitEn,cat.unitEs))+'</small>';
  if(cat.id==='toolbox'||cat.id==='training')button.innerHTML+='<span class="ge-stats-card-attendance">'+group.reduce((n,r)=>n+r.attendees,0)+' '+esc(tr('named attendees','asistencias con nombre'))+'</span>';
  button.addEventListener('click',()=>{selected=selected===cat.id?null:cat.id;draw()});
  return button;
 }
 function draw(){
  if(!cache||!active())return;
  const s=summarizeTrainingStats(cache,{project:projectSelect.value,period:periodSelect.value});
  grid.replaceChildren(...TRAINING_STATS_CATEGORIES.map(cat=>card(cat,s.groups[cat.id])));
  summary.textContent=tr('Orientation registrations: ','Registros de orientación: ')+s.orientationRecords+' · '+tr('Non-duplicated registration IDs: ','Identificadores de registro sin duplicar: ')+s.nonDuplicatedRegistrations+' · '+tr('Named Toolbox/Training attendances: ','Asistencias con nombre en charlas/entrenamientos: ')+s.attendance;
  const note=makeEl('small','ge-stats-footnote',tr('Distinct orientation registrations are merged only when their sticker numbers match. Records without matching identifiers may represent the same person. Free-text attendance estimates are not counted.','Los registros de orientación solo se unifican cuando coincide el número de sticker. Sin un identificador coincidente, una persona podría aparecer más de una vez. Las estimaciones de asistentes escritas como texto no se contabilizan.'));
  summary.append(note);
  detail.replaceChildren();
  detail.hidden=!selected;
  if(!selected)return;
  const category=TRAINING_STATS_CATEGORIES.find(c=>c.id===selected),items=s.groups[selected];
  const heading=makeEl('h3','',tr(category.en,category.es)+' · '+items.length);
  detail.append(heading);
  if(!items.length){detail.append(makeEl('p','ge-stats-empty',tr('No records for these filters.','No hay registros con estos filtros.')));return}
  const table=makeEl('div','ge-stats-detail-list');
  for(const row of items){
   const entry=makeEl('div','ge-stats-detail-row'),meta=makeEl('div','ge-stats-record-meta');
   const main=makeEl('strong','',row.name||row.report_number||tr('Saved record','Registro guardado'));
   const sub=makeEl('small','',displayDate(row.date)+' · '+(labels.get(row.project_id)||'Project')+(row.company?' · '+row.company:'')+(row.attendees!==null?' · '+row.attendees+' '+tr('named attendees','asistencias con nombre'):'')+(row.detail?' · '+String(row.detail).slice(0,120):''));
   meta.append(main,sub);entry.append(meta);
   if(typeof onOpen==='function'&&row.project_id===currentProjectId){
    const button=makeEl('button','ge-stats-view',tr('View report','Ver reporte'));button.type='button';
    button.addEventListener('click',()=>{if(active())onOpen(row)});entry.append(button)
   }
   table.append(entry)
  }
  detail.append(table)
 }
 async function load(){
  if(loading||!active())return;loading=true;refresh.disabled=true;
  status.textContent=tr('Loading verified statistics…','Cargando estadísticas verificadas…');
  try{
   const data=await loadTrainingStatsData(db,ids);
   if(!active())return;
   cache=data;status.textContent=tr('Updated from saved records.','Actualizado desde los registros guardados.');draw()
  }catch(e){
   if(!active())return;
   status.textContent=tr('Statistics unavailable: ','Estadísticas no disponibles: ')+e.message;
   grid.replaceChildren();summary.replaceChildren();detail.hidden=true;
  }finally{loading=false;if(active())refresh.disabled=false}
 }
 projectSelect.addEventListener('change',draw);periodSelect.addEventListener('change',draw);refresh.addEventListener('click',load);
 void load();
}
