import {mountReportSignatures,reportApprovals,reportSignaturesReport,restoreReportSignatures} from './report-signatures.js';
export async function attachAggregateSignatures({report,kind,snapshot,db,state,tr,isCurrent,enableAutoDraft,clearDraft,confirmAction,error}){
 if(!report||!isCurrent())return;
 const slot=report.querySelector('[data-aggregate-signatures]');if(!slot)return;report.dataset.loading='true';
 try{
 const owner={project:state.project,user:state.profile.id};
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(snapshot)));
 const snapshotKey=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
 if(!isCurrent()||!report.isConnected)return;
 const read=await db.from('aggregate_report_signatures').select('approvals').eq('project_id',owner.project).eq('created_by',owner.user).eq('report_kind',kind).eq('snapshot_key',snapshotKey).maybeSingle();
 if(!isCurrent()||!report.isConnected)return;if(read.error)throw read.error
 slot.innerHTML=reportSignaturesReport(kind,read.data?.approvals,tr);report.dataset.loading='false';
 if(!['admin','safety_director','safety','supervisor'].includes(state.profile.role))return;
 const panel=document.createElement('section');panel.className='card no-print aggregate-signature-editor';
 panel.innerHTML=`<h2>${tr('Report names and digital signatures','Nombres y firmas digitales del reporte')}</h2><form><button type="submit">${tr('Save report signatures','Guardar firmas del reporte')}</button></form>`;
 report.insertAdjacentElement('beforebegin',panel);const form=panel.querySelector('form');mountReportSignatures(form,kind,tr);restoreReportSignatures(form,kind,read.data?.approvals);
 const draftType='aggregate_'+kind;await enableAutoDraft(form,draftType,snapshotKey);if(!isCurrent())return;
 form.onsubmit=async e=>{e.preventDefault();if(form.dataset.submitting==='true')return;
  form.dataset.submitting='true';const button=form.querySelector('button[type="submit"]');button.disabled=true;form.inert=true;
  try{
   const approvals=reportApprovals(kind,new FormData(form));
   const saved=await db.from('aggregate_report_signatures').upsert({project_id:owner.project,created_by:owner.user,report_kind:kind,snapshot_key:snapshotKey,approvals,updated_at:new Date().toISOString()},{onConflict:'project_id,created_by,report_kind,snapshot_key'});
   if(saved.error)throw saved.error;
   if(isCurrent()&&report.isConnected)slot.innerHTML=reportSignaturesReport(kind,approvals,tr);
   await clearDraft(draftType,snapshotKey,form).catch(()=>{});
   // Keep autosave available if names or signatures are edited again.
   form.dataset.autoDraft='true';confirmAction(tr('Report signatures saved.','Firmas del reporte guardadas.'));
  }catch(e){error(e)}finally{delete form.dataset.submitting;button.disabled=false;form.inert=false}
 };
 }catch(e){if(isCurrent()&&report.isConnected){report.dataset.loading='error';error(e)}}
}

