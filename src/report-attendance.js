import {jhaSignatureFields,attachJhaSignatures,jhaSignaturesReport,signatureStrokes} from './jha-signatures.js';
const parse=value=>{try{const rows=typeof value==='string'?JSON.parse(value||'[]'):value;return Array.isArray(rows)?rows.slice(0,100).map(r=>({name:String(r?.name||'').slice(0,160),strokes:signatureStrokes(r?.strokes)})):[]}catch{return []}};
export function attendanceApprovals(data){
 const rows=parse(data.get('attendance_signatures'));
 return rows.map((row,i)=>({name:String(data.get(`jha_participant_${i}_name`)??row.name).slice(0,160),strokes:signatureStrokes(data.get(`jha_participant_${i}_signature`)??row.strokes)}));
}
export function mountAttendance(form,tr,{quick=false}={}){
 const doc=form.ownerDocument,win=doc.defaultView;
 const submit=form.querySelector('button[type="submit"]'),section=doc.createElement('section');section.className='report-attendance';
 section.innerHTML=`<h3>${tr('Participant signatures','Firmas de los participantes')}</h3>${quick?'<p data-attendance-status role="status"></p>':''}<input type="hidden" name="attendance_signatures" value="[]"><div data-attendance-rows></div><button type="button" class="secondary" data-add-participant>${tr('Add participant','Agregar participante')}</button>`;
 submit.before(section);const hidden=form.elements.attendance_signatures,box=section.querySelector('[data-attendance-rows]'),add=section.querySelector('[data-add-participant]');
 const status=section.querySelector('[data-attendance-status]');
 let rows=[];
 const refreshStatus=()=>{
  if(!status)return;
  const signed=rows.filter(row=>row.name.trim()&&row.strokes.length).length;
  status.textContent=tr(`${signed} of ${rows.length} participants signed`,`${signed} de ${rows.length} participantes firmaron`);
 };
 const update=()=>{rows=attendanceApprovals(new win.FormData(form));hidden.value=JSON.stringify(rows);refreshStatus()};
 const appendRow=(row,i)=>{
  const role=`participant_${i}`;
  box.insertAdjacentHTML('beforeend',jhaSignatureFields(tr,[role],()=>tr('Participant','Participante')+' '+(i+1)));
  const name=form.elements[`jha_${role}_name`],signature=form.elements[`jha_${role}_signature`];
  name.value=row.name;
  signature.value=JSON.stringify(row.strokes);
  attachJhaSignatures(form,[role]);
  return name;
 };
 const render=()=>{box.replaceChildren();rows.forEach(appendRow);add.disabled=rows.length>=100;refreshStatus()};
 add.onclick=()=>{
  update();if(rows.length>=100)return;
  const row={name:'',strokes:[]};
  const index=rows.push(row)-1;
  const name=appendRow(row,index);
  hidden.value=JSON.stringify(rows);
  refreshStatus();
  add.disabled=rows.length>=100;
  hidden.dispatchEvent(new win.Event('input',{bubbles:true}));
  if(quick)name.focus();
 };
 form.addEventListener('input',e=>{if(e.target?.name?.startsWith('jha_participant_'))update()});
 hidden.addEventListener('change',()=>{rows=parse(hidden.value);render()});
 refreshStatus();
}
export function attendanceReport(rows,tr){
 const records=parse(rows),roles=records.map((_,i)=>`participant_${i}`),approvals=Object.fromEntries(roles.map((role,i)=>[role,records[i]]));
 return jhaSignaturesReport(approvals,tr,roles,()=>tr('Participant','Participante')).replace('ewr-signatures jha-signed-approvals','report-signatures report-attendance-signatures jha-signed-approvals');
}
