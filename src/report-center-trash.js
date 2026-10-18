/**
 * Report Center removal is a document-index operation, not source-data deletion.
 * Report source rows, photographs and PDF originals are never modified here.
 */
export const REPORT_CENTER_KINDS=new Set(['daily','walk','discipline','correction','observation','incident','equipment','inventory','document']);
export const reportCenterKey=(kind,id)=>String(kind)+'|'+String(id);
export function reportCenterHidden(rows,kind,id){
 const record=rows.find(x=>x.report_kind===kind&&x.report_id===String(id));
 return Boolean(record&&record.state!=='active');
}
export function reportCenterVisible(rows,kind,records,idOf=x=>x.id){
 return records.filter(x=>!reportCenterHidden(rows,kind,idOf(x)));
}
export function reportCenterTrashRows(rows){
 return rows.filter(x=>x.state==='trashed').sort((a,b)=>String(b.deleted_at||'').localeCompare(String(a.deleted_at||'')));
}
export function reportCenterDeleteMessage(title,project,tr){
 return tr('Move the report to the Admin Trash?\n','¿Mover el reporte a la papelera administrativa?\n')+
  '\n'+title+'\n'+project+'\n\n'+
  tr('This removes it from Report Center but preserves the original safety record, evidence and PDFs. Only Admin may restore it.','Esto lo retira del Centro de Reportes, pero conserva el registro original, evidencias y PDFs. Solo Admin podrá restaurarlo.');
}
export function reportCenterPermanentMessage(title,tr){
 return tr('Permanently remove this report from Report Center?','¿Eliminar definitivamente este reporte del Centro de Reportes?')+
  '\n\n'+title+'\n\n'+
  tr('This cannot be undone. Supabase PDF files, report records and their own evidence will be deleted. Linked medical or safety records may block deletion. Admin audit logs and separate backups may remain.','Esta acción es irreversible. Se eliminarán de Supabase los PDFs, los registros del reporte y sus evidencias propias. Las vinculaciones médicas o de seguridad pueden bloquear la eliminación. La auditoría administrativa y respaldos separados pueden permanecer.');
}
/**
 * Confirm twice before an irreversible removal. Run synchronously from the
 * user's button click; cancel/mismatched confirmation never touches Supabase.
 */
export function confirmPermanentReportDeletion(win,{title,tr,language='en'}){
 if(!win?.confirm?.(reportCenterPermanentMessage(title,tr)))return false;
 const expected=language==='es'?'ELIMINAR':'DELETE';
 const typed=win.prompt?.(tr(
  'Type DELETE to permanently delete this report from Supabase:',
  'Escriba ELIMINAR para borrar definitivamente este reporte de Supabase:'
 ),'');
 return String(typed||'').trim()===expected;
}

/**
 * Admin Trash is already a deliberate second-stage destination. Confirm once,
 * with the report title and an unmistakable irreversible action; no typed code.
 * The Supabase purge service still independently verifies admin permissions.
 */
export function confirmAdminTrashPermanentDeletion(win,{title,tr}){
 const label=String(title||'Report').trim().slice(0,180);
 return Boolean(win?.confirm?.(tr(
  'Permanently delete this report from Supabase? This cannot be undone.',
  '¿Eliminar definitivamente este reporte de Supabase? No se puede deshacer.'
 )+'\n\n'+label));
}

export async function changeReportCenterTrash(db,{projectId,kind,id,title,action}){
 if(!REPORT_CENTER_KINDS.has(kind)||!projectId||!String(id||'').trim())
  throw new Error('Invalid report center record');
 if(!['trash','restore'].includes(action))throw new Error('Permanent deletion must use the verified Supabase purge service');
 const table=db.from('report_center_trash'),match={project_id:projectId,report_kind:kind,report_id:String(id)};
 let result;
 if(action==='trash'){
  // An already trashed report is ready for purge. Re-upserting it would
  // fail the database's "No state change requested" protection trigger.
  const existing=await db.from('report_center_trash')
   .select('project_id,report_kind,report_id,report_title,state,deleted_at,deleted_by')
   .eq('project_id',projectId).eq('report_kind',kind).eq('report_id',String(id)).maybeSingle();
  if(existing.error)throw existing.error;
  if(existing.data?.state==='trashed')return existing.data;
  if(existing.data?.state==='permanent')throw new Error('This report has already been permanently removed');
  result=await table.upsert({...match,report_title:String(title||'Report').slice(0,240),state:'trashed'},{onConflict:'project_id,report_kind,report_id'}).select('project_id,report_kind,report_id,report_title,state,deleted_at,deleted_by').single();
 }else{
  result=await table.update({state:'active'})
   .eq('project_id',projectId).eq('report_kind',kind).eq('report_id',String(id)).eq('state','trashed')
   .select('project_id,report_kind,report_id,report_title,state,deleted_at,deleted_by').single();
 }
 if(result.error)throw result.error;
 if(!result.data)throw new Error('Report center operation was not confirmed');
 return result.data;
}

export async function permanentlyPurgeReportFromSupabase(db,{projectId,kind,id}){
 if(!REPORT_CENTER_KINDS.has(kind)||!projectId||!String(id||'').trim())
  throw new Error('Invalid report center record');
 if(!db?.functions?.invoke)throw new Error('Secure report removal service is unavailable');
 const result=await db.functions.invoke('purge-report-center',{body:{
  project_id:projectId,report_kind:kind,report_id:String(id)
 }});
 if(result.error){
  let detail;
  try{detail=(await result.error.context?.json?.())?.error}catch{}
  throw new Error(detail||result.error.message||'Secure Supabase deletion failed');
 }
 if(result.data?.error)throw new Error(result.data.error);
 if(!result.data?.ok||result.data?.entry?.state!=='permanent')
  throw new Error('Supabase did not confirm permanent report deletion');
 return result.data;
}
