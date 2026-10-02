import {jhaSignatureFields,attachJhaSignatures,jhaSignaturesReport,signatureStrokes} from './jha-signatures.js';
const parse=value=>{try{const rows=typeof value==='string'?JSON.parse(value||'[]'):value;return Array.isArray(rows)?rows.slice(0,100).map(r=>({name:String(r?.name||'').slice(0,160),strokes:signatureStrokes(r?.strokes)})):[]}catch{return []}};
export function attendanceApprovals(data){
 const rows=parse(data.get('attendance_signatures'));
 return rows.map((row,i)=>({name:String(data.get(`jha_participant_${i}_name`)??row.name).slice(0,160),strokes:signatureStrokes(data.get(`jha_participant_${i}_signature`)??row.strokes)}));
}
export function mountAttendance(form,tr){
 const submit=form.querySelector('button[type="submit"]'),section=document.createElement('section');section.className='report-attendance';
 section.innerHTML=`<h3>${tr('Participant signatures','Firmas de los participantes')}</h3><input type="hidden" name="attendance_signatures" value="[]"><div data-attendance-rows></div><button type="button" class="secondary" data-add-participant>${tr('Add participant','Agregar participante')}</button>`;
 submit.before(section);const hidden=form.elements.attendance_signatures,box=section.querySelector('[data-attendance-rows]'),add=section.querySelector('[data-add-participant]');
 let rows=[];
 const update=()=>{rows=attendanceApprovals(new FormData(form));hidden.value=JSON.stringify(rows)};
 const render=()=>{box.innerHTML=rows.map((_,i)=>jhaSignatureFields(tr,[`participant_${i}`],()=>tr('Participant','Participante')+' '+(i+1))).join('');attachJhaSignatures(form,rows.map((_,i)=>`participant_${i}`));rows.forEach((r,i)=>{form.elements[`jha_participant_${i}_name`].value=r.name;const field=form.elements[`jha_participant_${i}_signature`];field.value=JSON.stringify(r.strokes);field.dispatchEvent(new Event('change',{bubbles:true}))});add.disabled=rows.length>=100};
 add.onclick=()=>{update();if(rows.length>=100)return;rows.push({name:'',strokes:[]});hidden.value=JSON.stringify(rows);render();hidden.dispatchEvent(new Event('input',{bubbles:true}))};
 form.addEventListener('input',e=>{if(e.target?.name?.startsWith('jha_participant_'))update()});
 hidden.addEventListener('change',()=>{rows=parse(hidden.value);render()});
}
export function attendanceReport(rows,tr){
 const records=parse(rows),roles=records.map((_,i)=>`participant_${i}`),approvals=Object.fromEntries(roles.map((role,i)=>[role,records[i]]));
 return jhaSignaturesReport(approvals,tr,roles,()=>tr('Participant','Participante')).replace('ewr-signatures jha-signed-approvals','report-signatures report-attendance-signatures jha-signed-approvals');
}
