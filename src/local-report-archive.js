/**
 * Local PDF archive for an *installed* iPadOS Capacitor app.
 * Never writes PDF bytes to localStorage/IndexedDB or Supabase; only a small
 * per-user index of document references is stored locally.
 * Safari/PWA intentionally has no automatic access to the Files app.
 */
const ROOT='G&E Reports', DIRECTORY='DOCUMENTS', INDEX_PREFIX='ge_local_pdf_links_v1:';
const MAX_PDF_BYTES=30*1024*1024;

const folders={
 daily_report:'Daily Reports',daily_safety_walk:'Daily Report JHA',
 observation:'Safety Observations',disciplinary_action:'Disciplinary Actions',
 incident:'Incidents',near_miss:'Near Miss',equipment_inspection:'Equipment Inspections',
 inventory:'Inventory',training:'Safety Orientations',
 tool_toolbox:'Toolbox Talk',tool_training:'Training',tool_safety_net:'Safety Nets',
 tool_emergency:'Emergency Plans',tool_medical_followup:'Medical Follow Up'
};

function safePart(value,fallback='Other'){
 const v=String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9 _.-]/gi,'-').replace(/\.+/g,'.')
  .replace(/^\.+|[. ]+$/g,'').replace(/\s+/g,' ').slice(0,70).trim();
 return v&&v!=='.'&&v!=='..'?v:fallback;
}
function fingerprintKey(value){
 let hash=2166136261;
 for(const codePoint of String(value||'')){hash^=codePoint.codePointAt(0);hash=Math.imul(hash,16777619)}
 return (hash>>>0).toString(16).padStart(8,'0');
}
function storageFor(env){return env?.localStorage||null}
function getIndex(storage,userId){
 if(!storage||!userId)return [];
 try{
  const parsed=JSON.parse(storage.getItem(INDEX_PREFIX+userId)||'[]');
  return Array.isArray(parsed)?parsed.filter(x=>x&&typeof x.path==='string'&&typeof x.key==='string'):[];
 }catch{return []}
}
function nativePlugin(env){
 const capacitor=env?.Capacitor;
 const ios=(typeof capacitor?.getPlatform==='function'?capacitor.getPlatform():capacitor?.platform)==='ios';
 if(!ios||typeof capacitor?.isNativePlatform==='function'&&!capacitor.isNativePlatform())return null;
 const fs=capacitor?.Plugins?.Filesystem;
 return fs&&typeof fs.mkdir==='function'&&typeof fs.writeFile==='function'&&
  typeof fs.stat==='function'&&typeof fs.getUri==='function'?fs:null;
}
export const nativeReportArchiveAvailable=(env=globalThis)=>Boolean(nativePlugin(env));
export function listLocalReports({userId,projectId,env=globalThis}={}){
 return getIndex(storageFor(env),userId)
  .filter(x=>!projectId||x.projectId===projectId)
  .sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||'')));
}
function readBase64(blob,env){
 return new Promise((resolve,reject)=>{
  const reader=new env.FileReader();
  reader.onerror=()=>reject(reader.error||new Error('PDF conversion failed'));
  reader.onload=()=>{
   const result=String(reader.result||''),comma=result.indexOf(',');
   comma<0?reject(new Error('Invalid PDF encoding')):resolve(result.slice(comma+1))
  };
  reader.readAsDataURL(blob);
 });
}
export async function saveLocalReport({blob,filename,projectId,projectName,reportType,reportNumber,sourceId,userId,fingerprint,env=globalThis}={}){
 const fs=nativePlugin(env);
 if(!fs)throw new Error('A native iPad app with the Filesystem plugin is required');
 if(!blob||blob.type&&blob.type!=='application/pdf'||blob.size<5||blob.size>MAX_PDF_BYTES)
  throw new Error('PDF file missing, invalid or larger than the supported 30 MB');
 if(!userId||!projectId||!reportType)throw new Error('Missing verified user, project or report type');
 const projectDir=safePart(projectName,'Project')+'-'+fingerprintKey(projectId);
 const category=safePart(folders[reportType]||reportType);
 const month=new Date().toISOString().slice(0,7);
 const scopeKey=[projectId,reportType,sourceId||reportNumber||filename].join('|');
 const key=fingerprintKey(scopeKey),fileName=safePart(String(filename||'GE-Report.pdf').replace(/\.pdf$/i,''),'GE-Report')+'-'+key+'.pdf';
 const storage=storageFor(env),index=getIndex(storage,userId);
 // Persist a short hash only. Never save report HTML or employee data in the
 // shortcut index: those belong exclusively inside the actual PDF.
 const reportFingerprint=fingerprintKey(fingerprint||blob.size);
 const previous=index.find(x=>x.key===key&&x.projectId===projectId&&x.reportType===reportType);
 const folder=previous?.path?.includes('/')?previous.path.slice(0,previous.path.lastIndexOf('/')):ROOT+'/'+projectDir+'/'+category+'/'+month;
 const path=folder+'/'+(previous?.filename||fileName);
 if(previous&&previous.fingerprint===reportFingerprint){
  try{
   const stat=await fs.stat({path,directory:DIRECTORY});
   if(Number(stat.size)>0)return {...previous,alreadySaved:true}
  }catch{/* File was moved/deleted in Files; recreate it. */}
 }
 // Safe/write first; NEVER index a PDF before it is confirmed on disk.
 await fs.mkdir({path:folder,directory:DIRECTORY,recursive:true});
 const data=await readBase64(blob,env);
 await fs.writeFile({path,directory:DIRECTORY,data,recursive:true});
 const stat=await fs.stat({path,directory:DIRECTORY});
 if(!Number(stat.size))throw new Error('PDF was not verified on the iPad');
 const record={key,projectId,reportType,reportNumber:String(reportNumber||'').slice(0,90),
  sourceId:String(sourceId||'').slice(0,90),filename:previous?.filename||fileName,
  path,fingerprint:reportFingerprint,size:Number(stat.size),savedAt:new Date().toISOString()};
 const next=index.filter(x=>!(x.key===key&&x.projectId===projectId&&x.reportType===reportType));
 next.unshift(record);
 try{storage?.setItem(INDEX_PREFIX+userId,JSON.stringify(next))}catch{
  // The PDF remains accessible from the iPad's Files app even if the shortcut
  // cannot be indexed (private browsing / storage quota / OS restrictions).
  return {...record,indexed:false};
 }
 return {...record,indexed:true};
}
export async function openLocalReport(record,{env=globalThis}={}){
 const fs=nativePlugin(env);
 if(!fs||!record?.path?.startsWith(ROOT+'/'))throw new Error('Local report unavailable');
 const stat=await fs.stat({path:record.path,directory:DIRECTORY});
 if(!Number(stat.size))throw new Error('The report was moved or deleted from Files');
 const share=env.Capacitor?.Plugins?.Share;
 if(!share||typeof share.share!=='function')throw new Error('Install @capacitor/share to open saved reports');
 const result=await fs.getUri({path:record.path,directory:DIRECTORY});
 if(!result?.uri)throw new Error('PDF link unavailable');
 await share.share({title:record.filename,url:result.uri,dialogTitle:'Open or share G&E report'});
 return true;
}
