const safetyTrendTotal=entries=>Object.values(entries||{}).reduce((total,x)=>total+(Number(x?.count)||0),0);
const safetyTrendDelta=(current,previous)=>current-previous;

// Standalone, vector-based letter PDF: small memory footprint on iPad and sharp text.
// The PDF uses ONLY a saved analysis snapshot. Generating it does not invoke AI,
// read employee data, modify reports, or create a second scheduled analysis.
const PALETTE={ink:[35,42,49],muted:[93,105,116],rule:[208,214,221],paper:[246,247,248],dark:[55,63,72],white:[255,255,255]};
const number=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
const clean=(x,limit=1000)=>String(x??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,limit);
const getDate=x=>{const d=new Date(x);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(d)};
export const safetyPdfFilename=(project,run)=>{
 const slug=clean(project,100).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,48)||'Project';
 const date=/^\d{4}-\d{2}-\d{2}/.exec(String(run?.period_end||''))?.[0]||'Report';
 return 'GE-Safety-Intelligence-'+slug+'-'+(run?.cadence==='monthly'?'Monthly':'Weekly')+'-'+date+'.pdf';
};
export function safetyReportSnapshot(run,project){
 const m=run?.metrics||{},current=m.current||{},previous=m.previous||{};
 const total=safetyTrendTotal(current),prior=safetyTrendTotal(previous);
 const breakdown=[
  ['Safety observations / Observaciones','observations'],
  ['Daily Safety Walks / Recorridos diarios','daily_reports'],
  ['Incidents & Near Misses / Incidentes','incidents'],
  ['Equipment inspections / Equipos','equipment_inspections'],
  ['Disciplinary records / Disciplina','disciplinary_actions'],
  ['Safety tools / Herramientas de Safety','safety_tools']
 ].map(([label,key])=>({label,key,current:number(current[key]?.count),previous:number(previous[key]?.count)}));
 return {
  project:clean(project,160)||'Unspecified project / Proyecto no especificado',
  cadence:run?.cadence==='monthly'?'monthly':'weekly',
  periodStart:run?.period_start,periodEnd:run?.period_end,computedAt:run?.computed_at,
  total,prior,change:safetyTrendDelta(total,prior),
  openObservations:Number.isFinite(Number(m.open_observations_now))?number(m.open_observations_now):null,
  highPriority:number(current.observations?.high),
  closedObservations:number(current.observations?.closed),
  unsafeWalks:number(current.daily_reports?.unsafe),
  equipmentDefects:number(current.equipment_inspections?.defects),
  categories:Array.isArray(current.observations?.categories)?current.observations.categories.slice(0,8).map(x=>({label:clean(x.label,90),count:number(x.count)})):[],
  breakdown,
  insights:run?.ai_status==='complete'&&Array.isArray(run?.insights)?run.insights.slice(0,3).filter(x=>x&&typeof x==='object').map(x=>({title:clean(x.title,140),summary:clean(x.summary,450),question:clean(x.question,300)})):[],
  aiStatus:clean(run?.ai_status,25),sampleLimited:!!m.limited,
  periodDays:number(m.period_days)||(run?.cadence==='monthly'?30:7)
 };
}
let brandImagePromise;
async function brandImage(){
 if(!brandImagePromise)brandImagePromise=(async()=>{
  // Same-origin original asset; preserve aspect ratio instead of distorting logo.
  const r=await fetch('/ge-logo.png',{cache:'force-cache'});
  if(!r.ok)throw new Error('logo unavailable');
  const data=await r.blob();
  const uri=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(data)});
  const dimensions=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve({w:img.naturalWidth,h:img.naturalHeight});img.onerror=reject;img.src=uri});
  return {uri,...dimensions};
 })().catch(()=>null);
 return brandImagePromise;
}
export async function createSafetyIntelligencePdf(run,projectName){
 if(!run?.period_end||!run?.metrics?.current)throw new Error('Análisis incompleto: no se puede generar el PDF.');
 const {jsPDF}=await import('jspdf');
 const doc=new jsPDF({orientation:'portrait',unit:'pt',format:'letter',compress:true,putOnlyUsedFonts:true});
 const model=safetyReportSnapshot(run,projectName);
 const W=612,H=792,M=43,CW=W-2*M,BOTTOM=H-55;
 const logo=await brandImage();
 let y=0,section=0;
 const fill=(c)=>doc.setFillColor(...c),stroke=(c)=>doc.setDrawColor(...c),color=c=>doc.setTextColor(...c);
 const text=(value,x,yy,size=10,bold=false,c=PALETTE.ink)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);color(c);doc.text(clean(value),x,yy)};
 const rule=(yy)=>{stroke(PALETTE.rule);doc.setLineWidth(.65);doc.line(M,yy,W-M,yy)};
 const safeLines=(value,width,size)=>{doc.setFont('helvetica','normal');doc.setFontSize(size);return doc.splitTextToSize(clean(value,1300)||'—',width)};
 const banner=(continued=false)=>{
  fill(PALETTE.dark);doc.rect(0,0,W,8,'F');
  if(logo){const maxWidth=96,maxHeight=53,scale=Math.min(maxWidth/logo.w,maxHeight/logo.h);doc.addImage(logo.uri,'PNG',M,21,logo.w*scale,logo.h*scale)}
  else{text('G&E',M,53,25,true)}
  text('G&E FLORIDA CONTRACTORS',155,38,11,true);
  text('SAFETY DEPARTMENT  |  By G&E',155,54,8,false,PALETTE.muted);
  rule(84);
  text(continued?'SAFETY INTELLIGENCE - CONTINUED / CONTINUACIÓN':'SAFETY INTELLIGENCE  /  INTELIGENCIA DE SEGURIDAD',M,105,12,true);
  text(continued?model.project:'PERIODIC PROJECT ANALYSIS  /  INFORME PERIÓDICO POR PROYECTO',M,123,8,false,PALETTE.muted);
  y=continued?148:143;
 };
 const watermark=()=>{
  if(!logo)return;
  try{
   const gs=new doc.GState({opacity:.06});
   doc.saveGraphicsState();doc.setGState(gs);
   const w=290,h=w*logo.h/logo.w;
   doc.addImage(logo.uri,'PNG',(W-w)/2,(H-h)/2,w,h);
   doc.restoreGraphicsState();
  }catch{/* Never block a professional report if the device lacks watermark support. */}
 };
 const page=(continued=false)=>{if(continued)doc.addPage();banner(continued);watermark()};
 const need=h=>{if(y+h>BOTTOM){page(true)}};
 const heading=(label)=>{
  need(40);y+=9;text(String(++section).padStart(2,'0')+'  '+label,M,y+10,10.5,true);
  y+=19;rule(y);y+=13;
 };
 const paragraph=(v,size=9.1,indent=0)=>{
  const width=CW-indent-3,lines=safeLines(v,width,size),lineH=size*1.46;
  for(let i=0;i<lines.length;i++){
   need(lineH+4);
   text(lines[i],M+indent,y+lineH-2,size,false);
   y+=lineH;
  }
  y+=4;
 };
 const box=(x,yy,w,h,label,value,sub)=>{
  fill(PALETTE.paper);doc.roundedRect(x,yy,w,h,5,5,'F');
  text(label,x+11,yy+15,7.9,true,PALETTE.muted);
  text(value,x+11,yy+41,21,true);
  if(sub)text(sub,x+11,yy+h-11,7.2,false,PALETTE.muted);
 };
 const infoLine=(label,value)=>{
  need(23);
  text(label,M,y+10,8.5,true,PALETTE.muted);
  const l=safeLines(value,330,9);
  for(let i=0;i<l.length;i++){if(i)need(16);text(l[i],M+180,y+10,9, i===0);y+=i?14:0}
  y+=23;
 };
 page();
 // Cover metadata block uses consistent neutral greys and a protected source timestamp.
 fill(PALETTE.paper);doc.roundedRect(M,y,CW,87,6,6,'F');
 text('PROJECT / PROYECTO',M+12,y+17,8,true,PALETTE.muted);
 const pn=safeLines(model.project,CW-24,15).slice(0,2);
 pn.forEach((line,i)=>text(line,M+12,y+38+i*18,15,true));
 text('PERIOD / PERÍODO',M+12,y+75,7.5,true,PALETTE.muted);
 text(getDate(model.periodStart)+'  –  '+getDate(model.periodEnd),M+104,y+75,9,true);
 y+=102;
 const cadence=model.cadence==='monthly'?'MONTHLY / MENSUAL':'WEEKLY / SEMANAL';
 infoLine('REPORT TYPE / TIPO',cadence+' · '+model.periodDays+' days / días');
 infoLine('ANALYSIS GENERATED / FECHA',getDate(model.computedAt));
 heading('EXECUTIVE SUMMARY  /  RESUMEN EJECUTIVO');
 need(91);
 const gap=9,cw=(CW-gap*3)/4;
 box(M,y,cw,79,'RECORDS / REGISTROS',String(model.total),'Prior / Antes: '+model.prior);
 box(M+cw+gap,y,cw,79,'CHANGE / CAMBIO',(model.change>0?'+':'')+model.change,'vs previous / anterior');
 box(M+(cw+gap)*2,y,cw,79,'OPEN / ABIERTAS',model.openObservations===null?'—':String(model.openObservations),'Observation cases');
 box(M+(cw+gap)*3,y,cw,79,'INCIDENTS',String(model.breakdown.find(x=>x.key==='incidents')?.current||0),'Includes Near Miss');
 y+=92;
 paragraph('Scope / Alcance: aggregate safety records registered during the selected period. The prior period covers the same number of days. Counts represent documented activity, not incident rates, exposure, safety performance scores, or OSHA compliance.',8.5);
 heading('REPORT COVERAGE  /  REGISTROS ANALIZADOS');
 need(35);
 fill(PALETTE.dark);doc.rect(M,y,CW,25,'F');
 text('SOURCE / FUENTE',M+9,y+16,8,true,PALETTE.white);
 text('CURRENT',M+CW-102,y+16,8,true,PALETTE.white);
 text('PREVIOUS',M+CW-46,y+16,8,true,PALETTE.white);
 y+=25;
 model.breakdown.forEach((row,i)=>{
  need(28);if(i%2===0){fill(PALETTE.paper);doc.rect(M,y,CW,27,'F')}
  text(row.label,M+9,y+17,8.25);text(String(row.current),M+CW-95,y+17,9,true);text(String(row.previous),M+CW-43,y+17,9,true);
  y+=27;
 });
 y+=10;
 heading('OBSERVATIONS  /  OBSERVACIONES');
 need(45);
 text('High priority in period / Prioridad alta: '+model.highPriority,M,y+8,9);
 text('Closed at analysis / Cerradas al analizar: '+model.closedObservations,M+260,y+8,9);
 y+=26;
 if(model.categories.length){
  const max=Math.max(...model.categories.map(x=>x.count),1);
  for(const entry of model.categories){
   const lines=safeLines(entry.label,160,8).slice(0,2),rowHeight=Math.max(27,lines.length*12+9);
   need(rowHeight+1);
   lines.forEach((line,i)=>text(line,M+4,y+13+i*12,8));
   const barX=M+170,barWidth=CW-217;
   fill(PALETTE.paper);doc.roundedRect(barX,y+6,barWidth,11,2,2,'F');
   if(entry.count){fill(PALETTE.dark);doc.roundedRect(barX,y+6,Math.max(2,barWidth*(entry.count/max)),11,2,2,'F')}
   text(String(entry.count),M+CW-26,y+15,8.5,true);
   y+=rowHeight;
  }
 }else paragraph('No observation category breakdown available / Sin categorías registradas.',8.5);
 heading('ADDITIONAL INDICATORS  /  INDICADORES');
 need(48);
 paragraph('Daily walks marked unsafe / Recorridos UNSAFE: '+model.unsafeWalks+'    |    Equipment inspections with recorded defects or removed-from-service status / Equipos con hallazgos: '+model.equipmentDefects,8.7);
 heading('AI REVIEW  /  ANÁLISIS DE IA');
 if(model.insights.length){
  for(let idx=0;idx<model.insights.length;idx++){
   const item=model.insights[idx];
   const approx=32+safeLines(item.summary,CW-21,9).length*15+safeLines(item.question,CW-24,8.5).length*15;
   need(Math.min(approx,180));
   fill(PALETTE.paper);doc.rect(M,y,3,23,'F');
   text((idx+1)+'. '+(item.title||'Review finding / Hallazgo'),M+13,y+14,9.5,true);
   y+=23;
   paragraph(item.summary||'No narrative supplied.',9,11);
   need(22);
   text('ACTION TO REVIEW / ACCIÓN A REVISAR',M+11,y+11,8,true,PALETTE.muted);y+=17;
   paragraph(item.question||'Confirm with assigned Safety professional.',8.6,11);
   y+=7;
  }
 }else{
  const notice=model.aiStatus==='insufficient'
    ?'Not enough evidence for a supported trend conclusion. / No existen registros suficientes para una conclusión fundamentada.'
    :'AI narrative was unavailable at the time of this saved analysis. The verified counts above remain valid. / No se generó un resumen de IA para este análisis; los conteos documentados permanecen disponibles.';
  paragraph(notice,9);
 }
 heading('PROFESSIONAL REVIEW  /  VALIDACIÓN');
 paragraph('Review the conclusions against field conditions and source records before taking corrective action. Any action, owner or deadline must be established and verified by the designated Safety representative. This report does not certify jobsite safety or replace regulatory reporting.',8.5);
 if(model.sampleLimited)paragraph('DATA LIMIT / LÍMITE: Some source breakdowns used only the first 1,000 records. Totals may exceed those detailed samples.',8.3);
 const pages=doc.getNumberOfPages();
 for(let p=1;p<=pages;p++){
  doc.setPage(p);rule(H-46);
  text('G&E ONE  ·  SAFETY DEPARTMENT  ·  By G&E',M,H-31,7.8,true,PALETTE.muted);
  text('INFORMATIONAL / INFORMATIVO  ·  '+p+' / '+pages,W-M,H-31,7.3,false,PALETTE.muted);
 }
 doc.setProperties({title:'G&E Safety Intelligence - '+model.project,subject:'Project safety analysis - aggregated records',author:'G&E Florida Contractors',creator:'G&E ONE Safety Department'});
 return doc.output('blob');
}
