// Confidential medical PDF archive. Separate from ordinary report_documents and final-reports.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function medicalDropboxPdfPath({projectId,userId,followupId}={}){
 if(![projectId,userId,followupId].every(value=>typeof value==='string'&&uuid.test(value)))
  throw Error('Verified medical PDF identifiers are required.');
 return projectId+'/'+userId+'/'+followupId+'/final.pdf';
}
export async function medicalDropboxStatus(db,{projectId,followupId}){
 const result=await db.functions.invoke('auto-dropbox-reports',{
  body:{action:'enabled',project_id:projectId,followup_id:followupId}
 });
 if(result.error||result.data?.error)throw Error(result.data?.error||result.error?.message||'Medical Dropbox status could not be checked.');
 return {enabled:result.data.enabled===true,queued:result.data.medical_queued===true};
}
export async function queueMedicalDropboxPdf(db,{blob,projectId,userId,followupId}={}){
 if(!(blob instanceof Blob)||blob.size<32||blob.size>40*1024*1024)throw Error('Medical PDF is missing or exceeds 40 MB.');
 const path=medicalDropboxPdfPath({projectId,userId,followupId});
 const saved=await db.storage.from('medical-final-pdfs').upload(path,blob,{
  contentType:'application/pdf',upsert:false,cacheControl:'3600'
 });
 // Existing exact file path is expected after an interrupted queue request.
 // The server independently verifies this object's bytes and authorized record.
 if(saved.error&&!(/^(409|23505)$/.test(String(saved.error.statusCode||saved.error.status||saved.error.code||''))||
  /already exists|duplicate/i.test(String(saved.error.message||''))))
  throw Error('Confidential PDF could not be safely archived: '+String(saved.error.message||'Storage error'));
 const queue=await db.functions.invoke('auto-dropbox-reports',{
  body:{action:'queue_medical',project_id:projectId,followup_id:followupId}
 });
 if(queue.error||queue.data?.error||queue.data?.queued!==true)
  throw Error(queue.data?.error||queue.error?.message||'Confidential PDF could not be queued for Dropbox.');
 return {queued:true,path,alreadyQueued:queue.data.already_queued===true};
}
