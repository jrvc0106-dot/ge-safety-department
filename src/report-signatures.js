import {jhaSignatureFields,attachJhaSignatures,jhaApprovals,jhaSignaturesReport} from './jha-signatures.js';
const labels={safety:['Assigned Safety','Safety asignado'],foreman:['Responsible Foreman / Supervisor','Foreman / Supervisor responsable'],superintendent:['Jobsite Superintendent','Superintendente del jobsite'],employee:['Employee / involved person','Trabajador / persona involucrada'],receiver:['Delivered / received by (if applicable)','Entregado / recibido por (si corresponde)'],director:['Safety Director','Director de Safety']};
export const REPORT_SIGNATURE_ROLES={observation:['safety','foreman'],correction:['safety','foreman'],incident:['safety','foreman','superintendent'],discipline:['safety','employee','foreman'],equipment:['safety','foreman'],inventory:['safety','receiver'],orientation:['safety','employee'],daily:['safety','superintendent'],toolbox:['safety','foreman'],training:['safety','foreman'],safety_net:['safety','foreman','superintendent'],emergency:['safety','superintendent'],director:['safety','superintendent'],qr:['safety','employee'],hazard:['safety','foreman']};
const rolesFor=kind=>{const roles=REPORT_SIGNATURE_ROLES[kind];if(!roles)throw Error('Unknown signature report kind');return roles};
const labelFor=kind=>(role,tr)=>{const words=kind==='director'&&role==='safety'?labels.director:labels[role];return tr(...words)};
export function reportApprovals(kind,data){return jhaApprovals(data,rolesFor(kind==='qr'&&data.get('lookup_type')==='equipment'?'equipment':kind))}
export function reportSignatureFields(kind,tr){return jhaSignatureFields(tr,kind==='qr'?['safety','employee','foreman']:rolesFor(kind),labelFor(kind))}
export function toggleQrSignatures(form,type){
 for(const role of ['employee','foreman']){const section=form.querySelector(`[data-jha-signature="${role}"]`)?.closest('section');if(!section)continue;const active=role===(type==='equipment'?'foreman':'employee');section.hidden=!active;section.querySelectorAll('input,button').forEach(el=>el.disabled=!active)}
}
export function mountReportSignatures(form,kind,tr){
 if(!form||form.querySelector('.jha-approval-fields'))return;
 const submit=form.querySelector('button[type="submit"]');if(!submit)return;
 submit.insertAdjacentHTML('beforebegin',reportSignatureFields(kind,tr));attachJhaSignatures(form,kind==='qr'?['safety','employee','foreman']:rolesFor(kind));if(kind==='qr')toggleQrSignatures(form,'employee');
}
export function restoreReportSignatures(form,kind,approvals){
 for(const role of rolesFor(kind))for(const [suffix,value] of [['name',approvals?.[role]?.name||''],['signature',JSON.stringify(approvals?.[role]?.strokes||[])]]){
  const field=form.elements.namedItem(`jha_${role}_${suffix}`);if(!field)continue;field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));
 }
}
export function reportSignaturesReport(kind,approvals,tr){
 if(kind==='qr'&&approvals?.foreman&&!approvals?.employee)kind='equipment';
 return jhaSignaturesReport(approvals,tr,rolesFor(kind),labelFor(kind)).replace('ewr-signatures jha-signed-approvals','report-signatures jha-signed-approvals');
}
