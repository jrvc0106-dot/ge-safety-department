import {isValidPdfBlob} from './report-pdf-quality.js';
import {reportExportFilename} from './report-export-filename.js';

// This path opens the already-finalized document; it never reconstructs a
// report, uploads a new revision, or changes source signatures/photos.
const VALID_TYPES=new Set(['daily_safety_walk','disciplinary_action','observation','incident','near_miss','equipment_inspection']);
export function indexFinalPdfDocuments(rows,projectId){
 const byRecord=new Map();
 for(const entry of rows||[]){
  if(!entry||!VALID_TYPES.has(entry.report_type)||entry.document_status!=='final'||
    !entry.pdf_path||!entry.source_id||entry.project_id!==projectId)continue;
  const key=entry.report_type+':'+entry.source_id,prior=byRecord.get(key);
  if(!prior||Number(entry.version)>Number(prior.version)||
    (Number(entry.version)===Number(prior.version)&&
      String(entry.created_at||'')>String(prior.created_at||'')))byRecord.set(key,entry);
 }
 return byRecord;
}

export function archivedPdfFilename(entry){
 return reportExportFilename({
  title:entry?.title,
  reportType:entry?.report_type,
  equipmentType:entry?.report_type==='equipment_inspection'?entry?.title:undefined,
  originalDate:entry?.original_report_date||entry?.snapshot?.original_report_date||
   entry?.inspection_at||entry?.incident_at||entry?.orientation_date||entry?.created_at
 });
}

// Creates a short-lived signed link and inspects file size in parallel.
// The browser streams the signed PDF directly, avoiding html2canvas,
// re-encoding, temporary full-resolution images, and JS Blob memory.
export async function archivedPdfLink(storage,entry,{download=false,fallback=null}={}){
 if(!entry?.pdf_path||entry.document_status!=='final'||!VALID_TYPES.has(entry.report_type))throw Error('A finalized PDF is not available for this report.');
 const file=storage.from('final-reports');
 const tasks=[
  file.createSignedUrl(entry.pdf_path,180,download?{download:archivedPdfFilename(entry)}:undefined),
  typeof file.info==='function'?file.info(entry.pdf_path):Promise.resolve(null)
 ];
 try{
  const [signed,metadata]=await Promise.all(tasks);
  if(metadata?.error)throw metadata.error;
  const size=metadata?.data?.size;
  if(size!==undefined&&size!==null&&(!Number.isFinite(Number(size))||Number(size)<32))
   throw Error('The archived PDF is empty or damaged. Open the report instead to inspect its evidence.');
  if(signed?.error)throw signed.error;
  const address=signed?.data?.signedUrl;
  if(!address)throw Error('A secure PDF link could not be created.');
  const url=new URL(address);
  if(url.protocol!=='https:')throw Error('The PDF link is not secure.');
  return url.href;
 }catch(originalError){
  if(typeof fallback!=='function')throw originalError;
  // A deleted GE ONE PDF is available from Dropbox only after authenticated retrieval.
  const remote=await fallback(entry);
  const url=new URL(remote);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.dropboxusercontent.com'))
   throw Error('The secure Dropbox archive link was invalid.');
  return url.href;
 }
}

export async function openArchivedPdf(storage,entry,{win=window,isCurrent=()=>true,fallback=null}={}){
 // Must reserve the viewer in the original click, before awaiting a network request.
 let viewer;
 try{viewer=win.open?.('about:blank','_blank');if(viewer)viewer.opener=null}catch{}
 try{
  const link=await archivedPdfLink(storage,entry,{fallback});
  if(!isCurrent())throw Error('The active report/project changed while preparing the PDF.');
  if(viewer&&!viewer.closed)viewer.location.href=link;
  else win.location.assign(link); // Popup blockers: show the original PDF in this tab.
  return true;
 }catch(error){
  if(viewer&&!viewer.closed)viewer.close?.();
  throw error;
 }
}

export async function downloadArchivedPdf(storage,entry,{doc=document,isCurrent=()=>true,fallback=null}={}){
 const link=await archivedPdfLink(storage,entry,{download:true,fallback});
 if(!isCurrent())throw Error('The active report/project changed while preparing the PDF.');
 const a=doc.createElement('a');
 a.href=link;a.rel='noopener noreferrer';a.download=archivedPdfFilename(entry);
 a.style.display='none';doc.body.appendChild(a);
 try{a.click()}finally{a.remove()}
 return true;
}

// File-level inspection is intentionally separate from the fast streaming
// path. It is useful for an integrity check without creating a new revision.
export async function inspectArchivedPdf(storage,entry){
 if(!entry?.pdf_path)throw Error('PDF path unavailable');
 const downloaded=await storage.from('final-reports').download(entry.pdf_path);
 if(downloaded.error)throw downloaded.error;
 return {valid:await isValidPdfBlob(downloaded.data),bytes:downloaded.data?.size||0};
}
