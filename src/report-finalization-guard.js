import {signatureStrokes} from './jha-signatures.js';
import {REPORT_SIGNATURE_ROLES} from './report-signatures.js';

// Pure validation helper. Draft saving and PDF rendering remain untouched.
export function missingRequiredSignatures(form,kind){
 const roles=REPORT_SIGNATURE_ROLES[kind]||[];
 return roles.filter(role=>{
  if(role==='receiver')return false; // Receipt is optional.
  const name=form.elements.namedItem('jha_'+role+'_name');
  const signature=form.elements.namedItem('jha_'+role+'_signature');
  return !name||!String(name.value||'').trim()||!signature||!signatureStrokes(signature.value).length;
 });
}
export function guardReportFinalization(form,kind,tr){
 if(!form||form.dataset.finalizationGuard==='true')return;
 form.dataset.finalizationGuard='true';
 form.addEventListener('submit',event=>{
  const submitter=event.submitter;
  if(submitter?.dataset?.action==='draft'||submitter?.dataset?.saveDraft==='true')return;
  const missing=missingRequiredSignatures(form,kind);
  if(!missing.length)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  let notice=form.querySelector('[data-signature-finalization-warning]');
  if(!notice){notice=form.ownerDocument.createElement('div');notice.dataset.signatureFinalizationWarning='true';notice.setAttribute('role','alert');notice.style.cssText='padding:14px;border:2px solid #b42318;border-radius:10px;background:#fff5f4;color:#7a271a;font-weight:700;margin:12px 0';form.prepend(notice)}
  notice.textContent=tr('This report cannot be finalized until all required names and digital signatures are completed.','Este reporte no se puede finalizar hasta que estén completos los nombres y las firmas digitales obligatorias.');
  notice.scrollIntoView?.({block:'center',behavior:'smooth'});
 },true);
}
